---
target: 旅程頁（app/trips/[id] + 五個分頁）
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-25T04-00-45Z
slug: app-trips-id-page-tsx
---
Method: dual-agent (A: 設計總監審查 agent · B: 偵測器掃描 agent)

# Travel Tracker 旅程頁設計體檢（Operate 模式）

## Design Health Score

| # | Heuristic | 分數 | 關鍵發現 |
|---|-----------|------|---------|
| 1 | 系統狀態可見性 | 3 | 剪貼簿寫入失敗零回饋；AI 排程/健康檢查失敗靜默 |
| 2 | 貼近真實世界 | 3 | 「⚕ 健康」沒人猜得到是行程衝突檢查；Switch 顯示英文 ON/OFF |
| 3 | 使用者控制與自由 | 3 | 刪除有 5 秒復原是亮點；但伴手禮/AI modal 吃不到返回鍵 |
| 4 | 一致性與標準 | 2 | 兩套按鈕、violet/purple 兩種紫、emoji vs SVG、四種空狀態 |
| 5 | 錯誤預防 | 3 | 繳清標記 key 不含金額，金額改了標記還在 |
| 6 | 辨識而非回憶 | 3 | 「點日期跳下一天」只藏在 hover title，手機不可發現 |
| 7 | 彈性與效率 | 3 | 記帳加速器誠意十足；缺鍵盤捷徑與批次操作 |
| 8 | 美學與極簡 | 3 | 費用列表四排控制先於內容 |
| 9 | 錯誤復原 | 2 | 失敗狀態說謊：載入失敗被顯示成「沒有資料/找不到旅程」 |
| 10 | 說明與文件 | 3 | 筆記操作說明對比 1.5:1 等於沒寫 |
| **合計** | | **28/40** | **Good — 底子扎實，弱點集中在一致性與失敗路徑** |

## 設計特定性判定

**為這個產品打造的介面，不是模板。** 目的地漸層配色、台灣時間標註、天氣 chip、今日自動捲動、LINE Bot 記帳 — 全是這個產品的敘事，六個分頁說同一種視覺語言。性格漏氣處：antd 原生元件穿幫（伴手禮整顆 purple antd Button、照片牆的原生 Button）、emoji 直出（✦ ⚕ 🔴🟡🟢 ☀️）與自家 SVG icon 系統並存。

**確定性掃描（偵測器）**：5 筆 `gray-on-color` 警告，逐行驗證後全數為誤報（hover 修飾詞與三元互斥分支的字串比對誤判）；6 檔中 3 檔完全乾淨、零 error 級發現 — 底層顏色紀律良好。瀏覽器視覺化不可用（本環境無瀏覽器自動化工具），無 overlay。

## 整體印象

有真實產品性格、對高頻任務理解深刻的介面 — 記帳流程與 URL 狀態管理是專業水準。拖後腿的不是設計品味，是**失敗路徑的誠實度**與**收尾紀律**。修完三個 P1 就有 32+ 的底子。

## 做得好的地方

1. **URL 驅動的 modal/tab 狀態**：返回鍵關 modal、tab 用 replace、分享連結帶 ?tab= — web PWA 少見的原生手感
2. **記帳摩擦最小化**：今天＋上次付款人＋全員分攤預設、收據 AI 解析、儲存並繼續 — 最高頻任務被當最高頻對待
3. **刪除即復原＋樂觀更新有回滾**：對「資料可信」原則的正確落地

## 優先問題

- **[P1] 失敗狀態說謊**：fetchSegments 失敗渲染「還沒有交通記錄」（page.tsx:270-286）；fetchTrip 網路失敗顯示「找不到這筆旅程」（page.tsx:415-422）。旅途弱網是主場景，這直接摧毀資料信任。修法：套用 ItineraryTab 已有的「載入失敗＋重新載入」模式。→ /impeccable harden
- **[P1] 低對比文字系統性違規**：text-zinc-600（2.6:1）與 zinc-500（4.1:1）承載正文級資訊（IATA、台灣時間、分攤名單），戶外看不見。修法：資訊文字最低 zinc-400，zinc-600 只准裝飾。→ /impeccable audit
- **[P1] 分享/邀請剪貼簿無錯誤處理**：clipboard.writeText 無 catch（page.tsx:353-395），iOS 失敗時顯示成功；toast 塞整串 URL 折行成災。修法：手機改 navigator.share()，clipboard 作 fallback＋catch。→ /impeccable harden
- **[P2] more-sheet z-index 錯層**：遮罩 z-210 < 底部導航 z-400 < sheet z-401，sheet 開著時背後 tab 仍可點。→ /impeccable polish
- **[P2] 一致性斷層**：兩套按鈕、兩種紫、emoji vs SVG、伴手禮 modal 不吃返回鍵。修法：抽 PillButton、色票收斂 violet、emoji 全換 Icons.tsx。→ /impeccable extract + polish

## Persona 紅旗

**Alex（高效老手）**：連記 5 筆帳留 5 個歷史項要按 5 次返回；無鍵盤捷徑；健康檢查失敗靜默像壞掉。
**Sam（無障礙依賴）**：照片牆完全鍵盤不可達（div onClick 無 tabIndex）；lightbox ‹›✕ 無 aria-label；底部導航選中態只靠顏色、無 aria-current；more-sheet 無 focus trap。
**Casey（單手手機）**：「新增費用」在內容區頂端右側非拇指區，最高頻動作無 FAB；金額輸入未設 inputMode="decimal" 跳全鍵盤；排序箭頭 20px、繳清圈 24px 低於 44px 底線；伴手禮點圖片＝誤切已購且失敗無回滾。

## 次要觀察

header 缺底色 tint 對比不穩；shareUrl 字串拼接可能雙問號；天氣只取第一目的地（多國後半錯誤）；手機統計圓餅 148px 淪為裝飾；刪除整趟旅程與刪一筆費用防護等級相同；SouvenirsTab 用裸 fetch；費用空狀態沒推銷收據解析與 LINE Bot。

## 挑釁性問題

1. 第 20 次打開 app 的人要的不是 hero — 敢不敢做「旅途中模式」：旅程期間打開直接落在今日行程＋常駐快速記帳？
2. LINE Bot 證明你們懂「把記帳搬到使用者所在之處」，app 內記帳為何還藏在第三個 tab 的右上角？一顆 FAB 讓 3 步變 1 步。
3. 「大家都平了」、伴手禮 100%、旅程結束日 — 三個天然峰終時刻現在全是靜態文字。哪個先變成值得截圖傳群組的畫面？那是免費的成長迴路。
