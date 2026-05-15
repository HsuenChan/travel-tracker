@AGENTS.md

// 請讀取 CLAUDE.md 裡的 Pending Tasks，我們從費用頁面的日期預設值開始做

# Project Status & Pending Tasks (April 22 Update)

## Current Context
正在優化費用（Expenses）頁面與行程（Itinerary）分頁。

## Pending Tasks (待處理需求)

### 1. 費用頁面 (Expenses Page)
- [ ] **排序邏輯**：
    - 列表需按照「新增時間」排序，最新的顯示在最上方（DESC）。
    - 需新增 UI 讓使用者可以選擇「排序欄位」與「升冪/降冪 (ASC/DESC)」切換。
- [ ] **結算功能**：在結算列表新增一個「已繳清」的確認勾選或狀態標記。

### 2. 行程頁面 (Itinerary Tab)
- [ ] **UX 優化 (Mobile)**：手機版容易誤觸地址觸發 Tooltips。
    - *思考方向*：調整觸發方式（例如：長按、點擊 icon 才顯示，或調整觸發區域），避免影響滾動體驗。

## Development Guidelines
- 保持 Next.js / React / Tailwind 的代碼風格一致性。
- 優先處理 Mobile 端的操作流暢度。
- **交付前必須自我驗證**：每次修改後，必須在腦中 trace 完整執行路徑，確認不會因為自己的改動引入明顯的 regression（例如把可運作的 effect deps 換掉、讓元件永遠卡在初始狀態等），不允許將顯而易見的 broken 狀態交給使用者。

## Git & Commit 規則
- Commit 一律以使用者本人名義提交，**不可加上 `Co-Authored-By: Claude` 之類的 AI 署名**。
- **Commit 前必須更新 README.md**：確認這次修改了哪些功能，並同步更新 README.md 中英文兩個區塊對應的功能說明。
