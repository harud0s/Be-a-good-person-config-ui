/// <reference types="wicg-file-system-access" />
import { create } from 'zustand';
import { get as getIDB, set as setIDB } from 'idb-keyval';
import JSZip from 'jszip';

export interface FileEntry {
  name: string;
  path: string;
  handle?: FileSystemFileHandle;
  metaDescription?: string;
  contentString?: string;
  originalContent?: string;
}

interface EditorState {
  directoryHandle: FileSystemDirectoryHandle | null;
  files: FileEntry[];
  activeFile: FileEntry | null;
  activeFileContent: any | null;
  isDirty: boolean;
  isZipMode: boolean;
  requiresPermission?: boolean;
  drafts: Record<string, any>;
  originalContents: Record<string, string>;

  initStore: () => Promise<void>;
  restoreSession: () => Promise<void>;
  openDirectory: () => Promise<void>;
  importZip: (file: File) => Promise<void>;
  exportZip: () => Promise<void>;
  openFile: (fileEntry: FileEntry) => Promise<void>;
  saveFile: (content: any, targetFile?: FileEntry) => Promise<void>;
  saveAllDrafts: () => Promise<void>;
  clearDraft: (path: string) => void;
  updateActiveContent: (content: any, isDirty?: boolean) => void;
  setDirty: (isDirty: boolean) => void;
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
  isZipMode: false,
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
            isZipMode: false,
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
        isZipMode: false,
        drafts: {},
        originalContents: newOriginalContents
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

          // extract just filename from path
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
        isZipMode: true,
        drafts: {},
        originalContents: newOriginalContents
      });
    } catch (error) {
      console.error('Failed to import zip:', error);
      throw error;
    }
  },

  exportZip: async () => {
    const { files, isZipMode } = getStore();
    if (!isZipMode || files.length === 0) throw new Error("No files to export in ZIP mode");

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
      } else {
        throw new Error("File has no handle and no content");
      }

      const json = JSON.parse(text);
      
      set({ 
        activeFile: fileEntry, 
        activeFileContent: json, 
        isDirty: false,
        originalContents: { ...state.originalContents, [fileEntry.path]: text }
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
    const { activeFile, files, isZipMode, drafts, originalContents } = getStore();
    const fileToSave = targetFile || activeFile;
    if (!fileToSave) throw new Error("No file to save");

    try {
      const contentString = JSON.stringify(content, null, 2);

      if (isZipMode) {
        // Update the files array in memory
        const updatedFiles = files.map(f => 
          f.path === fileToSave.path ? { ...f, contentString } : f
        );
        const newDrafts = { ...drafts };
        delete newDrafts[fileToSave.path];
        
        const updates: Partial<EditorState> = {
          files: updatedFiles,
          drafts: newDrafts,
          originalContents: { ...originalContents, [fileToSave.path]: contentString }
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
        
        const updates: Partial<EditorState> = {
          drafts: newDrafts,
          originalContents: { ...originalContents, [fileToSave.path]: contentString }
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
    const { drafts, activeFile, originalContents } = getStore();
    const newDrafts = { ...drafts };
    delete newDrafts[path];
    
    const updates: Partial<EditorState> = { drafts: newDrafts };
    if (activeFile && activeFile.path === path) {
       updates.isDirty = false;
       if (originalContents[path]) {
          updates.activeFileContent = JSON.parse(originalContents[path]);
       }
    }
    set(updates);
  },
}));
