import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from './store';
import DynamicForm from './DynamicForm';
import DiffViewer from './components/DiffViewer';
import { FolderOpen, Menu, X, FileJson, FileArchive, Download } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function App() {
  const files = useEditorStore(state => state.files);
  const activeFile = useEditorStore(state => state.activeFile);
  const activeFileContent = useEditorStore(state => state.activeFileContent);
  const isDirty = useEditorStore(state => state.isDirty);
  const drafts = useEditorStore(state => state.drafts);
  const isZipMode = useEditorStore(state => state.isZipMode);
  
  const openDirectory = useEditorStore(state => state.openDirectory);
  const openFile = useEditorStore(state => state.openFile);
  const saveFile = useEditorStore(state => state.saveFile);
  const updateActiveContent = useEditorStore(state => state.updateActiveContent);
  const setDirty = useEditorStore(state => state.setDirty);
  const initStore = useEditorStore(state => state.initStore);
  const importZip = useEditorStore(state => state.importZip);
  const exportZip = useEditorStore(state => state.exportZip);
  const requiresPermission = useEditorStore(state => state.requiresPermission);
  const restoreSession = useEditorStore(state => state.restoreSession);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initStore();
  }, [initStore]);

  const meta = activeFileContent?._meta;
  
  const mainArrayKey = React.useMemo(() => {
    if (activeFile?.name === 'event_sequence.json') {
      return null;
    }
    return activeFileContent 
      ? Object.keys(activeFileContent).find(key => key !== '_meta' && Array.isArray(activeFileContent[key])) 
      : null;
  }, [activeFileContent, activeFile?.name]);

  const handleSaveRoot = async (data: any) => {
    try {
      updateActiveContent(data, false);
      toast.success(`已將 ${activeFile?.name} 的變更存入暫存`);
    } catch (e) {
      toast.error('儲存失敗');
    }
  };

  const handleSaveItem = async (data: any) => {
    if (mainArrayKey && editingItemIndex !== null) {
      const newArray = [...activeFileContent[mainArrayKey]];
      newArray[editingItemIndex] = data;
      try {
        updateActiveContent({ ...activeFileContent, [mainArrayKey]: newArray }, false);
        toast.success(`已將項目變更存入暫存`);
        setEditingItemIndex(null);
      } catch (e) {
        toast.error('儲存失敗');
      }
    }
  };

  const handleDirtyChange = (dirty: boolean) => {
    if (activeFileContent) {
      setDirty(dirty);
    }
  };

  const handleOpenFile = (file: any) => {
    openFile(file).catch(() => toast.error('無法讀取檔案'));
    setIsSidebarOpen(false);
    setEditingItemIndex(null);
    setIsEditingMeta(false);
  };

  const handleOpenDirectory = async () => {
    try {
      await openDirectory();
      toast.success('資料夾已開啟');
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast.error('無法開啟資料夾');
      }
    }
  }

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importZip(file);
      toast.success('ZIP 已載入');
    } catch (error) {
      toast.error('載入 ZIP 失敗');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportZip = async () => {
    try {
      await exportZip();
      toast.success('ZIP 匯出成功');
    } catch (error) {
      toast.error('匯出 ZIP 失敗');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Toaster position="top-right" richColors />
      
      {/* Hidden file input for ZIP import */}
      <input 
        type="file" 
        accept=".zip" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleImportZip} 
      />

      {/* Top Navbar */}
      <header className="h-14 border-b flex items-center justify-between px-4 sticky top-0 bg-background z-10 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <button className="md:hidden p-2" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg hidden sm:block">快逃ゼロ Config UI</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsDiffViewerOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            See Diffs
          </button>
          {isZipMode && (
            <button
              onClick={handleExportZip}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">匯出 ZIP</span>
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border bg-background px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileArchive className="w-4 h-4" />
            <span className="hidden sm:inline">開啟 ZIP (Mobile)</span>
            <span className="sm:hidden">ZIP</span>
          </button>
          <button
            onClick={handleOpenDirectory}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">開啟資料夾 (Desktop)</span>
            <span className="sm:hidden">資料夾</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`
            absolute inset-y-0 left-0 z-30 w-72 border-r bg-background transform transition-transform duration-200 ease-in-out
            md:relative md:translate-x-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between md:hidden">
              <span className="font-semibold">檔案清單</span>
              <button onClick={() => setIsSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {requiresPermission ? (
                <div className="p-4 text-sm text-center flex flex-col gap-3">
                  <p className="text-muted-foreground">找到上次開啟的資料夾，但需要權限才能讀取。</p>
                  <button
                    onClick={async () => {
                      try {
                        await restoreSession();
                        toast.success('已恢復權限');
                      } catch (e: any) {
                        if (e?.name !== 'AbortError') {
                          toast.error('無法取得權限，請重新選擇資料夾');
                        }
                      }
                    }}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                  >
                    恢復工作階段
                  </button>
                </div>
              ) : files.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  請點擊右上角開啟包含設定檔的資料夾
                </div>
              ) : (
                <div className="space-y-1">
                  {files.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => handleOpenFile(file)}
                      className={`w-full text-left p-3 rounded-md transition-colors flex flex-col gap-1 ${
                        activeFile?.name === file.name 
                          ? 'bg-secondary text-secondary-foreground' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <FileJson className="w-4 h-4" />
                        {file.name}
                        {drafts[file.path] && <span className="w-2 h-2 rounded-full bg-orange-500 ml-auto"></span>}
                      </div>
                      {file.metaDescription && (
                        <span className="text-xs opacity-70 line-clamp-2 pl-6">
                          {file.metaDescription}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          {!activeFile ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <FileJson className="w-12 h-12 opacity-20" />
              <p>請從左側選擇設定檔開始編輯</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto pb-24">
              <div className="mb-6 pb-4 border-b">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {activeFile.name}
                  {isDirty && <span className="text-sm font-normal text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">未儲存</span>}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-xs opacity-50">Version: {meta?.version}</p>
                  <button onClick={() => setIsEditingMeta(true)} className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/80">編輯 Meta</button>
                </div>
                <p className="text-muted-foreground mt-1">{meta?.description}</p>
              </div>

              {mainArrayKey ? (
                // 列表模式 (顯示陣列資料)
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeFileContent[mainArrayKey].map((item: any, index: number) => {
                    let title = item.event_name || item.display_name || item.goal_name || item.card_name || item.question || item.exam_name || item.id || `Item ${index}`;
                    if (item.status) title = `[${item.status}] ${title}`;
                    const subtitle = item.event_id || item.goal_id || item.card_id || item.exam_id || item.id;
                    return (
                      <div 
                        key={`${index}-${subtitle || title}`} 
                        className="border rounded-lg p-4 bg-card text-card-foreground shadow-sm hover:border-primary cursor-pointer transition-colors relative"
                        onClick={() => {
                          setEditingItemIndex(index);
                          setIsEditingMeta(false);
                          setDirty(false); // clear dirty state for new edit
                        }}
                      >
                        <h3 className="font-semibold text-lg line-clamp-1">{title}</h3>
                        {subtitle && <p className="text-sm text-muted-foreground font-mono mt-1">{subtitle}</p>}
                        {item.type && <span className="inline-block px-2 py-1 bg-secondary text-xs rounded mt-2">{item.type}</span>}
                      </div>
                    )
                  })}
                  
                  {/* 新增項目按鈕 */}
                  <div 
                    className="border border-dashed rounded-lg p-4 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                    onClick={() => {
                      // Determine default empty object
                      const template = activeFileContent[mainArrayKey][0] || {};
                      const newItem = Object.keys(template).reduce((acc, key) => ({ ...acc, [key]: null }), {});
                      
                      const newArray = [...activeFileContent[mainArrayKey], newItem];
                      saveFile({ ...activeFileContent, [mainArrayKey]: newArray }).then(() => {
                        setEditingItemIndex(newArray.length - 1);
                      });
                    }}
                  >
                    + 新增項目
                  </div>
                </div>
              ) : (
                // 全域表單模式 (如 game_config.json)
                <div className="max-w-2xl">
                  <DynamicForm 
                    key={activeFile.name}
                    filename={activeFile.name}
                    isItem={false}
                    data={activeFileContent} 
                    meta={meta} 
                    onSave={handleSaveRoot} 
                    onDirtyChange={handleDirtyChange}
                  />
                </div>
              )}
            </div>
          )}
        </main>

        {/* 編輯抽屜 (Drawer/Sheet) */}
        {(editingItemIndex !== null && mainArrayKey) || isEditingMeta ? (
          <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[500px] border-l bg-background shadow-xl transform transition-transform duration-300 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
              <h3 className="font-bold flex items-center gap-2">
                {isEditingMeta ? '編輯 Meta' : '編輯資料'}
                {isDirty && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
              </h3>
              <button 
                onClick={() => {
                  setEditingItemIndex(null);
                  setIsEditingMeta(false);
                  setDirty(false);
                }} 
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isEditingMeta ? (
                <DynamicForm 
                  key={`${activeFile?.name}-meta`}
                  filename={activeFile?.name}
                  isItem={false}
                  isMeta={true}
                  data={activeFileContent._meta || {}} 
                  onSave={async (newMeta) => {
                    const newContent = { ...activeFileContent, _meta: newMeta };
                    updateActiveContent(newContent, false);
                    setIsEditingMeta(false);
                    toast.success("Meta 已更新至暫存");
                  }} 
                  onDirtyChange={() => {}}
                />
              ) : (
                <DynamicForm 
                  key={`${activeFile?.name}-${editingItemIndex}`}
                  filename={activeFile?.name}
                  isItem={true}
                  data={activeFileContent[mainArrayKey!][editingItemIndex!]} 
                  meta={meta} 
                  onSave={handleSaveItem} 
                  onDirtyChange={handleDirtyChange}
                />
              )}
            </div>
          </div>
        ) : null}

        {isDiffViewerOpen && (
          <DiffViewer onClose={() => setIsDiffViewerOpen(false)} />
        )}
      </div>
    </div>
  );
}
