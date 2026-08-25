# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

**Live:** https://travel-tracker-nine-delta.vercel.app/
**Design Guideline:** https://hsuenchan.github.io/travel-tracker/design_guideline.html

---

## English

A modern, interactive personal travel journal. Log your trips, visualize routes on a 3D globe and interactive map, manage expenses, plan your itinerary, and generate AI-powered travel notes with ease.

### Key Features

- **Interactive 3D Globe** — WebGL rendering with animated flight arcs, region-level markers, and smooth transitions. Destinations stored as precise lat/lng coordinates via Nominatim / OpenStreetMap. Country flags auto-resolved from Nominatim ISO codes.
- **Route Tab** — Combine transport segments (flights, trains, buses) and an interactive Leaflet map in one view.
- **Rich Text Notes + AI** — Full Quill editor with six section chips that trigger AI-generated content (travel tips, packing list, transit guides, etc.) via Google Gemini. Shared across all trip members. Opens in read mode with an explicit edit toggle; unsaved edits are kept as a local draft (restored on return, with an unsaved-changes indicator) so switching tabs never loses work.
- **Itinerary Planning** — Multi-day events with a unified date-time range picker (end time optional). Timeline shows day-of-week labels, real-time weather forecasts, and per-item category icon nodes on the rail. Per-item rich text notes with clickable links, plus multiple photos per item (uploaded to Supabase Storage; the first photo becomes a full-width cover on top of the card with a +N badge and lightbox gallery).
- **Multi-Currency Expenses** — Track costs across currencies (TWD, EUR, JPY, …) with live exchange rates, sortable list, and automatic settlement calculations (all amounts converted to the trip's base currency). Settlement rows can be marked as paid, persisted to the database for all members. The form remembers the last payer and offers save-and-add-another for fast consecutive entry. Stats tab includes a clickable pie chart (desktop), a stacked proportion bar with category grid (mobile), monospaced amounts, and a per-member perspective view. Ended trips open the stats sub-tab by default.
- **AI Receipt Scan** — Photograph or upload a receipt and let Gemini extract the amount, currency, category, and description automatically into the expense form.
- **LINE Bot Expense Input** — Link a LINE group or DM to any trip via a one-time trip token. Quickly log expenses from LINE chat with support for description, amount, currency, payer, and split — synced to the web app in real time.
- **AI Ticket Import** — Extract flight details from boarding pass images or PDFs using Google Gemini.
- **Photo Wall** — Google Photos album integration with justified gallery layout, lazy loading, lightbox viewer (swipe to navigate, double-tap to zoom on mobile), and inline video playback.
- **Photo Frame Export** — Export any photo with a styled camera info bar: EXIF data (focal length, aperture, shutter speed, ISO, date/time), camera brand logo (Sony, Canon, Fujifilm, Leica, Nikon, Apple, Samsung, Vivo), and choice of aspect ratio (Original / 1:1 / 3:4 / 4:3 / 9:16 / 16:9), frame, and background color. Modal on desktop, bottom sheet on mobile.
- **Trip Mode & Quick-Expense FAB** — While a trip is in progress, opening it lands directly on today's itinerary. On mobile a floating "記帳" button is always within thumb reach, opening the expense form from any tab.
- **Sharing & Collaboration** — Generate shareable read-only links (with active tab preserved in URL). Trip members with edit access are automatically redirected to the full editor when opening a share link. Owners can remove members; members can leave trips.
- **Claim Your Identity After Joining** — When joining a trip, pick which existing split-bill member name represents you. Owners can manage member-name ↔ account bindings from the trip page. (Groundwork for upcoming expense-to-account integration.)
- **Souvenirs & Shopping List** — Card grid with custom tags, image upload, and quick check-off. Shows a completion progress bar; checked items sink to the bottom.
- **PWA & Offline Caching** — Local storage caching across all tabs with skeleton screens for fast perceived load.
- **Responsive UI** — Sidebar layout on desktop; on mobile a gooey bottom nav with a sliding indicator ball. Shared design components (TripHero, SegmentCard, MobileNav, PillButton) keep the app and public share pages visually in sync. LINE Seed TC display font for headline moments. Built with Tailwind CSS 4 and Ant Design 6.

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
| 2D Map | react-leaflet + Leaflet |
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

- **互動式 3D 地球儀** — WebGL 渲染飛行弧線動畫，目的地精確到地區層級座標（Nominatim / OpenStreetMap）。國旗 emoji 從 Nominatim ISO code 自動解析，無需維護硬編碼對照表。
- **路線分頁** — 整合交通段落（航班、火車、巴士）與 Leaflet 互動地圖。
- **筆記分頁（富文字 + AI）** — 完整 Quill 富文字編輯器，六個區塊 Chip 可觸發 AI 生成旅遊內容（旅遊注意事項、該帶什麼、地鐵攻略等），由 Google Gemini 驅動，所有成員共享。預設為閱讀模式、點「編輯」才進入編輯器；未儲存的編輯會自動存成本機草稿（回來時還原並提示），切換分頁不再遺失內容。
- **進階行程規劃** — 支援跨日事件與日期時間範圍選擇器（結束時間可留空），時間軸顯示星期標籤、每日即時天氣預報與逐筆類別 icon 節點，備註支援富文字與可點擊連結；每筆行程可上傳多張圖片（存於 Supabase Storage），第一張以全寬封面呈現於卡片頂部、多張顯示 +N 標記，點擊開啟燈箱可瀏覽全部。
- **旅途中模式與快速記帳** — 旅程進行期間打開旅程頁直接落在今日行程；手機版右下常駐「記帳」懸浮按鈕，任何分頁一鍵記帳。
- **多幣別費用追蹤** — 支援多種貨幣（TWD、EUR、JPY…）含即時匯率換算、可排序列表與自動結算（結算前一律換算成旅程主幣別）。應付款項可勾選「已繳清」並存入資料庫，全體成員同步。表單會記住上次付款人，並提供「儲存並繼續」快速連續記帳。統計分頁支援圓餅圖（桌機）與堆疊比例條＋類別格（手機）、金額等寬字型、個人視角切換；旅程結束後預設進入統計。
- **AI 收據掃描** — 拍攝或上傳收據，Gemini 自動解析金額、幣別、類別與摘要，直接填入費用表單。
- **LINE Bot 快速記帳** — 以旅程 Token 連結 LINE 群組或私訊，無需帳號綁定。支援金額、幣別、付款人與分攤設定，即時同步至網頁。
- **AI 機票自動匯入** — 透過 Google Gemini 解析登機證圖片或 PDF，一鍵填入航班資訊。
- **旅遊照片牆** — 整合 Google Photos 相簿，等比例磚牆佈局、懶加載、Lightbox 瀏覽（手機可滑動換圖、雙擊縮放）與影片內嵌播放。
- **照片框架匯出** — 為任一張照片加上相機資訊欄後匯出：顯示焦距、光圈、快門、ISO、拍攝時間，以及相機品牌 Logo（Sony、Canon、Fujifilm、Leica、Nikon、Apple、Samsung、Vivo）。可選擇畫面比例（Original / 1:1 / 3:4 / 4:3 / 9:16 / 16:9）、邊框與背景顏色。桌機顯示 Modal，手機顯示底部面板。
- **分享與共同編輯** — 可生成唯讀分享連結（URL 保留當前分頁狀態）。具編輯權限的成員開啟分享連結時自動跳轉至完整編輯介面。旅程擁有者可移除成員，成員可自行離開旅程。
- **加入旅程後認領身份** — 加入旅程時可認領你對應的既有分帳成員名稱，旅程擁有者可在旅程頁查看與管理「成員名稱 ↔ 帳號」綁定。（為日後支出自動歸戶功能鋪路）
- **伴手禮與購物清單** — 卡片式網格，支援自訂標籤篩選、圖片上傳與快速打勾；顯示完成進度條，已購買項目自動沉底。
- **PWA 與快取** — LocalStorage 暫存機制搭配骨架圖，確保網路不佳時操作依然流暢。
- **響應式介面** — 桌機側欄、手機抽屜，Tailwind CSS 4 + Ant Design 6。

### 技術架構

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| UI 元件庫 | Ant Design 6 + Tailwind CSS 4 |
| 3D 渲染 | react-globe.gl + Three.js |
| 2D 地圖 | react-leaflet + Leaflet |
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
