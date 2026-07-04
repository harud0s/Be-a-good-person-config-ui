import { useState, useEffect } from 'react';
import { useEditorStore } from '../store';
import { X, Save, GitCommit } from 'lucide-react';
import { diffJson } from 'diff';
import { toast } from 'sonner';

interface DiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  onCommitRequest?: () => void;
}

export default function DiffViewer({ isOpen, onClose, onCommitRequest }: DiffViewerProps) {
  const drafts = useEditorStore(state => state.drafts);
  const originalContents = useEditorStore(state => state.originalContents);
  const saveAllDrafts = useEditorStore(state => state.saveAllDrafts);
  const clearDraft = useEditorStore(state => state.clearDraft);
  const workspaceMode = useEditorStore(state => state.workspaceMode);
  const files = useEditorStore(state => state.files);

  const uncommittedFiles = files
    .filter(f => f.contentString !== undefined && f.contentString !== originalContents[f.path])
    .map(f => f.path);

  const modifiedFiles = Array.from(new Set([...Object.keys(drafts), ...uncommittedFiles]));
  const [selectedFile, setSelectedFile] = useState<string | null>(modifiedFiles[0] || null);

  useEffect(() => {
    if (isOpen && (!selectedFile || !modifiedFiles.includes(selectedFile))) {
      setSelectedFile(modifiedFiles[0] || null);
    }
  }, [isOpen, modifiedFiles, selectedFile]);

  const handleSaveAll = async () => {
    try {
      await saveAllDrafts();
      toast.success("所有變更已儲存");
      onClose();
    } catch (e) {
      toast.error("儲存失敗");
    }
  };

  const handleDiscard = (path: string) => {
    if (window.confirm("確定要放棄此檔案的所有未儲存變更嗎？")) {
      clearDraft(path);
      
      // Also clear from contentString if it was uncommitted
      const fileIndex = files.findIndex(f => f.path === path);
      if (fileIndex !== -1 && files[fileIndex].contentString !== originalContents[path]) {
        // Revert to original content by loading from originalContents
        const originalText = originalContents[path] || '{}';
        const state = useEditorStore.getState();
        
        if (state.workspaceMode === 'local' && state.files[fileIndex].handle) {
           state.files[fileIndex].handle.createWritable().then(writable => {
             writable.write(originalText).then(() => writable.close());
           }).catch(console.error);
        }

        const updates: any = {
           files: state.files.map((f, i) => i === fileIndex ? { ...f, contentString: originalText } : f)
        };
        if (state.activeFile?.path === path) {
           updates.activeFileContent = JSON.parse(originalText);
           updates.isDirty = false;
        }
        useEditorStore.setState(updates);
      }

      if (selectedFile === path) {
        setSelectedFile(modifiedFiles.find(f => f !== path) || null);
      }
      if (modifiedFiles.length <= 1) { // It was the last one
        onClose();
      }
    }
  };

  const renderDiff = (path: string) => {
    try {
      const originalText = originalContents[path] || '{}';
      const originalObj = JSON.parse(originalText);
      
      let newObj;
      if (drafts[path]) {
        newObj = drafts[path];
      } else {
        const file = files.find(f => f.path === path);
        newObj = file?.contentString ? JSON.parse(file.contentString) : {};
      }

      const diffResult = diffJson(originalObj, newObj);

      return (
        <pre className="text-sm font-mono whitespace-pre-wrap">
          {diffResult.map((part, index) => {
            const color = part.added ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                          part.removed ? 'bg-red-500/20 text-red-700 dark:text-red-400 line-through' :
                          'text-muted-foreground';
            return (
              <span key={index} className={color}>
                {part.value}
              </span>
            );
          })}
        </pre>
      );
    } catch (e) {
      return <div className="text-red-500">無法比對此檔案</div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-background w-full max-w-5xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            未儲存的變更 (See Diffs)
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {modifiedFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            目前沒有未儲存的變更
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-1/3 border-r flex flex-col overflow-y-auto">
              {modifiedFiles.map(path => (
                <div 
                  key={path}
                  onClick={() => setSelectedFile(path)}
                  className={`p-3 border-b cursor-pointer hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedFile === path ? 'bg-muted border-l-4 border-l-primary' : ''
                  }`}
                >
                  <span className="font-medium truncate mr-2" title={path}>{path}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDiscard(path); }}
                    className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-colors shrink-0"
                  >
                    放棄
                  </button>
                </div>
              ))}
            </div>
            <div className="w-2/3 flex flex-col">
              <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                <span className="font-semibold text-sm">{selectedFile}</span>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-card">
                {selectedFile && renderDiff(selectedFile)}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-muted/10 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-md hover:bg-muted transition-colors"
          >
            關閉
          </button>
          {modifiedFiles.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={handleSaveAll}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium ${workspaceMode === 'github' ? 'border hover:bg-secondary' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              >
                <Save className="w-4 h-4" />
                全部儲存 (Save All)
              </button>
              {workspaceMode === 'github' && onCommitRequest && (
                <button 
                  onClick={async () => {
                    if (Object.keys(drafts).length > 0) {
                      await saveAllDrafts();
                    }
                    onClose();
                    onCommitRequest();
                  }}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <GitCommit className="w-4 h-4" />
                  Commit to GitHub
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
