@AGENTS.md

# Travel Tracker

旅程記錄應用：行程規劃、多幣別分帳、照片牆、AI 筆記、3D 地球航跡，以及戶外／溪降的裝備清單與路線途經點。

產品定位與使用情境見 `PRODUCT.md`；完整功能清單見 `README.md`（中英雙語）；資料庫 migration 在 `supabase/`，依編號順序執行。

## Development Guidelines
- 保持 Next.js / React / Tailwind 的代碼風格一致性。
- 優先處理 Mobile 端的操作流暢度。
- **交付前必須自我驗證**：每次修改後，必須在腦中 trace 完整執行路徑，確認不會因為自己的改動引入明顯的 regression（例如把可運作的 effect deps 換掉、讓元件永遠卡在初始狀態等），不允許將顯而易見的 broken 狀態交給使用者。

## Git & Commit 規則
- Commit 一律以使用者本人名義提交，**不可加上 `Co-Authored-By: Claude` 之類的 AI 署名**。
- **Commit 前必須更新 README.md**：確認這次修改了哪些功能，並同步更新 README.md 中英文兩個區塊對應的功能說明。
