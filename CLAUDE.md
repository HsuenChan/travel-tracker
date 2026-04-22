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
