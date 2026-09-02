# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

**Live:** https://travel-tracker-nine-delta.vercel.app/
**Design Guideline:** https://hsuenchan.github.io/travel-tracker/design_guideline.html

---

## English

A modern, interactive personal travel journal. Log your trips, visualize routes on a 3D globe and interactive map, manage expenses, plan your itinerary, and generate AI-powered travel notes with ease.

### Key Features

- **Interactive 3D Globe** — WebGL rendering with animated flight arcs (all tracks shown by default), region-level markers, and smooth transitions. Destinations stored as precise lat/lng coordinates via Nominatim / OpenStreetMap. Country flags auto-resolved from Nominatim ISO codes. The trip drawer opens with a storytelling footprint summary — year span, trips, unique countries (counted by ISO code), and total travel days.
- **Route Tab** — Boarding-pass style cards for transport segments (flights, trains, buses).
- **Rich Text Notes + AI** — Full Quill editor with six section chips that trigger AI-generated content (travel tips, packing list, transit guides, etc.) via Google Gemini. Shared across all trip members. Opens in read mode with an explicit edit toggle; unsaved edits are kept as a local draft (restored on return, with an unsaved-changes indicator) so switching tabs never loses work. The toolbar covers headings, colours, links, lists, quotes, dividers and tables — tables are inserted by picking a size from a grid, and a row/column toolbar appears whenever the cursor sits inside one. Reading mode uses the same typography as the editor, so a note looks identical before and after saving. The same editor powers itinerary notes and trip descriptions.
- **Itinerary Planning** — Multi-day events with a unified date-time range picker (end time optional). Timeline shows day-of-week labels, real-time weather forecasts, and per-item category icon nodes on the rail. Per-item rich text notes with clickable links, plus multiple photos per item (downscaled client-side before upload to Supabase Storage; the first photo becomes a full-width cover on top of the card with a +N badge and lightbox gallery). A multi-day event shows up on every day it covers: the starting day keeps the full card, while each following day gets a slim bar with the item's name and how far into the stay it is ("住宿中 3/9 天"), plus the check-out time on the last day — tapping the bar jumps back to the full card. Days in the middle of a stay appear on the timeline even when nothing else is planned, and the weather forecast covers the whole span rather than just the starting day.
- **Multi-Currency Expenses** — Track costs across currencies (TWD, EUR, JPY, …) with live exchange rates, sortable list, and automatic settlement calculations (all amounts converted to the trip's base currency). Settlement rows can be marked as paid, persisted to the database for all members. The form remembers the last payer and offers save-and-add-another for fast consecutive entry. Stats tab includes a clickable pie chart (desktop), a stacked proportion bar with category grid (mobile), monospaced amounts, and a per-member perspective view. Ended trips open the stats sub-tab by default.
- **Expenses Linked to the Itinerary** — Every itinerary card carries a running total of what has been spent on it, sitting at the end of the time / category / location row (per currency, no conversion). Tapping that amount opens a compact expense form already filled in with the item's name, category, and date, so a cost can be logged without leaving the itinerary. Items with nothing spent yet show a zero amount that works as the same entry point. The expense list can be filtered down to a single itinerary item, and a link can be changed or removed from the expense form.
- **AI Receipt Scan** — Photograph or upload a receipt and let Gemini extract the amount, currency, category, and description automatically into the expense form.
- **LINE Bot Expense Input** — Link a LINE group or DM to any trip via a one-time trip token. Quickly log expenses from LINE chat with support for description, amount, currency, payer, and split — synced to the web app in real time.
- **AI Ticket Import** — Extract flight details from boarding pass images or PDFs using Google Gemini.
- **Photo Wall** — Google Photos album integration with justified gallery layout, lazy loading, lightbox viewer (swipe to navigate, double-tap to zoom on mobile), and inline video playback.
- **Photo Frame Export** — Export any photo with a styled camera info bar: EXIF data (focal length, aperture, shutter speed, ISO, date/time), camera brand logo (Sony, Canon, Fujifilm, Leica, Nikon, Apple, Samsung, Vivo), and choice of aspect ratio (Original / 1:1 / 3:4 / 4:3 / 9:16 / 16:9), frame, and background color. Modal on desktop, bottom sheet on mobile.
- **Trip Mode & Quick-Expense FAB** — While a trip is in progress, opening it lands directly on today's itinerary. Landing always respects the trip's visible-tab setting: with the itinerary tab hidden it opens the first visible tab instead, and hiding the tab you are currently on moves you to the first visible one. The trip hero uses the first itinerary photo as a cover with a "Day N / M" progress pill and bar, home-page trip cards show the same cover, and the timeline rail tints the days already travelled. On mobile a floating "記帳" button is always within thumb reach, opening the expense form from any tab.
- **Trip Recap & Celebrations** — When a trip ends, a recap card (days · itinerary items · unique places) appears under the hero with a one-time confetti burst. Marking the last outstanding settlement as paid also celebrates with confetti.
- **Sharing & Collaboration** — Generate shareable read-only links (with active tab preserved in URL). Shared links preview as “Trip name - Travel Tracker” with the trip's own hero photo as the thumbnail. Trip members with edit access are automatically redirected to the full editor when opening a share link. Member avatars sit at the end of the hero pill row (with loading skeletons); owners can remove members, members can leave trips, and split-name ↔ account binding opens as a modal — from the action row on desktop, from the trip menu on mobile.
- **Claim Your Identity After Joining** — When joining a trip, pick which existing split-bill member name represents you. Owners can manage member-name ↔ account bindings from the trip page. (Groundwork for upcoming expense-to-account integration.)
- **Gear & Packing List** — Build the pack item by item with a per-unit weight and quantity, and read the three numbers that decide whether the bag is carryable: base weight, worn, and consumables, with the total on top. Categories are free-form tags, so the list can be organised any way you like; the grid underneath shows the item count and weight sitting in each category, and the nine classic hiking categories stay in the grid even when empty — the one you forgot to pack is the one drawn with a dashed border. Tap a category to filter, tick items off as they go into the bag, and hand group gear to a specific travel companion. Weight takes grams or kilograms and can be left blank until something has actually been weighed. The tab is off by default and turned on per trip, and it works just as well as a suitcase list checked against an airline weight limit.
- **Personal Gear Closet & LighterPack Import** — Anything on a trip's list can be saved into a personal closet that lives outside any single trip, then ticked back into the next trip in a couple of taps; the closet skips gear it already holds instead of stacking duplicates. An existing LighterPack list can come in two ways: upload the file from its Share → Export to CSV, or paste the share link. Either way the list is parsed and shown first — how many items, what they weigh, how many rows were skipped — and only then written into the trip list or the closet. Ounces, pounds and kilograms are converted on the way in, and LighterPack's worn / consumable flags land on the matching weight role.
- **Souvenirs & Shopping List** — Switch between a card grid and a compact list, with the choice remembered for next time. Custom tags, image upload, and quick check-off throughout; items without a photo simply skip the image area instead of showing a placeholder. Shows a completion progress bar; checked items slide down to the bottom so it stays obvious which one was just ticked off.
- **PWA & Offline Caching** — Local storage caching across all tabs with skeleton screens for fast perceived load.
- **Responsive UI** — Sidebar layout on desktop; on mobile a gooey bottom nav with a sliding indicator ball. Shared design components (TripHero, SegmentCard, MobileNav, PillButton) keep the app and public share pages visually in sync. LINE Seed TC display font for headline moments. Built with Tailwind CSS 4 and Ant Design 6.

### Roadmap

Planned, in rough priority order:

- A trip plan sheet for the person staying behind — emergency contacts, agreed check-in times, retreat plan — built on the read-only share link, printable for permit applications
- Turnaround time per itinerary item, marked on the timeline
- Richer daily weather: sunrise and sunset, feels-like temperature, chance of rain, wind, corrected for altitude
- A pre-trip training plan counted back from the departure date, generated from the route's own distance, ascent, and pack weight
- A food and supplement trial log that carries across trips
- GPX import for distance and ascent statistics and globe tracks
- Trip templates that only preset which tabs and categories a new trip starts with

Deliberately out of scope: offline maps, GPX navigation, and live track recording.

### Tech Stack

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Ant Design 6 + Tailwind CSS 4 |
| 3D Rendering | react-globe.gl + Three.js |
| Rich Text | react-quill-new (Quill) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth) |
| AI | Google Gemini 2.5 Flash |
| Image Processing | Sharp + exifr |
| Geocoding | Nominatim / OpenStreetMap |
| Weather | Open-Meteo |
| LINE Bot | LINE Messaging API |

