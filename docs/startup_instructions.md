# 專案啟動說明 (Startup Instructions)

## 環境需求
- **Node.js**: >= 18.x (建議使用最新的 LTS 版本)
- **NPM**: >= 9.x
- **推薦編輯器**: VS Code，並安裝 Tailwind CSS IntelliSense 與 ESLint 擴充套件。

## 本地開發啟動
1. 進入專案資料夾 (`config-ui_ws`)：
   ```bash
   cd c:\Howard_WorkSpace\Projects\be-a-good-person\config-ui\config-ui_ws
   ```
2. 安裝依賴套件 (如果尚未安裝)：
   ```bash
   npm install
   ```
3. 啟動開發伺服器：
   ```bash
   npm run dev
   ```
4. 預設情況下，應用程式將執行在 `http://localhost:5173`。

## 產品環境建置
如果你需要測試 PWA 功能或是將網頁部署，請執行：
```bash
npm run build
```
建置完成後，可以使用預覽模式檢視產出物：
```bash
npm run preview
```

## 功能測試與使用說明
1. **載入資料夾**：點擊首頁的「開啟資料夾」，並選擇包含了 `normal_events.json` 等遊戲設定檔的目錄 (例如 `examples/` 目錄)。
2. **編輯資料**：左側側邊欄會列出該資料夾下所有的 JSON 檔案。點擊任意檔案即可在中央的 `DynamicForm` 中進行編輯。
3. **型別防呆**：你可以嘗試在數值欄位（如 `hp_delta`）輸入英文字母。Zod 驗證器將會阻止儲存並在輸入框下顯示紅字錯誤。
4. **陣列折疊**：對於包含物件的陣列 (例如事件選項)，點擊即可展開/折疊該項目的編輯表單，使長列表更易於閱讀。
5. **重整/恢復工作階段**：在載入資料夾後，按 `F5` 重新整理頁面。此時畫面上方會出現「需要權限才能讀取」的按鈕，點擊並選擇「允許」即可一鍵恢復先前的開發狀態。
6. **ZIP 匯出與匯入**：測試點擊右上角的匯出與匯入按鈕，驗證專案結構與 JSON 內容是否完整。
