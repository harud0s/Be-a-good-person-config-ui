import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from './store';
import DynamicForm from './DynamicForm';
import DiffViewer from './components/DiffViewer';
import { FolderOpen, Menu, X, FileJson, FileArchive, Download, Cloud, History, ChevronDown } from 'lucide-react';
import { Toaster, toast } from 'sonner';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { GitHubLoginDialog } from './components/GitHubLoginDialog';
import { CommitDialog } from './components/CommitDialog';
import { HistoryDrawer } from './components/HistoryDrawer';
import { getDefaultItemForArray, schemaMap } from './schemas';
import { sanitizeData } from './DynamicForm';

function FullTextEditor({ data, onSave, onChange }: { data: any, onSave: (d: any) => void, onChange: () => void }) {
  const [text, setText] = useState(JSON.stringify(data, null, 2));
  return (
    <div className="flex flex-col h-full space-y-4">
      <textarea 
        className="w-full h-[60vh] font-mono text-sm p-4 border rounded bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
        value={text}
        onChange={e => {
          setText(e.target.value);
          onChange();
        }}
      />
      <div>
        <button className="w-full bg-primary text-primary-foreground h-11 rounded font-medium hover:bg-primary/90 transition-colors shadow" onClick={() => {
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch(e) { 
            toast.error("JSON 格式錯誤，無法儲存"); 
            return;
          }
          onSave(parsed);
        }}>儲存修改</button>
      </div>
    </div>
  )
}