### Local Development

**1. Clone & install**

```bash
git clone git@github.com:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. Environment variables**

Copy `.env.local.example` → `.env.local` and fill in your credentials:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

LINE_BOT_USER_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_LINE_BOT_URL=https://line.me/R/ti/p/@your-bot-id
```

**3. Run**

```bash
npm run dev
```

### Database Setup

Run the SQL files in `supabase/` in order via the [Supabase SQL Editor](https://supabase.com/dashboard):

| File | Purpose |
|---|---|
| `01_schema.sql` | Core tables (trips, expenses, itinerary, etc.) |
| `02_line_bot.sql` | LINE Bot integration tables |
| `03_member_links.sql` | Maps trip member names to authenticated accounts |
| `04_itinerary_images.sql` | Itinerary item photos (`image_urls` array + storage bucket; safe to re-run) |
| `05_settlement_paid.sql` | Persistent settlement paid marks (incl. RLS policies; safe to re-run) |
| `06_expense_itinerary_link.sql` | Links expenses to itinerary items (`itinerary_item_id`; safe to re-run) |
| `07_gear.sql` | Gear / packing list per trip (weights, categories, carrier; safe to re-run) |
| `08_gear_closet.sql` | Personal gear closet reused across trips (incl. RLS policy; safe to re-run) |

### LINE Bot Setup

1. Create a channel at [LINE Developers](https://developers.line.biz/) → Messaging API
2. Set the webhook URL to `https://your-domain.com/api/line-webhook`
3. Copy `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` into `.env.local`
4. Copy the **Bot User ID** (Messaging API → Bot information) into `LINE_BOT_USER_ID`
5. In the app, open any trip → LINE Bot button → copy the trip token, then send it to the bot in LINE

**Linking a chat to a trip:**

Send the trip token (format `TRIP-XXXX-XXXX`) in a LINE 1-on-1 or group chat. The bot confirms the link and the chat is now bound to that trip.

**Expense format (after linking):**

```
午餐 500
午餐 500 JPY
午餐 500 Eliza
```

After sending, the bot asks who to split with. Reply with numbers (`0` = everyone, `12` = persons 1 & 2), then confirm.

**Group chat:** Add the bot to a group, send the trip token once to link. Subsequent expense messages and number replies do not require @mention.

---

## 中文

現代化的互動式個人旅遊日誌。記錄旅程、在 3D 地球儀與互動地圖上視覺化路線、管理旅遊費用、安排行程，並透過 AI 一鍵生成旅遊筆記。

**線上版本：** https://travel-tracker-nine-delta.vercel.app/

### 核心功能

- **互動式 3D 地球儀** — WebGL 渲染飛行弧線動畫（預設顯示全部航跡），目的地精確到地區層級座標（Nominatim / OpenStreetMap）。國旗 emoji 從 Nominatim ISO code 自動解析，無需維護硬編碼對照表。旅程清單開頭以說故事語氣呈現旅遊足跡——年份跨度、趟數、國家數（以 ISO 國碼去重）與旅遊總天數。
- **路線分頁** — 登機證風格的交通段落卡片（航班、火車、巴士）。
- **筆記分頁（富文字 + AI）** — 完整 Quill 富文字編輯器，六個區塊 Chip 可觸發 AI 生成旅遊內容（旅遊注意事項、該帶什麼、地鐵攻略等），由 Google Gemini 驅動，所有成員共享。預設為閱讀模式、點「編輯」才進入編輯器；未儲存的編輯會自動存成本機草稿（回來時還原並提示），切換分頁不再遺失內容。工具列涵蓋標題、顏色、連結、清單、引言、分隔線與表格；表格以格線選擇尺寸後插入，游標移入表格時會展開增減列／欄與刪除表格的操作列。閱讀模式與編輯模式使用同一套排版，存檔前後看到的版面完全一致。行程備註與旅程簡介也使用同一個編輯器。
- **進階行程規劃** — 支援跨日事件與日期時間範圍選擇器（結束時間可留空），時間軸顯示星期標籤、每日即時天氣預報與逐筆類別 icon 節點，備註支援富文字與可點擊連結；每筆行程可上傳多張圖片（上傳前先在瀏覽器端縮圖壓縮，存於 Supabase Storage），第一張以全寬封面呈現於卡片頂部、多張顯示 +N 標記，點擊開啟燈箱可瀏覽全部。跨日行程（連住飯店、租車、周遊券）會出現在它覆蓋的每一天：開始日保留完整卡片，後續每天顯示一條精簡狀態條，標示名稱與「住宿中 3/9 天」，最後一天再加上退房時間，點一下即跳回完整卡片並短暫高亮。住宿期間即使沒有其他安排，那幾天也會出現在時間軸上，天氣預報同時涵蓋整段日期，不再只查到開始日。
- **旅途中模式與快速記帳** — 旅程進行期間打開旅程頁直接落在今日行程；落點一律遵守該旅程的「顯示分頁」設定 —— 沒有啟用行程分頁時會落在啟用清單的第一個分頁，把目前所在的分頁關掉時也會自動跳到第一個分頁；hero 以行程第一張照片為封面並顯示「第 N / M 天」進度 pill 與進度條，首頁旅程卡片同步顯示封面照，時間軸已走過的路段會上色。手機版右下常駐「記帳」懸浮按鈕，任何分頁一鍵記帳。
- **旅程回顧與慶祝** — 旅程結束後 hero 下方顯示回顧卡（天數・行程數・地點數），首次打開撒一次彩帶；結算最後一筆繳清時也會有彩帶慶祝。
- **多幣別費用追蹤** — 支援多種貨幣（TWD、EUR、JPY…）含即時匯率換算、可排序列表與自動結算（結算前一律換算成旅程主幣別）。應付款項可勾選「已繳清」並存入資料庫，全體成員同步。表單會記住上次付款人，並提供「儲存並繼續」快速連續記帳。統計分頁支援圓餅圖（桌機）與堆疊比例條＋類別格（手機）、金額等寬字型、個人視角切換；旅程結束後預設進入統計。
- **行程與記帳打通** — 每張行程卡在「時間 / 類型 / 地點」那一列的尾端顯示掛在該行程的花費合計（跨幣別並列，不換匯）。點金額直接開記帳表單，行程名稱、類型與日期都已帶入，不用切到費用分頁；還沒有花費的行程顯示 0，點下去就是新增第一筆。費用列表可依關聯行程篩選，也能在費用表單裡改綁或解除關聯。
- **AI 收據掃描** — 拍攝或上傳收據，Gemini 自動解析金額、幣別、類別與摘要，直接填入費用表單。
- **LINE Bot 快速記帳** — 以旅程 Token 連結 LINE 群組或私訊，無需帳號綁定。支援金額、幣別、付款人與分攤設定，即時同步至網頁。
- **AI 機票自動匯入** — 透過 Google Gemini 解析登機證圖片或 PDF，一鍵填入航班資訊。
- **旅遊照片牆** — 整合 Google Photos 相簿，等比例磚牆佈局、懶加載、Lightbox 瀏覽（手機可滑動換圖、雙擊縮放）與影片內嵌播放。
- **照片框架匯出** — 為任一張照片加上相機資訊欄後匯出：顯示焦距、光圈、快門、ISO、拍攝時間，以及相機品牌 Logo（Sony、Canon、Fujifilm、Leica、Nikon、Apple、Samsung、Vivo）。可選擇畫面比例（Original / 1:1 / 3:4 / 4:3 / 9:16 / 16:9）、邊框與背景顏色。桌機顯示 Modal，手機顯示底部面板。
- **分享與共同編輯** — 可生成唯讀分享連結（URL 保留當前分頁狀態），連結貼到通訊軟體會顯示「旅程名稱 - Travel Tracker」與該趟旅程的封面照縮圖。具編輯權限的成員開啟分享連結時自動跳轉至完整編輯介面。成員頭像顯示於 hero pill 列尾端（載入時有骨架佔位）；旅程擁有者可移除成員，成員可自行離開旅程，「分帳綁定」以彈窗設定，桌機版從動作列進入、手機版從旅程選單進入。
- **加入旅程後認領身份** — 加入旅程時可認領你對應的既有分帳成員名稱，旅程擁有者可在旅程頁查看與管理「成員名稱 ↔ 帳號」綁定。（為日後支出自動歸戶功能鋪路）
- **伴手禮與購物清單** — 可切換「卡片」與「列表」兩種檢視，選擇會記住下次沿用。支援自訂標籤篩選、圖片上傳與快速打勾；沒有照片的項目不會顯示佔位圖。顯示完成進度條，已購買項目會以滑動動畫沉到底部，看得出剛剛勾掉的是哪一項。
- **裝備清單與重量** — 逐件記下裝備、單件重量與數量，頂部直接看到總重，以及決定背包揹不揹得動的三個數字：基準重量、穿著、消耗。分類使用自由標籤，想怎麼分就怎麼分；下方分類格顯示每個分類的件數與重量，登山裝備九宮格的九個分類即使一件都沒帶也會留在格子裡——漏掉的那一格會以虛線框浮出來。點分類可篩選，裝進背包就打勾，團體裝備可以指定由哪位隊友揹。重量可用公克或公斤輸入，還沒秤的先留空。分頁預設關閉、每趟旅程自行開啟；一般旅遊當成行李清單、對照航空公司重量限制也一樣好用。
- **個人裝備櫃與 LighterPack 匯入** — 清單上的裝備可以存進不屬於任何一趟旅程的個人裝備櫃，下一趟勾幾下就套用回來；櫃子裡已經有的同一件不會再重複堆一份。已經記在 LighterPack 上的清單有兩條路可以進來：用它的 Share → Export to CSV 匯出檔案上傳，或直接貼分享連結。兩條路都會先解析並顯示結果——幾件、總共多重、略過了幾列——確認後才寫進旅程清單或裝備櫃。盎司、英磅、公斤在匯入時統一換算，LighterPack 的 worn / consumable 也會對應到相同的重量身份。
- **PWA 與快取** — LocalStorage 暫存機制搭配骨架圖，確保網路不佳時操作依然流暢。
- **響應式介面** — 桌機側欄佈局；手機底部為 gooey 果凍導覽列（小球滑動指示）。共用設計元件（TripHero、SegmentCard、MobileNav、PillButton）讓 App 與公開分享頁視覺一致，標題時刻使用 LINE Seed TC 字型。Tailwind CSS 4 + Ant Design 6。

### 未來規劃

依優先順序排列：

- 留守人頁面 —— 緊急聯絡人、約定的回報時間、撤退計畫 —— 建在唯讀分享連結上，可列印給入園申請使用
- 每筆行程的撤退／關門時間，並在時間軸上標記
- 更完整的每日天氣：日出日落、體感溫度、降雨機率、風速，並依海拔校正
- 依出發日回推的行前訓練計畫，以該條路線的里程、爬升與背包重量生成
- 跨旅程累積的補給與行動糧試用紀錄
- GPX 匯入，取里程與爬升統計並在 3D 地球上畫出軌跡
- 建立旅程時的範本，只決定新旅程預設開啟哪些分頁與分類

明確不做：離線地圖、GPX 導航、即時軌跡記錄。

### 技術架構

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| UI 元件庫 | Ant Design 6 + Tailwind CSS 4 |
| 3D 渲染 | react-globe.gl + Three.js |
| 富文字編輯器 | react-quill-new (Quill) |
| 資料庫 | Supabase (PostgreSQL) |
| 身份驗證 | Supabase Auth（Google OAuth）|
| 人工智慧 | Google Gemini 2.5 Flash |
| 影像處理 | Sharp + exifr |
| 地理編碼 | Nominatim / OpenStreetMap |
| 天氣預報 | Open-Meteo |
| LINE Bot | LINE Messaging API |

### 本機開發

**1. 下載並安裝**

```bash
git clone git@github.com:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. 環境變數**

將 `.env.local.example` 複製為 `.env.local` 並填入：

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

LINE_BOT_USER_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_LINE_BOT_URL=https://line.me/R/ti/p/@your-bot-id
```

**3. 啟動開發伺服器**

```bash
npm run dev
```

### 資料庫設定

於 [Supabase SQL Editor](https://supabase.com/dashboard) 依序執行 `supabase/` 資料夾內的 SQL 檔案：

| 檔案 | 用途 |
|---|---|
| `01_schema.sql` | 核心資料表（旅程、費用、行程等） |
| `02_line_bot.sql` | LINE Bot 整合資料表 |
| `03_member_links.sql` | 將旅程成員名稱對應到已登入帳號 |
| `04_itinerary_images.sql` | 行程照片（`image_urls` 陣列＋Storage bucket，可重複執行） |
| `05_settlement_paid.sql` | 結算繳清標記（含 RLS policy，可重複執行） |
| `06_expense_itinerary_link.sql` | 費用與行程的關聯欄位（`itinerary_item_id`，可重複執行） |
| `07_gear.sql` | 每趟旅程的裝備清單（重量、分類、揹負者，可重複執行） |
| `08_gear_closet.sql` | 跨旅程共用的個人裝備櫃（含 RLS policy，可重複執行） |

### LINE Bot 設定

1. 前往 [LINE Developers](https://developers.line.biz/) 建立 Messaging API Channel
2. Webhook URL 設為 `https://your-domain.com/api/line-webhook`
3. 將 `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN` 填入 `.env.local`
4. 將 **Bot User ID**（Messaging API → Bot information）填入 `LINE_BOT_USER_ID`
5. 在 App 中開啟任一旅程 → LINE Bot 按鈕 → 複製旅程 Token，並將其傳送給 Bot

**連結聊天室與旅程：**

在 LINE 私訊或群組中傳送旅程 Token（格式：`TRIP-XXXX-XXXX`），Bot 確認後該聊天室即與旅程綁定。

**記帳格式（連結後即可使用）：**

```
午餐 500
午餐 500 JPY
午餐 500 Eliza
```

傳送後 Bot 會詢問平分對象，回覆號碼（`0` = 全部，`12` = 第 1、2 人）後確認即完成記帳。

**群組使用：** 將 Bot 加入群組後，傳送一次旅程 Token 完成連結。後續記帳及數字回覆均不需 @mention。
