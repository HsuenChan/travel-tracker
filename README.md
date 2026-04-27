# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

**Live:** https://travel-tracker-nine-delta.vercel.app/

---

## English

A modern, interactive personal travel journal. Log your trips, visualize routes on a 3D globe and interactive map, manage expenses, plan your itinerary, and generate AI-powered travel notes with ease.

### Key Features

- **Interactive 3D Globe** — WebGL rendering with animated flight arcs, region-level markers, and smooth transitions. Destinations stored as precise lat/lng coordinates via Nominatim / OpenStreetMap.
- **Route Tab** — Combine transport segments (flights, trains, buses) and an interactive Leaflet map in one view.
- **Rich Text Notes + AI** — Full Quill editor with six section chips that trigger AI-generated content (travel tips, packing list, transit guides, etc.) via Google Gemini. Shared across all trip members.
- **Itinerary Planning** — Multi-day events with a unified date-time range picker. Timeline shows day-of-week labels. Per-item rich text notes with clickable links.
- **Multi-Currency Expenses** — Track costs across currencies (TWD, EUR, JPY, …) with automatic settlement calculations.
- **LINE Bot Expense Input** — Quickly log expenses from LINE chat. Supports description, amount, currency, payer, and split — synced to the web app in real time.
- **AI Ticket Import** — Extract flight details from boarding pass images or PDFs using Google Gemini.
- **Photo Wall** — Google Photos album integration with masonry layout and skeleton loading.
- **Sharing & Collaboration** — Shareable links and co-editing for trip members. Member avatars shown on trip cards.
- **Souvenirs & Shopping List** — Card grid with custom tags, image support, and quick check-off.
- **PWA & Offline Caching** — Local storage caching across all tabs with skeleton screens for fast perceived load.
- **Responsive UI** — Sidebar layout on desktop, bottom-drawer on mobile. Built with Tailwind CSS 4 and Ant Design 6.

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
| Geocoding | Nominatim / OpenStreetMap |
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

### LINE Bot Setup

1. Create a channel at [LINE Developers](https://developers.line.biz/) → Messaging API
2. Set the webhook URL to `https://your-domain.com/api/line-webhook`
3. Copy `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` into `.env.local`
4. Copy the **Bot User ID** (Messaging API → Bot information) into `LINE_BOT_USER_ID`
5. In the app, open the LINE Bot panel (header icon) to get a binding code, then send it to the bot

**Expense format (1-on-1 or group chat):**

```
午餐 500
午餐 500 JPY
午餐 500 Eliza
```

After sending, the bot asks who to split with. Reply with numbers (`0` = everyone, `12` = persons 1 & 2), then confirm.

**Group chat:** Add the bot to a group and @mention it before any command (`@BotName /trips`). Pure number replies for split selection do not require a mention.

---

## 中文

現代化的互動式個人旅遊日誌。記錄旅程、在 3D 地球儀與互動地圖上視覺化路線、管理旅遊費用、安排行程，並透過 AI 一鍵生成旅遊筆記。

**線上版本：** https://travel-tracker-nine-delta.vercel.app/

### 核心功能

- **互動式 3D 地球儀** — WebGL 渲染飛行弧線動畫，目的地精確到地區層級座標（Nominatim / OpenStreetMap）。
- **路線分頁** — 整合交通段落（航班、火車、巴士）與 Leaflet 互動地圖。
- **筆記分頁（富文字 + AI）** — 完整 Quill 富文字編輯器，六個區塊 Chip 可觸發 AI 生成旅遊內容（旅遊注意事項、該帶什麼、地鐵攻略等），由 Google Gemini 驅動，所有成員共享。
- **進階行程規劃** — 支援跨日事件與日期時間範圍選擇器，時間軸顯示星期標籤，備註支援富文字與可點擊連結。
- **多幣別費用追蹤** — 支援多種貨幣（TWD、EUR、JPY…）並自動計算結算金額。
- **LINE Bot 快速記帳** — 直接在 LINE 聊天室輸入費用，支援金額、幣別、付款人與平分設定，即時同步至網頁。
- **AI 機票自動匯入** — 透過 Google Gemini 解析登機證圖片或 PDF，一鍵填入航班資訊。
- **旅遊照片牆** — 整合 Google Photos 相簿，瀑布流佈局與 Skeleton 載入效果。
- **分享與共同編輯** — 可生成分享連結或邀請隊友共同編輯；旅程卡片顯示成員頭像。
- **伴手禮與購物清單** — 卡片式網格，支援自訂標籤篩選、圖片預覽與快速打勾。
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
| 地理編碼 | Nominatim / OpenStreetMap |
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

### LINE Bot 設定

1. 前往 [LINE Developers](https://developers.line.biz/) 建立 Messaging API Channel
2. Webhook URL 設為 `https://your-domain.com/api/line-webhook`
3. 將 `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN` 填入 `.env.local`
4. 將 **Bot User ID**（Messaging API → Bot information）填入 `LINE_BOT_USER_ID`
5. 在 App 中開啟 LINE Bot 面板（Header 圖示）取得驗證碼，傳給 Bot 完成綁定

**記帳格式（私訊或群組皆可）：**

```
午餐 500
午餐 500 JPY
午餐 500 Eliza
```

傳送後 Bot 會詢問平分對象，回覆號碼（`0` = 全部，`12` = 第 1、2 人）後確認即完成記帳。

**群組使用：** 將 Bot 加入群組後，指令需先 @提及 Bot（`@BotName /trips`）。純數字回覆選擇平分對象時不需要 @mention。
