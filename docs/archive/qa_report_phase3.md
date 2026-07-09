# Phase 3 & 4 實作計畫 QA 審核報告

**審核日期**: 2026-06-30
**目標**: 確保 Phase 3 (資料防護與型別驗證 Zod Integration) 與 Phase 4 (PWA 封裝與離線化) 的架構設計穩定且可執行。
**審核機制**: 三位獨立 QA Agent (Reviewer 13, 14, 15) 進行深度程式碼分析與計畫驗證。

## 審核總結：✅ 准予執行 (Approved)

三位 QA 皆一致同意現有實作計畫（`implementation_plan.md`）的架構設計，並針對特定細節提出了微調建議。

### 1. Zod 型別驗證與型別轉換 (Phase 3)
*   **優點 (Pros)**：
    *   **精準控制**：使用 `typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))` 有效解決了 `!isNaN` 的陷阱，避免將空字串誤判為數字。
    *   **白名單機制**：放棄了不穩定的正則表達式，改用明確定義的 `NUMERIC_KEYS` Set 進行數字轉型，使得資料存檔回退機制安全無虞。
    *   **Soft Validation 雙軌制**：區分「平常編輯」與「強制儲存」，透過 `onError` 提示錯誤但容許保留，極大地體貼了使用者「編輯到一半想暫存」的需求。
*   **建議 (Suggestions)**：
    *   針對混合型別 (如 `hp_delta` 可為字串或數字)，建議使用 `z.preprocess` 來處理 `null` 轉換，徹底避免 Zod Coerce `Number('') === 0` 導致的意外行為。

### 2. 幽靈物件剔除與多型架構 (Phase 3)
*   **優點 (Pros)**：
    *   **預留空物件解法**：在 `templates.ts` 中預留空物件 (如 `bid: {}`) 成功解決了 React Hook Form 無法綁定未定義深層欄位的問題。
    *   **資料淨化機制**：實作帶入 `meta` 參數的 `sanitizeData` 函數，在存檔時將未使用的多型物件（如切換為 `normal` 後殘留的 `exam` 資料）徹底剔除，確保寫入磁碟的 JSON 是純淨的。

### 3. PWA 與跨平台儲存降級方案 (Phase 4)
*   **優點 (Pros)**：
    *   **跨平台相容**：明確區分 Desktop (File System Access API) 與 Mobile (ZIP 匯入/匯出) 的儲存策略。
    *   **對稱設計**：透過遞迴掃描目錄 (Recursive Directory Traversal) 確保兩種環境在 `store.ts` 與介面呈現 (FileEntry 結構) 上的完全一致。
*   **未來展望與建議 (Future Outlook)**：
    *   **無障礙優化**：建議在實作 UI 變更時，為折疊面板等元件加上適當的 `role` 與 `tabIndex`。
    *   **工作區持久化**：Desktop 環境雖然可以使用 API，但可以透過 `idb-keyval` 將 directory handle 存入 IndexedDB，下次開啟時直接載入工作區。

## 下一步行動 (Next Steps)
按照 `implementation_plan.md`，我們已獲得充分核准，接下來將開始：
1. 安裝 `jszip` 與相關套件。
2. 實作 `src/schemas.ts` 建立 Zod 驗證規則。
3. 改造 `store.ts` 的遞迴存取機制。
4. 將 Zod 與 `DynamicForm.tsx` 串接並實作 `sanitizeData` 的多型淨化功能。
