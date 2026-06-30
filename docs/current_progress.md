# 專案當前進度與注意事項

## 當前完成進度 (Phase 3 & 4)
- **UI 陣列折疊功能**：使用 Shadcn Accordion 將物件陣列 (如 `ranks`, `options`) 的顯示改為可折疊面板，大幅降低了編輯器展開多個項目時的視覺負擔。並加入了動態標題預覽 (如 `選項: 體力上限`)。
- **Zod 驗證與型別安全**：成功導入 Zod 取代 `any`，現在所有的欄位保存時會經過嚴格校驗，確保數字、字串等基本型態不會因為表單行為被錯誤竄改 (特別是原先數字型別被 `react-hook-form` 變成字串的問題，現已透過 Zod AST 動態抓取數字欄位進行轉換)。
- **PWA 與 離線儲存體驗**：
  - File System Access API 的權限要求已移至使用者層級 (恢復工作階段按鈕)，修復了 `useEffect` 自動觸發權限導致被瀏覽器阻擋的問題。
  - PWA 快取策略已透過 Vite PWA 外掛自動生成。
- **ZIP 檔案打包匯出**：整合 `jszip` 支援將編輯完成的 JSON 檔案結構與資料完整導出成單一 ZIP，同時也支援反向 ZIP 匯入編輯。
- **DFS 優化**：檔案掃描已改用 `Promise.all` 平行處理，顯著提升專案讀取速度。

## 開發與成果注意事項
1. **Zod Schemas 同步**：目前 `schemas.ts` 為系統的型別來源 (Single Source of Truth)。若後續專案的資料結構 (`types.ts`) 有所改變，**必須**第一時間更新 `schemas.ts` 中的定義，否則 `DynamicForm` 會發生驗證錯誤。
2. **特殊空陣列 (`[]`) 型別判斷**：針對 `[]` (例如初始的 `affects`)，無法從資料本身推測內層是字串還是數字。目前依賴 `getPrimitiveArrayKeysFromSchemaMap()` 動態收集的列表來進行轉換。如果有新增這類「單純數字/字串」陣列，記得在 Schema 內標示為 `z.array(z.number())` 或 `z.array(z.string())` 即可自動套用。
3. **錯誤拋出 (AbortError) 與 UX**：目前 `store.ts` 的 `restoreSession` 將使用者點擊「拒絕權限」實作成了拋出 `AbortError` (`DOMException`)。這與取消選取資料夾的情境共享同一套 `catch` 邏輯，避免無謂的彈出紅色報錯 `toast`。
4. **瀏覽器相容性**：檔案即時寫入、PWA 離線存取功能高度依賴 File System Access API。請注意此 API 目前在 Firefox 與某些行動版瀏覽器中不被支援，在這些環境下專案會退回只能使用 ZIP 匯入/匯出的備案。