export default function App() {
  const files = useEditorStore(state => state.files);
  const activeFile = useEditorStore(state => state.activeFile);
  const activeFileContent = useEditorStore(state => state.activeFileContent);
  const isDirty = useEditorStore(state => state.isDirty);
  const drafts = useEditorStore(state => state.drafts);
  const workspaceMode = useEditorStore(state => state.workspaceMode);
  
  const openDirectory = useEditorStore(state => state.openDirectory);
  const openFile = useEditorStore(state => state.openFile);
  const updateActiveContent = useEditorStore(state => state.updateActiveContent);
  const setDirty = useEditorStore(state => state.setDirty);
  const initStore = useEditorStore(state => state.initStore);
  const importZip = useEditorStore(state => state.importZip);
  const exportZip = useEditorStore(state => state.exportZip);
  const requiresPermission = useEditorStore(state => state.requiresPermission);
  const restoreSession = useEditorStore(state => state.restoreSession);
  const checkUnsavedChanges = useEditorStore(state => state.checkUnsavedChanges);
  const openGitHubMode = useEditorStore(state => state.openGitHubMode);
  const saveAllDrafts = useEditorStore(state => state.saveAllDrafts);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);
  
  // Dialog States
  const [pendingAction, setPendingAction] = useState<'local' | 'zip' | 'github' | null>(null);
  const [isGitHubLoginOpen, setIsGitHubLoginOpen] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [historyFilePath, setHistoryFilePath] = useState<string | null>(null);
  const [isEditingFullText, setIsEditingFullText] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initStore();
  }, [initStore]);

  // Fix Radix UI pointer-events lock bug (stuck screen)
  useEffect(() => {
    if (!isGitHubLoginOpen && !isCommitDialogOpen && !isDiffViewerOpen && pendingAction === null) {
      document.body.style.pointerEvents = '';
    }
  }, [isGitHubLoginOpen, isCommitDialogOpen, isDiffViewerOpen, pendingAction]);

  const meta = activeFileContent?._meta;
  
  const mainArrayKey = React.useMemo(() => {
    if (activeFile?.name === 'event_sequence.json') {
      return null;
    }
    return activeFileContent 
      ? Object.keys(activeFileContent).find(key => key !== '_meta' && Array.isArray(activeFileContent[key])) 
      : null;
  }, [activeFileContent, activeFile?.name]);

  const handleSaveRoot = async (data: unknown): Promise<boolean> => {
    try {
      const schema = activeFile?.name ? schemaMap[activeFile.name] : null;
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
           toast.error("驗證失敗: " + result.error.errors[0].message);
           return false;
        }
      }
      const sanitized = sanitizeData(data, activeFileContent, undefined, activeFileContent?._meta);
      updateActiveContent(sanitized, false);
      toast.success(`已將 ${activeFile?.name} 的變更存入暫存`);
      return true;
    } catch {
      toast.error('儲存失敗');
      return false;
    }
  };

  const handleSaveItem = async (data: unknown) => {
    if (mainArrayKey && editingItemIndex !== null) {
      const newArray = [...activeFileContent[mainArrayKey]];
      newArray[editingItemIndex] = data;
      try {
        updateActiveContent({ ...activeFileContent, [mainArrayKey]: newArray }, false);
        toast.success(`已將項目變更存入暫存`);
        setEditingItemIndex(null);
      } catch {
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
    if (isDirty && !window.confirm("目前檔案有未儲存的變更，切換檔案將會遺失這些變更。確定要切換嗎？")) return;
    openFile(file).catch(() => toast.error('無法讀取檔案'));
    setIsSidebarOpen(false);
    setEditingItemIndex(null);
    setIsEditingMeta(false);
    setIsEditingFullText(false);
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

  const handleAction = (action: 'local' | 'zip' | 'github') => {
    if (checkUnsavedChanges()) {
      setPendingAction(action);
    } else {
      executeAction(action);
    }
  };

  const executeAction = (action: 'local' | 'zip' | 'github') => {
    setPendingAction(null);
    setEditingItemIndex(null);
    setIsEditingMeta(false);
    setIsEditingFullText(false);
    setHistoryFilePath(null);
    if (action === 'local') {
      handleOpenDirectory();
    } else if (action === 'zip') {
      fileInputRef.current?.click();
    } else if (action === 'github') {
      setIsGitHubLoginOpen(true);
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importZip(file);
      toast.success('ZIP 已載入');
    } catch {
      toast.error('載入 ZIP 失敗');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportZip = async () => {
    if (isDirty) {
      toast.error('有尚未「儲存修改」的表單內容，請先儲存！');
      return;
    }
    try {
      await useEditorStore.getState().saveAllDrafts();
      await exportZip();
      toast.success('ZIP 匯出成功');
    } catch {
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
      <header className="min-h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b flex items-center justify-between px-4 sticky top-0 bg-background z-10 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <button className="md:hidden p-2" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg hidden sm:block">快逃ゼロ Config UI</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (isDirty) {
                toast.error('您有尚未「儲存修改」的表單內容，請先儲存再查看 Diffs！');
                return;
              }
              setIsDiffViewerOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 min-h-[44px] rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            See Diffs
          </button>
          {files.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 min-h-[44px] rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors outline-none">
                  匯出...
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="min-w-[160px] bg-popover text-popover-foreground rounded-md shadow-md p-1 z-50 border" sideOffset={5} align="end">
                  <DropdownMenu.Item 
                    className="flex items-center gap-2 px-2 py-2 text-sm rounded cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground"
                    onSelect={() => { setTimeout(() => handleExportZip(), 0); }}
                  >
                    <Download className="w-4 h-4" /> 匯出到本機 (.zip)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    className="flex items-center gap-2 px-2 py-2 text-sm rounded cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground"
                    onSelect={async (e) => { 
                      e.preventDefault();
                      if (isDirty) {
                        toast.error('您有尚未「儲存修改」的表單內容，請先儲存再匯出到線上！');
                        return;
                      }
                      try {
                        await saveAllDrafts();
                        setIsCommitDialogOpen(true); 
                      } catch (err: any) {
                        toast.error(err.message || '儲存草稿失敗');
                      }
                    }}
                  >
                    <Cloud className="w-4 h-4" /> 匯出到線上 (GitHub)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 min-h-[44px] rounded-md text-sm font-medium hover:bg-primary/90 transition-colors outline-none">
                開啟專案...
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-[200px] bg-popover text-popover-foreground rounded-md shadow-md p-1 z-50 border" sideOffset={5} align="end">
                <DropdownMenu.Item 
                  className="flex items-center gap-2 px-2 py-2 text-sm rounded cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground"
                  onSelect={() => { setTimeout(() => handleAction('local'), 0); }}
                >
                  <FolderOpen className="w-4 h-4" /> 開啟資料夾 (Desktop)
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  className="flex items-center gap-2 px-2 py-2 text-sm rounded cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground"
                  onSelect={() => { setTimeout(() => handleAction('zip'), 0); }}
                >
                  <FileArchive className="w-4 h-4" /> 開啟 ZIP (Mobile)
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item 
                  className="flex items-center gap-2 px-2 py-2 text-sm rounded cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground"
                  onSelect={() => { setTimeout(() => handleAction('github'), 0); }}
                >
                  <Cloud className="w-4 h-4" /> 從 GitHub Repo 載入
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`
            absolute inset-y-0 left-0 z-30 w-72 border-r bg-background transform transition-transform duration-200 ease-in-out
            md:relative md:translate-x-0 pb-[env(safe-area-inset-bottom)]
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between md:hidden">
              <span className="font-semibold">檔案清單</span>
              <button className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-muted" onClick={() => setIsSidebarOpen(false)}>
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
                      <div className="flex items-center gap-2 font-medium w-full">
                        <FileJson className="w-4 h-4 shrink-0" />
                        <span className="truncate">{file.name}</span>
                        {drafts[file.path] && <span className="w-2 h-2 rounded-full bg-orange-500 ml-auto shrink-0"></span>}
                        {workspaceMode === 'github' && (
                          <button 
                            className={`p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground shrink-0 ${!drafts[file.path] ? 'ml-auto' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryFilePath(file.path);
                            }}
                            title="History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}
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
        <main className="flex-1 overflow-y-auto">
        {!activeFileContent ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-muted-foreground">
            <FileJson className="w-16 h-16 mb-4 opacity-20" />
            <p>選擇左側檔案開始編輯</p>
          </div>
        ) : (
            <div className="max-w-6xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] p-4 md:p-6">
              <div className="mb-6 pb-4 border-b">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {activeFile?.name}
                  {isDirty && <span className="text-sm font-normal text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">未儲存</span>}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-xs opacity-50">Version: {meta?.version}</p>
                  <button onClick={() => {
                    if (isDirty && !window.confirm("有未儲存的變更，執行此動作將遺失變更。確定繼續？")) return;
                    setIsEditingMeta(true);
                    setIsEditingFullText(false);
                    setEditingItemIndex(null);
                    setDirty(false);
                  }} className="text-xs bg-secondary text-secondary-foreground h-11 px-4 rounded hover:bg-secondary/80">編輯 Meta</button>
                  <button onClick={() => {
                    if (isDirty && !window.confirm("有未儲存的變更，執行此動作將遺失變更。確定繼續？")) return;
                    setIsEditingFullText(true);
                    setIsEditingMeta(false);
                    setEditingItemIndex(null);
                    setDirty(false);
                  }} className="text-xs bg-secondary text-secondary-foreground h-11 px-4 rounded hover:bg-secondary/80">以純文字編輯</button>
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
                          if (isDirty && !window.confirm("目前項目有未儲存的變更，切換將會遺失這些變更。確定要切換嗎？")) return;
                          setEditingItemIndex(index);
                          setIsEditingMeta(false);
                          setIsEditingFullText(false);
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
                    className="border border-dashed rounded-lg p-4 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer min-h-[44px] transition-colors"
                    onClick={() => {
                      if (isDirty && !window.confirm("有未儲存的變更，執行此動作將遺失變更。確定繼續？")) return;
                      setIsEditingMeta(false);
                      setIsEditingFullText(false);
                      setEditingItemIndex(activeFileContent[mainArrayKey].length);
                      setDirty(false); // clear dirty state for new edit
                    }}
                  >
                    + 新增項目
                  </div>
                </div>
              ) : (
                // 全域表單模式 (如 game_config.json)
                <div className="max-w-2xl">
                  <DynamicForm 
                    key={activeFile?.name}
                    filename={activeFile?.name || ''}
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
        {(editingItemIndex !== null && mainArrayKey) || isEditingMeta || isEditingFullText ? (
          <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[600px] border-l bg-background shadow-xl transform transition-transform duration-300 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
              <h3 className="font-bold flex items-center gap-2">
                {isEditingFullText ? '純文字編輯 (整份檔案)' : isEditingMeta ? '編輯 Meta' : '編輯資料'}
                {isDirty && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
              </h3>
              <button 
                onClick={() => {
                  if (isDirty && !window.confirm("確定要關閉嗎？未儲存的變更將會遺失。")) return;
                  setEditingItemIndex(null);
                  setIsEditingMeta(false);
                  setIsEditingFullText(false);
                  setDirty(false);
                }} 
                className="w-11 h-11 flex items-center justify-center hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
              {isEditingFullText ? (
                <FullTextEditor 
                  key={`full-${activeFile?.name}`}
                  data={activeFileContent}
                  onSave={async (parsed) => {
                    const success = await handleSaveRoot(parsed);
                    if (success) {
                      setIsEditingFullText(false);
                      setDirty(false);
                    }
                  }}
                  onChange={() => setDirty(true)}
                />
              ) : isEditingMeta ? (
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
                    setDirty(false);
                    toast.success("Meta 已更新至暫存");
                  }} 
                  onDirtyChange={() => {}}
                />
              ) : (
                <DynamicForm 
                  key={`${activeFile?.name}-${editingItemIndex}`}
                  filename={activeFile?.name}
                  isItem={true}
                  data={activeFileContent[mainArrayKey!][editingItemIndex!] !== undefined ? activeFileContent[mainArrayKey!][editingItemIndex!] : (getDefaultItemForArray(activeFile?.name, mainArrayKey!) || {})} 
                  meta={meta} 
                  onSave={handleSaveItem} 
                  onDirtyChange={handleDirtyChange}
                />
              )}
            </div>
          </div>
        ) : null}

      </div>

      {/* Dialogs */}
      <GitHubLoginDialog 
        open={isGitHubLoginOpen}
        onOpenChange={setIsGitHubLoginOpen}
        onConnect={async (repo, password) => {
          try {
            await openGitHubMode(repo, password);
            setIsGitHubLoginOpen(false);
          } catch (e) {
            // openGitHubMode already shows toasts for errors
          }
        }}
      />
      
      <CommitDialog 
        open={isCommitDialogOpen}
        onOpenChange={setIsCommitDialogOpen}
      />
      
      <HistoryDrawer 
        open={!!historyFilePath}
        onOpenChange={(open) => !open && setHistoryFilePath(null)}
        path={historyFilePath}
      />
      
      <AlertDialog.Root open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-xl w-[90vw] max-w-md z-50">
            <AlertDialog.Title className="text-xl font-bold mb-2">放棄未儲存的變更？</AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground mb-6">
              您有尚未儲存或尚未 Commit 的變更。若開啟新專案，這些變更將會永久遺失。確定要繼續嗎？
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 border rounded hover:bg-secondary">取消</button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button 
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                  onClick={() => pendingAction && executeAction(pendingAction)}
                >
                  強制繼續
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      
      <DiffViewer 
        isOpen={isDiffViewerOpen}
        onClose={() => setIsDiffViewerOpen(false)}
        onCommitRequest={() => setIsCommitDialogOpen(true)}
      />
    </div>
  );
}
