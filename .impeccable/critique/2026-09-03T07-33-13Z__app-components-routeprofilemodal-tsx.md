---
target: 路線彈窗與裝備分頁
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-09-03T07-33-13Z
slug: app-components-routeprofilemodal-tsx
---
⚠️ DEGRADED: single-context (harness 政策禁止未經要求呼叫 Agent 工具，A/B 未分離為 sub-agent；無瀏覽器工具且目標在登入後，跳過視覺檢視)

模式：Operate。目標：app/components/RouteProfileModal.tsx（路線彈窗）+ app/components/GearTab.tsx（裝備分頁）

## Design Health Score — 22/40（需要改善）

| # | 啟發式 | 分數 | 關鍵問題 |
|---|---|---|---|
| 1 | 系統狀態可見性 | 3 | 編輯中關掉會失去資料，完全沒有預警 |
| 2 | 系統與真實世界相符 | 2 | 缺少「繩距長度」——溪降真正用來決定帶繩的數字 |
| 3 | 使用者控制與自由 | 1 | 無 undo／草稿／關閉確認；途經點不能插入中間也不能排序 |
| 4 | 一致性與標準 | 3 | 殘留 cute-select 死 class；兩條視覺相似語意無關的長條 |
| 5 | 錯誤預防 | 2 | 海拔拒絕地名猜、匯入先預覽（對）；但編輯中關掉就沒了 |
| 6 | 辨識而非回憶 | 2 | 重量三態、第一個標籤＝主分類、圖上哪點是哪點都要靠記 |
| 7 | 彈性與效率 | 1 | 一條溪 40 點位＝320 個欄位；無貼上匯入／複製列／鍵盤流 |
| 8 | 美感與極簡 | 3 | 裝備頁在第一件裝備前疊了四塊摘要 |
| 9 | 錯誤復原 | 2 | 誤觸關閉無法救 |
| 10 | 說明與文件 | 3 | 重量三態在總覽卡沒有任何解釋 |

## Design Specificity
為這個產品而寫，非套版：去程時間帶、CanyonTopo 點位分組、雜湊配色分類格、LighterPack 先解析預覽。
Detector：1 warning（GearTab.tsx:1267 gray-on-color）＝**誤報**，兩組 class 在三元互斥分支。

## 整體印象
視覺完成度遠高於輸入效率。介面照資料模型長出來，不是照使用者手上的東西長出來。最大機會不是更漂亮，是讓資料進得來。

## 做得好
1. LighterPack「先解析預覽再寫入」——承認外部資料可能是壞的
2. 海拔只認座標不用地名猜——安全數字上的克制
3. 備註常用註記 chip——辨識而非回憶，且只在聚焦列展開

## Priority Issues
- **[P0] 編輯途經點沒有草稿保護**：onCancel 直接卸載、「取消」靜默丟棄；點遮罩／Esc／返回鍵即失去 40 列輸入。NotesTab 同 codebase 已有 localStorage 草稿的正解。修法：草稿存 localStorage（key 帶 itemId）＋關閉前 modal.confirm。→ /impeccable harden
- **[P0] 輸入量級差一個數量級**：8 欄位 × 40 點位 = 320 個輸入，編輯區僅 46vh。route_waypoints 至今 0 筆不是巧合。修法：(1) 貼上批次建立（textarea → 沿用預覽流程）(2) 插入與排序（現在只能加在最後）(3) 複製上一列。→ /impeccable distill、/impeccable shape
- **[P1] 裝備頁四塊摘要擋住清單**：手機上第一件裝備約在 hero 下 400px。打包時最高頻動作是勾掉一件，不是看總重。修法：重量卡收成可展開一行、分類格預設收起，或摘要移到底部固定條。→ /impeccable layout
- **[P1] 重量三態無解釋**：說明只存在於新增表單的 ROLES[].hint，總覽卡是三個沒有上下文的數字。基準重量是圈內術語。修法：三個標籤各加 info tooltip（InfoIcon 可複用）。→ /impeccable clarify
- **[P1] 總重是全隊相加**：四人隊的總重對任何個人都沒有意義；指標定義錯誤，不只是可見性。修法：預設顯示「我要揹的」，全隊總重降為次要（需先定個人／團體歸屬模型）。→ /impeccable shape
- **[P2] 缺少繩距長度**：guide book 每個垂降都標長度（50m/45m/26m），資料模型沒地方放。最長繩距直接決定帶幾條多長的繩。修法：route_waypoints 加 rappel_m，路線檢視加「垂降 29 段 · 最長 50m」，並與裝備頁繩長對照。→ /impeccable shape

## Persona 紅旗
- Alex（老手）：抄一本書 320 次輸入、跨 8 欄 Tab；漏抄中間點位只能加在最後 → 整段重打；Enter 不會新增下一列
- Jordan（新隊友）：三個重量數字無說明；「這段距離」與累積的關係只在編輯模式的 tooltip 裡；別人的個人裝備混在清單中
- 山上的 Eliza（手機單手）：編輯區 46vh 一次看一列多一點；「管理」12px 文字連結遠低於 44px 觸控目標；分類格可點但只有 hover 提示

## 次要觀察
- cute-select / custom-tags-select 死 class
- 重量占比條與打包進度條外觀相似、語意無關且上下相鄰
- 分類格沒有「全部」格
- 高度圖僅重點類型標名字，其他點需 hover——手機沒有 hover
- 管理彈窗的「未分類」用 — 表示不可刪，改 disabled 說明會更明確

## 值得想的問題
1. 如果貼上一段文字就能建立整條路線，這個編輯器還需要存在嗎？
2. 裝備頁第一屏只有「清單 + 一行總重」，會少了什麼嗎？
3. 「最長繩距 50m」出現在裝備頁繩子那列旁邊，行前檢查是否就不用翻兩個畫面？
4. 高度圖從「編輯的結果」變成「編輯的介面」（點圖新增點位），抄書會更快嗎？
