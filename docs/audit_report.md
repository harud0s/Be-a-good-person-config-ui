# 前端架構與程式碼審核報告 (v2)

本報告由三位獨立的 Subagent 針對 `config-ui_ws` 專案最新的 PWA 架構、React 狀態管理與 TypeScript 資料整合進行了嚴格審核。以下為重點彙整與待修復問題清單。

## 1. UX & PWA 架構審核
* **PWA 跨平台相容性 (嚴重)**：目前強烈依賴 `File System Access API` (`window.showDirectoryPicker`)，這在 iOS Safari 與大多數行動端瀏覽器上**完全不支援**。如果這是一個要給行動裝置使用的 PWA，必須實作備用機制（例如透過 `<input type="file" webkitdirectory>` 讀取，並在記憶體內修改後以 ZIP 下載）。
* **無障礙設計 (A11y)**：折疊面板的標題區塊缺少 `role="button"`、`tabIndex={0}` 以及鍵盤操作支援（`onKeyDown`），對螢幕閱讀器與鍵盤使用者不友善。
* **PWA Manifest 缺漏**：`vite.config.ts` 中的 `VitePWA` 缺少明確的 `display: "standalone"` 與 `start_url: "/"` 設定，可能導致安裝後行為異常。

## 2. React 狀態與 Hook Form 審核
* **資料遺失危機 (已修復)**：原本 `DynamicForm` 使用 `shouldUnregister: true`，且 `CollapsibleArrayItem` 依賴條件渲染 (`isOpen && <ObjectField/>`)。這導致當項目折疊時，表單欄位會被卸載並從 `react-hook-form` 的狀態中永久刪除，存檔時會發生嚴重的資料遺失。目前已改用 CSS `hidden` 類別解決。
* **效能瓶頸 (已修復)**：原本 `useWatch` 監聽了整個陣列物件，導致任何按鍵輸入都會造成整個陣列項目劇烈重新渲染。目前已優化為僅監聽 `label` 與 `rank`。
* **字串強制轉型 (待修復)**：在處理基本型別陣列 (Primitive Array) 時，原生的 `<input>` 會將數字轉為字串。目前的 `sanitizeData` 缺乏針對陣列元素的數值轉型防護。
* **過度渲染**：`App.tsx` 中的 `handleDirtyChange` 每次都會重新建立，導致 `DynamicForm` 內的 `useEffect` 不斷觸發 Zustand 更新。

## 3. TypeScript 與資料解析審核
* **型別定義 (優良)**：`types.ts` 完美對應了 JSON 範例，能精確捕捉複雜的聯集型別 (Union types) 與多型設定。
* **數值回退邏輯缺陷 (待修復)**：`isNumericKey` 使用的正則表達式遺漏了大量數字欄位 (例如 `effect_value`, `count_in_deck`, `skip_turns`)。當這些值為 `null` 時，會被錯誤地判定為字串輸入。
* **「新增項目」破壞 Schema (嚴重，待修復)**：`App.tsx` 中的「新增項目」會將模板所有 key 初始化為 `null`。這會把原本應該是陣列 (`options`) 或物件 (`pass_effect`) 的深層結構全部壓平為 null，導致新增後無法正常編輯深層資料。
* **聯集型別輸入鎖定 (待修復)**：欄位如 `hp_delta` 型別為 `number | string`，但 UI 嚴格將其渲染為 `<input type="number">`，這在物理上阻止了使用者輸入合法公式字串（例如 `"-(threshold - player_aca)"`）。
* **多型表單的盲點 (嚴重，待修復)**：多型物件切換（例如 `exam_type` 換成 `olympiad`）依賴 `Object.keys(data)`，如果原本的 JSON 中不存在 `olympiad` 屬性，即使切換了下拉選單，對應的表單也不會長出來。

---

## 下一步行動建議
1. 立即修正**「新增項目」破壞 Schema** 與 **多型表單盲點** 兩個最嚴重的資料結構問題。
2. 針對數值解析，放棄 Regex 猜測，改由 `_meta` 直接提供 `numeric_keys` 清單進行嚴格驗證。
3. 如果專案目標包含手機裝置，請設計備用的檔案匯入/匯出機制。
