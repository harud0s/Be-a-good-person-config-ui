import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export function PWABadge() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swScriptUrl: string, r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered at', swScriptUrl, r);
    },
    onRegisterError(error: Error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('App 已可離線使用', {
        position: 'bottom-center',
        onDismiss: () => setOfflineReady(false),
      });
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast('發現新版本', {
        description: '有新的更新可用，請重新整理頁面以套用最新版本。',
        position: 'bottom-center',
        action: {
          label: '立即更新',
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => setNeedRefresh(false),
        duration: Infinity,
      });
    }
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  return null;
}
