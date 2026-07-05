# 系統架構與安全機制 (Architecture & Security)

本專案 (Be a Good Person - Config UI) 經過多輪重構與安全審查，具備以下核心架構與防護機制。

## 1. 核心資料流架構

*   **Single Source of Truth (SSOT)**: 
    所有的資料結構定義統一由 `src/schemas.ts` 內的 Zod Schema 負責。前端表單渲染、預設值生成、以及存檔驗證，皆完全依賴於 Schema。
*   **多型表單 (Polymorphic Forms)**: 
    為了處理遊戲設定中複雜的條件分支（例如 `exam_type` 為 `bid` 時才會出現對應欄位），系統實作了 `getPolymorphicController`。這個函數會掃描 `schemas.ts` 內定義的 `_meta` 標籤，找出欄位之間的依賴關係，並動態決定是否渲染該欄位。

## 2. 嚴格的資料安全防護

經歷 5 輪以上的 AI Subagent 交叉審查，本系統實作了業界標準的邊界防護：

### A. 零資料遺失 (No Data Loss)
*   **`.catchall(z.any())`**: 所有 `z.object` 皆強制套用 catchall。這保證了當 GitHub 上的 JSON 檔案含有前端尚未定義的新欄位時，這些未知欄位不會在 Zod 驗證過程中被自動剔除，達成 100% 原汁原味的儲存。
*   **無 `.strict()`**: 專案中徹底禁用了 `Zod.strict()`。

### B. 無驗證死鎖與狀態殘留 (No Validation Conflict)
*   **Ghost Objects 過濾**: 使用 `react-hook-form` 時，為保留未渲染欄位的狀態（提升 UX），設定了 `shouldUnregister: false`。然而，這會導致 Zod 在背景驗證這些隱藏欄位時發生必填錯誤。
*   **解法**: 在送入 `zodResolver` 驗證前，以及送出儲存 (`onValid`) 前，系統會呼叫 `sanitizeData` 攔截器，精準剃除所有「非活躍狀態 (Inactive)」的多型子物件，保證 Zod 永遠只驗證畫面上活躍的資料。

### C. 杜絕原型污染 (Prototype Pollution Prevention)
*   所有遍歷物件的 `for...in` 迴圈（包含 `sanitizeData`, `generateEmptyTemplate`, `getPolymorphicController` 等），皆強制實作了雙重防護：
    1.  `!Object.prototype.hasOwnProperty.call(obj, key)`：忽略繼承自原型鏈的屬性。
    2.  黑名單過濾：阻擋 `__proto__`, `constructor`, `prototype` 等特殊鍵值，避免惡意負載竄改 JavaScript 原生行為。

## 3. PWA 與跨平台支援

*   **Vite PWA**: 專案已整合 `vite-plugin-pwa`，支援 Service Worker 與清單 (Manifest) 生成，可安裝於 iOS / Android 桌面。
*   **離線體驗**: 核心業務邏輯皆在前端運行，未連線 GitHub 時亦可透過本地 IndexedDB 草稿系統繼續工作，或使用 ZIP 匯入匯出。
