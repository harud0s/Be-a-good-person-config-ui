/// <reference types="wicg-file-system-access" />
import { create } from 'zustand';
import { get as getIDB, set as setIDB } from 'idb-keyval';
import JSZip from 'jszip';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

export interface FileEntry {
  name: string;
  path: string;
  handle?: FileSystemFileHandle;
  metaDescription?: string;
  contentString?: string;
  originalContent?: string;
  sha?: string;
}

interface EditorState {
  directoryHandle: FileSystemDirectoryHandle | null;
  files: FileEntry[];
  activeFile: FileEntry | null;
  activeFileContent: any | null;
  isDirty: boolean;
  workspaceMode: 'local' | 'zip' | 'github';
  githubRepo?: string;
  githubPassword?: string;
  requiresPermission?: boolean;
  drafts: Record<string, any>;
  originalContents: Record<string, string>;

  initStore: () => Promise<void>;
  restoreSession: () => Promise<void>;
  openDirectory: () => Promise<void>;
  importZip: (file: File) => Promise<void>;
  exportZip: () => Promise<void>;
  openGitHubMode: (repo: string, password: string) => Promise<void>;
  commitToGitHub: (message: string, authorName: string) => Promise<any>;
  getGitHubHistory: (path: string) => Promise<any>;

  openFile: (fileEntry: FileEntry) => Promise<void>;
  saveFile: (content: any, targetFile?: FileEntry) => Promise<void>;
  saveAllDrafts: () => Promise<void>;
  clearDraft: (path: string) => void;
  updateActiveContent: (content: any, isDirty?: boolean) => void;
  setDirty: (isDirty: boolean) => void;
  checkUnsavedChanges: () => boolean;
}

async function loadFilesFromDirectory(dirHandle: FileSystemDirectoryHandle, path: string = ''): Promise<FileEntry[]> {
  const promises: Promise<FileEntry | FileEntry[]>[] = [];
  
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
      promises.push((async () => {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const text = await file.text();
        
        let metaDescription = '';
        try {
           const json = JSON.parse(text);
           metaDescription = json._meta?.description || '';
        } catch (e) {
           console.warn(`Failed to parse _meta from ${entry.name}`);
        }

        return {
          name: entry.name,
          path: path + entry.name,
          handle: fileHandle,
          metaDescription,
          originalContent: text
        };
      })());
    } else if (entry.kind === 'directory') {
      promises.push(loadFilesFromDirectory(entry as FileSystemDirectoryHandle, path + entry.name + '/'));
    }
  }

  const results = await Promise.all(promises);
  const loadedFiles = results.flat();
  loadedFiles.sort((a, b) => a.path.localeCompare(b.path));
  return loadedFiles;
}

