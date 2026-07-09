# 設定與操作手冊 (Operations Manual)

本手冊為管理員與一般使用者提供「Be a Good Person」配置編輯器 (Config UI) 的完整設定與操作指南。

## 1. 架構簡介

Config UI 是一個純前端的 PWA (Progressive Web App)，使用 React (Vite) + Zustand 建立。由於純前端應用無法安全地儲存 GitHub Personal Access Token (PAT)，我們實作了一個 **Cloudflare Worker** 作為中繼代理 (Proxy)。

- **前端 (Frontend)**: 負責 UI 展示、表單動態生成 (Zod JSON Schema)、本機草稿儲存 (IndexedDB)。
- **中繼代理 (Cloudflare Worker)**: 負責接收前端請求，驗證 `TEAM_PASSWORD`，加上 `GITHUB_PAT` 後轉發至 GitHub API。

---

## 2. 部署與環境配置 (管理員)

要讓 GitHub 同步功能正常運作，您必須部署 Cloudflare Worker 並設定環境變數。

### 2.1 產生 GitHub PAT
1. 前往 GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens。
2. 點擊 **Generate new token**。
3. **Repository access**: 選擇 **Only select repositories**，並選擇存放 JSON 設定檔的專案 (例如 `be-a-good-person`)。
4. **Permissions**:
   - `Contents`: **Read and write** (用於讀取與寫入檔案)。
   - `Pull requests`: **Read and write** (若未來需要發布 PR)。
5. 點選 Generate token，並**複製該 Token** (只會顯示一次)。

### 2.2 部署 Cloudflare Worker
1. 安裝 Wrangler CLI: `npm install -g wrangler`
2. 登入 Cloudflare: `wrangler login`
3. 切換至 `cloudflare-worker` 目錄: `cd cloudflare-worker`
4. 部署 Worker: `wrangler deploy`
   - 部署成功後，Wrangler 會在終端機輸出提供一組 URL (例如: `https://my-proxy.worker.dev`)。
   - **設定前端環境變數**：
     1. 回到前端專案的根目錄 (與 `package.json` 同層級)。
     2. 建立或編輯名為 `.env.production` 的檔案。
     3. 在檔案中新增以下內容，將 URL 替換為剛剛 Wrangler 產生的 URL：
        ```env
        VITE_WORKER_URL=https://my-proxy.worker.dev
        ```
     4. (可選) 如果您在本機開發測試 (使用 `npm run dev`) 時也需要連線至 Cloudflare Worker，可以將相同內容也寫入 `.env.development` 檔案中。
     5. 存檔後，Vercel 等前端部署平台在下次重新部署時就會自動套用這個網址，前端與中繼代理的連線便成功建立。
### 2.3 設定 Worker 密碼與 Token
為了保護代理伺服器不被濫用，必須設定以下 Secret 環境變數：

```bash
# 設定團隊密碼 (前端登入時需要輸入的密碼)
wrangler secret put TEAM_PASSWORD
# 終端機會提示您輸入值，請輸入您想設定的密碼 (例如: super-secret-pwd)

# 設定 GitHub PAT
wrangler secret put GITHUB_PAT
# 輸入剛剛從 GitHub 產生的 Token
```

---

## 3. 前端操作指南 (一般使用者)

### 3.1 啟動與登入
1. 開啟 Config UI 網頁。若是使用行動裝置，可以點擊瀏覽器的「加入主畫面」將其安裝為 PWA 應用程式。
2. 點擊右上方的「GitHub 登入」。
3. 輸入對應的資訊：
   - **Repository**: 輸入格式為 `Owner/Repo`，例如 `harud0s/Be-a-good-person-config-ui`。
   - **Team Password**: 輸入管理員發布的 `TEAM_PASSWORD`。
4. 點擊「Connect」。

### 3.2 編輯檔案與本機草稿
1. 登入後，左側側邊欄將列出 Repo 內的 JSON 檔案。
2. 點擊檔案開始編輯。表單會根據預先定義的 Schema 自動產生相對應的欄位與驗證。
3. **未儲存標示**: 若您修改了欄位，上方標題會顯示橘色的「未儲存」標籤。此時切換檔案或重整網頁會跳出警告，避免資料遺失。
4. **編輯清單項目**:
   - 若檔案是陣列結構，可點選卡片開啟「編輯抽屜」。
   - 在抽屜內修改後，點選下方「確定修改」即可將變更寫入該項目的暫存區。
   - ⚠️ 注意：單項目的「確定修改」僅更新畫面暫存，並未正式寫入本機或雲端。必須點選左下角的「儲存草稿 (Save Draft)」或上方的「提交至雲端 (Commit)」。
5. **儲存草稿**: 點擊左下方「儲存草稿」按鈕，可將當前所有修改儲存於瀏覽器本地 (IndexedDB)。關閉網頁後下次開啟仍可繼續編輯。

### 3.3 提交至雲端 (Commit)
1. 點擊右上方的「Commit」。
2. 對話框會列出您所有修改過且尚未提交的檔案。
3. 填寫 **Commit Message** (說明您修改了什麼) 與 **Author Name** (您的名稱，例如 `UserA`)。
4. 點擊「確認提交」。
5. 若成功，資料將自動推送到 GitHub Repo，並清除本機的未儲存標籤。

### 3.4 歷史紀錄 (History)
1. 滑鼠移至左側檔案列表的任一檔案。
2. 點擊出現的「時鐘」圖示。
3. 右側將滑出歷史紀錄抽屜，顯示該檔案最近的 5 次 Commit 紀錄。

### 3.5 匯出與匯入
若您在「本機模式 (Local Mode)」下作業，可使用右上方的工具列：
- **開啟資料夾**: 讀取本機電腦的目錄。
- **匯出 ZIP**: 將目前的工作區打包為 `.zip` 備份。
- **載入 ZIP**: 讀取先前的 `.zip` 備份檔。

---

## 4. 故障排除 (Troubleshooting)

| 問題現象 | 可能原因與解決方案 |
| :--- | :--- |
| **連線超時 (Timeout)** | 您的網路狀態不佳，或 Cloudflare Worker 無回應。系統設定 30 秒為限，請檢查網路後重試。 |
| **Authentication Failed (401)** | `TEAM_PASSWORD` 錯誤。請與管理員確認正確密碼並重新登入。 |
| **Bad Credentials (401 from GitHub)** | 管理員配置的 `GITHUB_PAT` 錯誤或已過期。請聯絡管理員重新執行 `wrangler secret put GITHUB_PAT`。 |
| **Not Found (404)** | 找不到對應的 GitHub Repo。請檢查您輸入的 `Owner/Repo` 格式與拼字是否正確，且該 PAT 具備存取該 Repo 的權限。 |
| **無法切換檔案** | 有未儲存的變更。請選擇「放棄修改」或先將變更儲存為草稿後再切換。 |
| **iOS / Safari 畫面上下滑動異常** | 已針對 PWA 修復此問題。若透過 Safari 瀏覽器直接開啟遇到拉扯現象，建議使用「加入主畫面」將其安裝為 App 開啟。 |

*Last Updated: 2026-07*
