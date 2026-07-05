# 嚴格審核報告 (Review Report)

本報告由 3 位 Subagent (UX & PWA 審查員、React & State 審查員、TypeScript & Data 審查員) 對目前的實作成果進行深度審核與彙整。

## 1. UX & PWA 架構審核
* **目錄權限無法持久化**：目前 `directoryHandle` 僅存在於記憶體中，重新整理頁面後需要重新選取資料夾。
  * **建議行動**：引入 `idb-keyval` 將 `directoryHandle` 存入 IndexedDB。應用程式啟動時調用 `verifyPermission({ mode: 'readwrite' })` 恢復操作。
* **取消選取的錯誤處理**：使用者取消 `showDirectoryPicker` 時會拋出 `AbortError`，目前僅用 generic error 捕捉。
  * **建議行動**：捕捉並忽略 `error.name === 'AbortError'`。
* **缺乏 PWA 設定**：目前沒有 `manifest.json` 與 Service Worker。
  * **建議行動**：使用 `vite-plugin-pwa` 產生 Service Worker，並在 `index.html` 補上 `theme-color` 等 PWA 必備 meta tags。
* **阻擋式提示 (Blocking UX)**：使用 `alert()` 來通知儲存成功會阻擋執行緒，體驗極差。
  * **建議行動**：替換為 Toast 通知元件 (如 Shadcn 的 Sonner)。

## 2. React Hook Form 與狀態管理審核
* **陣列缺乏動態操作能力**：目前動態表單遇到陣列時，僅依賴初始資料的長度進行 `map()` 渲染，未使用 `useFieldArray`。這導致使用者無法新增、刪除或重新排序項目。
  * **建議行動**：於 `DynamicForm.tsx` 中實作 `useFieldArray` 處理陣列。
* **未儲存遺失資料 (Data Loss) 風險**：雖然 `store.ts` 有 `isDirty`，但表單的輸入並未即時與之同步，且切換 Sidebar 檔案時沒有擋下。
  * **建議行動**：在檔案切換前檢查 `react-hook-form` 的 `isDirty`，跳出確認對話框防呆。
* **殭屍資料 (Zombie Data)**：針對多型表單（如 `exam_type` 由 `bid` 切換為 `olympiad`），被隱藏的舊欄位仍會留在 `react-hook-form` 內部，導致存檔時 schema 污染。
  * **建議行動**：在 `useForm` 設定 `shouldUnregister: true`，或於切換 `exam_type` 時手動清除隱藏欄位的值。
* **效能隱患 (Re-renders)**：`DynamicForm.tsx` 無條件在根節點呼叫 `useWatch({ name: 'exam_type' })`，會導致任何多型表單變化時觸發整棵大樹的 Re-render。
  * **建議行動**：把多型欄位的監聽邏輯下放或抽離。

## 3. TypeScript 與資料模型解析邊界審核
* **`null` 的突變與崩潰風險 (Critical)**：
  - **空字串突變**：使用者清空 Nullable 的文字輸入框時，React Hook Form 會存為 `""`（空字串）而非 `null`。若遊戲引擎嚴格檢查 `null` 將導致 Crash。
  - **數字突變為字串**：`valueAsNumber` 完全依賴初始資料是否為 `number`。若 JSON 初始值（如 `max_bet_cap`）剛好為 `null`，則會渲染為 text，導致後續輸入數字時存為字串 `"10"`，污染數值計算邏輯。
  - **陣列中的 null**：目前用 `typeof item === 'object'` 來判斷遞迴，若陣列元素為 `null` 將會導致 `Object.keys()` 拋出 Fatal TypeError。
  * **建議行動**：捨棄以 `typeof value` 判斷型別，改以 Schema（或 `_meta` 中的擴充屬性）強制映射型別；並在 `onSave` 攔截，將 `""` 轉換回 `null`。
* **寫死的領域邏輯 (Hardcoded Domain Logic)**：
  - `DynamicForm.tsx` 中寫死了 `exam_type`、`bid` 等遊戲特定字串。若未來其他設定檔剛好有 `bid` 欄位，將會錯誤觸發隱藏邏輯。
  * **建議行動**：解耦多型邏輯。應從 JSON Schema 或 `_meta` 判斷該欄位是否為多型，而非把遊戲邏輯寫死在動態元件中。
* **錯誤的 `useWatch` 路徑**：
  - 目前 `useWatch({ name: 'exam_type' })` 監聽的是「根節點」的 `exam_type`。如果使用者是在編輯整份 `exam_events.json` 而非獨立抽屜，這個寫法會完全失效。
  * **建議行動**：使用相對路徑動態組裝監聽路徑，例如 `${path.replace(/\.[^.]+$/, '.exam_type')}`。
