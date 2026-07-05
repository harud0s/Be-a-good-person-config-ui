# Be a Good Person - Config UI

這是一個專為「Be a Good Person (做好人)」遊戲打造的配置檔案編輯後台 (Config UI)。本系統允許企劃與開發團隊直覺地編輯遊戲內的 JSON 配置檔，並透過 GitHub 整合直接同步至資料儲存庫。

## 🌟 主要功能

- **GitHub 雲端同步**：直接連接 `harud0s/Be-a-good-person-json-data` 儲存庫，在網頁上登入 GitHub 後即可載入、編輯並提交 (Commit & Push) 設定檔。
- **動態表單與多型支援 (Polymorphic Forms)**：
  - 支援如 `exam_events.json` 中複雜的多型資料結構（例如根據 `exam_type` 動態展開 `bid`, `olympiad`, `dutch_auction` 等專屬欄位）。
  - 自動處理表單狀態，隱藏非活躍的欄位，防止錯誤填寫。
- **Zod 嚴格與寬鬆雙重驗證**：
  - 核心欄位擁有嚴謹的型別與必填驗證。
  - 透過 `.catchall(z.any())` 機制，保證即使 JSON 檔案中存在尚未定義於前端 Schema 的新欄位，也不會在編輯與存檔過程中被意外捨棄。
- **高安全性資料清洗 (Data Sanitization)**：
  - 內建針對 **原型污染 (Prototype Pollution)** 的深度防護。所有的資料清洗與模板生成 (如 `sanitizeData`, `generateEmptyTemplate`, `getPolymorphicController`) 皆嚴格使用 `Object.prototype.hasOwnProperty` 進行過濾，阻斷惡意鍵值 (`__proto__`, `constructor`)。
  - 針對 React Hook Form 狀態殘留 (Ghost Objects) 進行提交前清洗，杜絕因不可見欄位導致的隱性驗證失敗 (Validation Conflicts)。
- **PWA (漸進式網頁應用)**：支援安裝至桌面或手機主畫面，提供原生應用程式般的體驗。

## 🛠️ 技術棧 (Tech Stack)

- **前端框架**: React 18 + TypeScript + Vite
- **表單管理**: React Hook Form + Zod
- **UI 元件庫**: Radix UI + Tailwind CSS + Lucide Icons
- **拖曳排序**: dnd-kit
- **後端整合**: Cloudflare Worker (負責處理 GitHub OAuth 流程與跨域代理)

## 🚀 專案啟動

### 環境變數設定
請確保在專案根目錄擁有正確的 `.env.development` 或 `.env.production`，並包含 Cloudflare Worker 的 API 端點：
```env
VITE_WORKER_URL=https://<your-worker-url>.workers.dev
```

### 啟動開發伺服器
```bash
npm install
npm run dev
```

### 建置生產環境版本 (Vercel)
```bash
npm run build
```

## 🛡️ 安全性與邊界條件 (Edge Cases) 防護紀錄

本專案經過 5 輪嚴格的 AI Subagent 交叉審查 (QA)，達成以下安全標準：
1. **零資料遺失**：未使用 `Zod.strict()`，保障任何未預期的屬性原封不動保存。
2. **無驗證死鎖**：儲存前清除所有因為 `shouldUnregister: false` 而殘留在記憶體內的「幽靈多型資料」，保證 Zod 驗證 100% 準確。
3. **無原型污染**：所有遍歷物件的 `for...in` 迴圈皆具備 `hasOwnProperty` 檢查與 `__proto__` 黑名單機制。
4. **無 UI 鎖死**：修復了 Radix UI Dialog 與 `pointer-events: none` 遺留造成的畫面凍結問題，並加入了全局防護重置機制。