export const useEditorStore = create<EditorState>((set, getStore) => ({
  directoryHandle: null,
  files: [],
  activeFile: null,
  activeFileContent: null,
  isDirty: false,
  workspaceMode: 'local',
  drafts: {},
  originalContents: {},

  initStore: async () => {
    try {
      const dirHandle = await getIDB('directoryHandle') as FileSystemDirectoryHandle | undefined;
      if (dirHandle) {
        const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          const loadedFiles = await loadFilesFromDirectory(dirHandle);
          const newOriginalContents: Record<string, string> = {};
          loadedFiles.forEach(f => {
            if (f.originalContent) {
              newOriginalContents[f.path] = f.originalContent;
              delete f.originalContent;
            }
          });
          set({ 
            directoryHandle: dirHandle, 
            files: loadedFiles, 
            activeFile: null, 
            activeFileContent: null, 
            isDirty: false,
            workspaceMode: 'local',
            requiresPermission: false,
            drafts: {},
            originalContents: newOriginalContents
          });
        } else {
          set({
            directoryHandle: dirHandle,
            requiresPermission: true
          });
        }
      }
    } catch (error) {
      console.error('Failed to init store from indexedDB:', error);
    }
  },

  restoreSession: async () => {
    const { directoryHandle: dirHandle } = getStore();
    if (!dirHandle) return;
    try {
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        const loadedFiles = await loadFilesFromDirectory(dirHandle);
        const newOriginalContents: Record<string, string> = {};
        loadedFiles.forEach(f => {
          if (f.originalContent) {
            newOriginalContents[f.path] = f.originalContent;
            delete f.originalContent;
          }
        });
        set({ 
          files: loadedFiles, 
          requiresPermission: false, 
          originalContents: newOriginalContents, 
          drafts: {} 
        });
      } else {
        throw new DOMException('User denied permission', 'AbortError');
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
      throw e;
    }
  },

  checkUnsavedChanges: () => {
    const { drafts, workspaceMode, files, originalContents, isDirty } = getStore();
    if (isDirty) return true;
    if (Object.keys(drafts).length > 0) return true;
    
    if (workspaceMode === 'github') {
      const hasUncommitted = files.some(f => f.contentString !== undefined && f.contentString !== originalContents[f.path]);
      if (hasUncommitted) return true;
    }
    
    return false;
  },

  openDirectory: async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await setIDB('directoryHandle', dirHandle);

      const loadedFiles = await loadFilesFromDirectory(dirHandle);
      const newOriginalContents: Record<string, string> = {};
      loadedFiles.forEach(f => {
        if (f.originalContent) {
          newOriginalContents[f.path] = f.originalContent;
          delete f.originalContent;
        }
      });

      set({ 
        directoryHandle: dirHandle, 
        files: loadedFiles, 
        activeFile: null, 
        activeFileContent: null, 
        isDirty: false,
        workspaceMode: 'local',
        drafts: {},
        originalContents: newOriginalContents,
        githubRepo: undefined,
        githubPassword: undefined,
        requiresPermission: false
      });
    } catch (error) {
      console.error('Failed to open directory:', error);
      throw error;
    }
  },

  importZip: async (file: File) => {
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const loadedFiles: FileEntry[] = [];

      for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
        if (!zipEntry.dir && relativePath.endsWith('.json')) {
          const text = await zipEntry.async('string');
          let metaDescription = '';
          try {
            const json = JSON.parse(text);
            metaDescription = json._meta?.description || '';
          } catch (e) {
            console.warn(`Failed to parse _meta from ${relativePath}`);
          }

          const name = relativePath.split('/').pop() || relativePath;

          loadedFiles.push({
            name,
            path: relativePath,
            metaDescription,
            contentString: text,
            originalContent: text
          });
        }
      }

      loadedFiles.sort((a, b) => a.path.localeCompare(b.path));
      const newOriginalContents: Record<string, string> = {};
      loadedFiles.forEach(f => {
        if (f.originalContent) {
          newOriginalContents[f.path] = f.originalContent;
          delete f.originalContent;
        }
      });

      set({
        directoryHandle: null,
        files: loadedFiles,
        activeFile: null,
        activeFileContent: null,
        isDirty: false,
        workspaceMode: 'zip',
        drafts: {},
        originalContents: newOriginalContents,
        githubRepo: undefined,
        githubPassword: undefined,
        requiresPermission: false
      });
    } catch (error) {
      console.error('Failed to import zip:', error);
      throw error;
    }
  },

  exportZip: async () => {
    const { files, workspaceMode } = getStore();
    if (workspaceMode !== 'zip' && files.length === 0) throw new Error("No files to export in ZIP mode");

    const zip = new JSZip();
    for (const file of files) {
      if (file.contentString) {
        zip.file(file.path, file.contentString);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config_export.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  openGitHubMode: async (repo: string, password: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      let res;
      try {
        res = await fetch(`${WORKER_URL}/files?repo=${encodeURIComponent(repo)}`, {
          signal: controller.signal
        });
      } catch (e: any) {
        if (e.name === 'AbortError') throw new Error('請求逾時 (30秒)，請檢查網路連線或稍後再試');
        throw new Error(`網路連線失敗: ${e.message}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to fetch from GitHub Proxy: ${text}`);
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const loadedFiles: FileEntry[] = data.files.map((f: any) => ({
        name: f.name,
        path: f.path,
        sha: f.sha,
        metaDescription: f.metaDescription,
        contentString: f.originalContent,
        originalContent: f.originalContent
      }));

      loadedFiles.sort((a, b) => a.path.localeCompare(b.path));
      
      const newOriginalContents: Record<string, string> = {};
      loadedFiles.forEach(f => {
        if (f.originalContent) {
          newOriginalContents[f.path] = f.originalContent;
          delete f.originalContent;
        }
      });

      set({
        directoryHandle: null,
        files: loadedFiles,
        activeFile: null,
        activeFileContent: null,
        isDirty: false,
        workspaceMode: 'github',
        githubRepo: repo,
        githubPassword: password,
        drafts: {},
        originalContents: newOriginalContents,
        requiresPermission: false
      });
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Some files failed to load:', data.errors);
      }
    } catch (error) {
      console.error('Failed to open GitHub mode:', error);
      throw error;
    }
  },

  commitToGitHub: async (message: string, authorName: string) => {
    const { githubRepo, githubPassword, files, originalContents } = getStore();
    if (!githubRepo || !githubPassword) throw new Error('Not in GitHub mode or missing credentials');

    const changes = files
      .filter(f => f.contentString !== undefined && f.contentString !== originalContents[f.path])
      .map(f => ({
        fileName: f.path,
        content: f.contentString
      }));

    if (changes.length === 0) {
      throw new Error('No changes to commit');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let res;
    try {
      res = await fetch(`${WORKER_URL}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: githubRepo,
          password: githubPassword,
          changes,
          commitMessage: message,
          authorName
        }),
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('Commit 請求逾時 (30秒)，請檢查網路連線');
      throw new Error(`網路連線失敗: ${e.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || 'Failed to commit');
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Update the local SHAs and originalContents
    const updatedFilesData: { fileName: string; sha: string }[] = data.updatedFiles;
    
    // Create new maps for state updates
    const newOriginalContents = { ...originalContents };
    const newFiles = [...files];

    updatedFilesData.forEach(update => {
      const idx = newFiles.findIndex(f => f.path === update.fileName);
      if (idx !== -1) {
        newFiles[idx] = { ...newFiles[idx], sha: update.sha };
        if (newFiles[idx].contentString) {
           newOriginalContents[update.fileName] = newFiles[idx].contentString as string;
        }
      }
    });

    set({ files: newFiles, originalContents: newOriginalContents });
    return data;
  },

  getGitHubHistory: async (path: string) => {
    const { githubRepo } = getStore();
    if (!githubRepo) throw new Error('Not in GitHub mode');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let res;
    try {
      res = await fetch(`${WORKER_URL}/history?repo=${encodeURIComponent(githubRepo)}&path=${encodeURIComponent(path)}`, {
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('讀取歷史紀錄逾時 (30秒)，請檢查網路連線');
      throw new Error(`網路連線失敗: ${e.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error('Failed to fetch history');
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  openFile: async (fileEntry: FileEntry) => {
    try {
      const state = getStore();
      
      if (state.drafts[fileEntry.path]) {
        set({ 
          activeFile: fileEntry, 
          activeFileContent: state.drafts[fileEntry.path], 
          isDirty: true 
        });
        return;
      }

      let text = '';
      if (fileEntry.handle) {
        const file = await fileEntry.handle.getFile();
        text = await file.text();
      } else if (fileEntry.contentString) {
        text = fileEntry.contentString;
      } else if (state.originalContents[fileEntry.path]) {
        text = state.originalContents[fileEntry.path];
      } else {
        throw new Error("File has no handle and no content");
      }

      const json = JSON.parse(text);
      
      set({ 
        activeFile: fileEntry, 
        activeFileContent: json, 
        isDirty: false
      });
    } catch (error) {
      console.error(`Failed to read file ${fileEntry.name}:`, error);
      throw error;
    }
  },

  updateActiveContent: (content: any, isDirty: boolean = true) => {
    const { activeFile, drafts } = getStore();
    if (activeFile) {
      set({ 
        activeFileContent: content, 
        isDirty,
        drafts: { ...drafts, [activeFile.path]: content }
      });
    } else {
      set({ activeFileContent: content, isDirty });
    }
  },

  setDirty: (isDirty: boolean) => set({ isDirty }),

  saveFile: async (content: any, targetFile?: FileEntry) => {
    const { activeFile, files, workspaceMode, drafts } = getStore();
    const fileToSave = targetFile || activeFile;
    if (!fileToSave) throw new Error("No file to save");

    try {
      const contentString = JSON.stringify(content, null, 2);

      if (workspaceMode === 'zip' || workspaceMode === 'github') {
        // Update the files array in memory with contentString
        const updatedFiles = files.map(f => 
          f.path === fileToSave.path ? { ...f, contentString } : f
        );
        const newDrafts = { ...drafts };
        delete newDrafts[fileToSave.path];
        
        const updates: Partial<EditorState> = {
          files: updatedFiles,
          drafts: newDrafts
        };

        if (fileToSave.path === activeFile?.path) {
          updates.activeFileContent = content;
          updates.isDirty = false;
        }
        set(updates);
      } else if (fileToSave.handle) {
        const writable = await fileToSave.handle.createWritable();
        await writable.write(contentString);
        await writable.close();
        
        const newDrafts = { ...drafts };
        delete newDrafts[fileToSave.path];
        
        const updatedFiles = files.map(f => 
          f.path === fileToSave.path ? { ...f, contentString } : f
        );

        const updates: Partial<EditorState> = {
          files: updatedFiles,
          drafts: newDrafts
        };
        if (fileToSave.path === activeFile?.path) {
          updates.activeFileContent = content;
          updates.isDirty = false;
        }
        set(updates);
      } else {
         throw new Error("No handle available for saving");
      }
    } catch (error) {
      console.error(`Failed to save file ${fileToSave.name}:`, error);
      throw error;
    }
  },

  saveAllDrafts: async () => {
    const { drafts, files, saveFile } = getStore();
    for (const [path, content] of Object.entries(drafts)) {
      const fileEntry = files.find(f => f.path === path);
      if (fileEntry) {
        await saveFile(content, fileEntry);
      }
    }
  },

  clearDraft: (path: string) => {
    const { drafts, activeFile, originalContents, files } = getStore();
    const newDrafts = { ...drafts };
    delete newDrafts[path];
    
    const updates: Partial<EditorState> = { drafts: newDrafts };
    if (activeFile && activeFile.path === path) {
       updates.isDirty = false;
       
       // Fallback to in-memory file contentString if it exists (for zip/github "staged" changes),
       // else fallback to originalContents
       const fileEntry = files.find(f => f.path === path);
       let textToRestore = fileEntry?.contentString || originalContents[path];
       
       if (textToRestore) {
          updates.activeFileContent = JSON.parse(textToRestore);
       }
    }
    set(updates);
  },
}));
