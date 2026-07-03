import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, History, GitCommit, User } from 'lucide-react';
import { useEditorStore } from '../store';
import { toast } from 'sonner';

interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string | null;
}

interface CommitRecord {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export function HistoryDrawer({ open, onOpenChange, path }: HistoryDrawerProps) {
  const [history, setHistory] = useState<CommitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const getGitHubHistory = useEditorStore(state => state.getGitHubHistory);

  useEffect(() => {
    if (open && path) {
      let ignore = false;
      const fetchHistory = async () => {
        setIsLoading(true);
        try {
          const data = await getGitHubHistory(path);
          if (!ignore) setHistory(data.history || []);
        } catch (error: any) {
          if (!ignore) toast.error(error.message || 'Failed to fetch history');
        } finally {
          if (!ignore) setIsLoading(false);
        }
      };
      fetchHistory();
      return () => { ignore = true; };
    }
  }, [open, path, getGitHubHistory]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 z-50 transition-opacity backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 w-[400px] max-w-[90vw] bg-card shadow-2xl z-50 flex flex-col border-l">
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <Dialog.Title className="text-lg font-bold flex items-center gap-2">
              <History className="w-5 h-5" />
              History
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-secondary rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>
          
          <div className="p-4 bg-muted/30 border-b shrink-0">
            <p className="text-sm text-muted-foreground break-all">
              File: <span className="font-mono font-medium text-foreground">{path}</span>
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4 border-l-2 border-border pl-4">
                    <div className="w-full space-y-2">
                      <div className="h-4 bg-secondary rounded w-3/4"></div>
                      <div className="h-3 bg-secondary rounded w-1/2"></div>
                      <div className="h-2 bg-secondary rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-muted-foreground mt-10">No history found.</p>
            ) : (
              <div className="space-y-6 border-l-2 border-border ml-2 pl-4">
                {history.map(record => (
                  <div key={record.sha} className="relative">
                    <div className="absolute -left-[23px] top-1 w-3 h-3 bg-card border-2 border-primary rounded-full" />
                    <h4 className="font-semibold text-sm mb-1">{record.message}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <User className="w-3 h-3" />
                      <span>{record.author}</span>
                      <span>•</span>
                      <span>{new Date(record.date).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono bg-secondary w-fit px-1.5 py-0.5 rounded">
                      <GitCommit className="w-3 h-3" />
                      {record.sha.substring(0, 7)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
