# Phase 6: 前端架構重構與後端代理 API 整合

本文檔記錄了「快逃ゼロ」遊戲設定檔 PWA 編輯器進入 Phase 6 前的系統現狀，以及此次全面升級的最終目標。透過記錄與對比，確保在拆分任務並逐步實作的過程中不偏離核心需求。

## 1. 系統現狀 (Current State)

目前編輯器已具備強大的前端編輯能力與防呆機制，但在儲存、同步與架構擴充性上仍有侷限：

*   **單一儲存模式**：
    *   目前高度依賴 `window.showDirectoryPicker` 讀寫本機資料夾，或透過純前端解析 ZIP 檔。
    *   `store.ts` 中的狀態僅以 `isZipMode` 作為區分，並無統一的「Workspace Mode」架構。
*   **缺乏雲端同步能力**：
    *   無法直接從 GitHub 讀取遊戲設定檔，使用者若要更新遊戲設定，必須手動下載 Repository、用編輯器修改後，再重新 Push 上去。
*   **缺乏協作與歷史追蹤**：
    *   前端只能看到當下檔案狀態，無法追蹤修改歷史，更無法在前端直接輸入 Commit Message 進行版本控管。
*   **安全性隱患**：
    *   若要讓 PWA 具備推送回 GitHub 的能力，直接在前端暴露 GitHub PAT 會導致嚴重的安全漏洞，任何人都能隨意修改 Repository。
*   **UI 顯示尚無深度優化**：
    *   面對複雜的 Array of Objects（如選項），目前全數展開，尚未導入如 Accordion (折疊面板) 的收納設計。
    *   針對列舉型別或條件性欄位（多型表單），尚無 Zod 驗證與 `useWatch` 動態顯示整合。

---

## 2. 最終目標 (Final Goals)

本次大規模升級的最終目標，是將編輯器轉化為一個**安全、跨平台且具備版本控管能力的無伺服器架構應用**。分為「前端」與「後端代理 API」兩大面向：

### Part 1: 前端架構 (Frontend)

1.  **統一的工作區模式 (Workspace Modes)**：
    *   導入三種明確模式：`local` (本機資料夾)、`zip` (本機 ZIP 解壓縮)、`github` (GitHub 遠端同步)。
    *   實作 Navbar 上的下拉選單 (`DropdownMenu`) 供使用者自由切換。
2.  **GitHub 模式深度整合**：
    *   切換 GitHub 模式時，透過 Proxy API 讀取並載入遠端設定檔。
    *   實作 **History Drawer**，允許使用者點擊「查看修改紀錄」觀看檔案近 5 筆的 Commit 歷史。
    *   實作 **Commit Dialog**，取代單純的 Save，要求使用者填寫「提交者名稱」、「Commit 訊息」以及「團隊密碼」後發送變更。
3.  **進階動態表單與防呆 UI**：
    *   結合 Zod Schema，提供型別防護 (例如限制數字輸入)。
    *   基於 `_meta` 產生下拉選單 (Enum)，限制選擇範圍。
    *   實作 **Polymorphic Forms (多型表單)**：透過 `useWatch` 動態切換顯示區塊，隱藏不必要的欄位且不寫入資料。
    *   採用 **Accordion (折疊面板)** 收納深層陣列，並提取內部 `label` 或 `name` 作為預覽標題，提升長清單的可讀性。
4.  **PWA 封裝**：
    *   設定 `vite-plugin-pwa` 與 `manifest.json`，提供桌面安裝與靜態資源快取能力 (Offline Support)。

### Part 2: 後端代理 API (Backend Proxy)

為了解決直接存取 GitHub 帶來的安全風險，將以 **Cloudflare Worker** 建立一個中介代理層 (Proxy API)，作為「鐵壁」防護。

1.  **機密隔離**：
    *   GitHub PAT (`GITHUB_PAT`) 與團隊密碼 (`TEAM_PASSWORD`) 僅存在於 Worker 環境變數，絕不暴露給前端。
2.  **嚴格的安全防護 (鐵壁機制)**：
    *   **CORS 限制**：僅允許指定的 PWA 網域發起請求。
    *   **檔案白名單**：限制 API 僅能讀寫遊戲特定的 8 個 JSON 設定檔，絕對禁止修改如 `.ts` 等程式碼檔案。
    *   **密碼驗證**：前端每次 Commit 請求皆須附帶團隊密碼，與 `TEAM_PASSWORD` 比對一致才放行。
3.  **API 路由功能**：
    *   `GET /files`：取得特定 Repository 中的 JSON 檔案內容與 `sha` 值。
    *   `GET /history`：取得單一檔案的近期 Commit 歷史。
    *   `POST /commit`：驗證密碼與白名單後，組合自訂 Commit 訊息 (如 `[System] {msg} by {author}`)，並呼叫 GitHub API 覆寫檔案。

---
> *本文件將作為後續拆分任務與逐步實作的最高指導原則。*
