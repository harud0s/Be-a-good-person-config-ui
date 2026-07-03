import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, GitCommit } from 'lucide-react';
import { useEditorStore } from '../store';
import { toast } from 'sonner';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommitDialog({ open, onOpenChange }: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  
  const files = useEditorStore(state => state.files);
  const originalContents = useEditorStore(state => state.originalContents);
  const commitToGitHub = useEditorStore(state => state.commitToGitHub);

  const changedFiles = files.filter(f => f.contentString !== undefined && f.contentString !== originalContents[f.path]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !authorName) return;
    
    setIsCommitting(true);
    try {
      await commitToGitHub(message, authorName);
      toast.success('Successfully committed to GitHub');
      onOpenChange(false);
      setMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => { if (!isCommitting) onOpenChange(val); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
        <Dialog.Content 
          onInteractOutside={(e) => { if (isCommitting) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isCommitting) e.preventDefault(); }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-xl w-[90vw] max-w-lg z-50 max-h-[90vh] flex flex-col"
        >
          <Dialog.Title className="text-xl font-bold mb-4 flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Commit Changes
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mb-4 text-sm">
            提交以下變更的檔案至 GitHub。
          </Dialog.Description>
          
          <div className="flex-1 overflow-auto min-h-0 mb-4 border rounded bg-muted/50 p-3">
            <h4 className="text-sm font-semibold mb-2">Changed Files ({changedFiles.length})</h4>
            {changedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">沒有偵測到任何變更</p>
            ) : (
              <ul className="text-sm space-y-1">
                {changedFiles.map(f => (
                  <li key={f.path} className="text-amber-600 font-medium font-mono">
                    • {f.path}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 shrink-0">
            <div>
              <label className="block text-sm font-medium mb-1">Commit Message</label>
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Update config..."
                className="w-full border rounded px-3 py-2 bg-background"
                required
                disabled={isCommitting || changedFiles.length === 0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Author Name</label>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="Your Name"
                className="w-full border rounded px-3 py-2 bg-background"
                required
                disabled={isCommitting || changedFiles.length === 0}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 border rounded hover:bg-secondary"
                  disabled={isCommitting}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                disabled={isCommitting || changedFiles.length === 0}
              >
                {isCommitting ? 'Committing...' : 'Commit'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" disabled={isCommitting}>
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
