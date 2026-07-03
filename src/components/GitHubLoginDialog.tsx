import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface GitHubLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (repo: string, password: string) => Promise<void>;
}

export function GitHubLoginDialog({ open, onOpenChange, onConnect }: GitHubLoginDialogProps) {
  const [repo, setRepo] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      let savedRepo = '';
      try {
        savedRepo = localStorage.getItem('githubRepo') || '';
      } catch (e) {
        console.warn('無法讀取 localStorage', e);
      }
      setRepo(savedRepo);
      setPassword('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo || !password) return;
    
    if (!repo.includes('/')) {
      toast.error('Repo 必須是 owner/repo 格式');
      return;
    }

    setIsLoading(true);
    try {
      await onConnect(repo, password);
      try {
        localStorage.setItem('githubRepo', repo);
      } catch (e) {
        console.warn('無法寫入 localStorage', e);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || '連線失敗');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => { if (!isLoading) onOpenChange(val); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
        <Dialog.Content 
          onInteractOutside={(e) => { if (isLoading) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isLoading) e.preventDefault(); }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-xl w-[90vw] max-w-md z-50"
        >
          <Dialog.Title className="text-xl font-bold mb-4">Connect to GitHub</Dialog.Title>
          <Dialog.Description className="text-muted-foreground mb-4 text-sm">
            請輸入 GitHub Repository 與 Team Password 以載入設定檔。
          </Dialog.Description>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Repository (owner/repo)</label>
              <input
                type="text"
                value={repo}
                onChange={e => setRepo(e.target.value)}
                placeholder="e.g., myorg/myrepo"
                className="w-full border rounded px-3 py-2 bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Team Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full border rounded px-3 py-2 bg-background"
                required
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 border rounded hover:bg-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
