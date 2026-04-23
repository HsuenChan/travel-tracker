# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

---

## English

A modern, interactive personal travel journal. Log your trips, visualize routes on a 3D globe and interactive map, manage expenses, plan your itinerary, and generate AI-powered travel notes with ease.

**Live:** https://travel-tracker-nine-delta.vercel.app/

### Key Features

- **Interactive 3D Globe** — High-performance WebGL rendering with animated flight arcs, region-level markers, and smooth transitions. Destinations are stored as precise lat/lng coordinates (powered by Nominatim / OpenStreetMap) rather than country-level centroids.
- **Unified Route Tab** — Combine transport segments (flights, trains, buses) and an interactive Leaflet map in one place, clearly separated into two sections.
- **Rich Text Notes Tab** — A dedicated Notes tab with a full Quill rich-text editor (headings H1–H3, bold, italic, links, lists, text colour). Six section chips let you insert headings or trigger AI-generated content (travel tips, packing list, driving, metro, bus, transit) — all backed by Google Gemini and shared with all trip members.
- **Advanced Itinerary Planning** — Support for multi-day events with a unified range picker (date & time). Timeline shows day-of-week labels. Rich-text notes per item with clickable links.
- **Multi-Currency Expenses** — Track costs in different currencies (e.g., TWD, EUR, JPY) with automatic primary currency handling and settlement calculations.
- **AI-Powered Ticket Import** — Automatically extract flight details from boarding pass images or PDFs using Google Gemini.
- **Photo Wall** — Seamlessly integrated Google Photos albums with a beautiful masonry-style layout and skeleton loading.
- **Social Sharing & Collaboration** — Generate shareable links for friends or invite partners to co-edit your trip details. Member avatars are displayed on the trip card.
- **Souvenirs & Shopping List** — Card-based UI to track your shopping list. Supports custom tag-based dynamic filtering, image integration, and quick check-off status management.
- **PWA & Offline Caching** — Instantly load previously viewed data (Itineraries, Expenses, Maps, Notes, Souvenirs) using local storage caching and skeleton screens, smoothing out the progressive web app experience.
- **Responsive & Fluid UI** — Built with Tailwind CSS 4 and Ant Design 6, featuring a sidebar-based desktop layout and a bottom-drawer mobile experience.

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
| UI Library | Ant Design 6 + Tailwind CSS 4 |
| 3D Rendering | react-globe.gl + Three.js |
| 2D Map | react-leaflet + Leaflet |
| Rich Text | react-quill-new (Quill) |
| Database | **Supabase** (PostgreSQL) |
| AI | Google Gemini 1.5 Flash |
| Auth | Google OAuth 2.0 (Custom implementation) |
| Geocoding | Nominatim / OpenStreetMap |

### Local Development

**1. Clone & install**

```bash
git clone git@github-personal:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. Set up environment variables**

Copy `.env.local.example` to `.env.local` and fill in:

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Sheets (Some trip data legacy)
GOOGLE_SHEETS_ID=

# Supabase (Itinerary, Expenses, Collaboration)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GEMINI_API_KEY=
```

**3. Run**

```bash
npm run dev
```

### Database Migration (Supabase)

Run the following in the Supabase SQL Editor to enable all features:

```sql
-- Itinerary range support
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS end_time text;

-- Region-level destinations + AI notes (stored on trips table)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destinations JSONB DEFAULT '[]';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ai_notes JSONB DEFAULT NULL;

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL,
  description text NOT NULL,
  amount decimal NOT NULL,
  currency text NOT NULL,
  category text,
  date date,
  paid_by text,
  split_with text[],
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Souvenirs & Shopping List
CREATE TABLE IF NOT EXISTS souvenirs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL,
  name text NOT NULL,
  is_checked boolean DEFAULT false,
  image_url text,
  tags text[],
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
```

---

## 中文

現代化的互動式個人旅遊日誌。記錄旅程、在 3D 地球儀與互動地圖上視覺化路線、管理旅遊費用、安排詳細行程，並透過 AI 一鍵生成旅遊筆記。

**線上版本：** https://travel-tracker-nine-delta.vercel.app/

### 核心功能

- **互動式 3D 地球儀** — 使用 WebGL 渲染飛行弧線動畫，目的地精確到地區層級（由 Nominatim / OpenStreetMap 提供坐標），不再只有國家中心點。
- **路線分頁（交通 + 地圖）** — 整合交通段落（航班、火車、巴士）與 Leaflet 互動地圖，兩個區塊視覺清晰分隔。
- **筆記分頁（富文字 + AI 生成）** — 專屬筆記分頁，搭載完整 Quill 富文字編輯器（H1–H3 標題、粗體、斜體、連結、列表、文字顏色）。六個區塊 Chip 支援插入標題或觸發 AI 生成內容（旅遊注意事項、該帶什麼、自駕資訊、地鐵攻略、公車/巴士、轉車換乘），由 Google Gemini 驅動，所有成員共享。
- **進階行程規劃** — 支援跨日事件與日期時間範圍選擇器，時間軸顯示星期標籤，備註支援富文字與可點擊連結。
- **多幣別費用追蹤** — 支援一趟旅程記錄多種貨幣（如台幣 TWD、歐元 EUR、日圓 JPY），自動計算結算金額。
- **AI 機票自動匯入** — 透過 Google Gemini AI 解析登機證圖片或 PDF，一鍵填入航班資訊。
- **旅遊照片牆** — 深度整合 Google Photos 相簿，配備瀑布流佈局與 Skeleton 載入效果。
- **分享與共同編輯** — 可生成分享連結給朋友查看，或邀請隊友共同編輯旅程；旅程卡片顯示成員頭像。
- **伴手禮與購物清單** — 卡片式網格介面追蹤購物清單。支援建立自訂標籤以進行動態篩選、圖片預覽與快速打勾狀態管理。
- **PWA 支援與快取暫存** — 透過 LocalStorage 暫存機制做到瞬間載入（涵蓋行程、費用、地圖、筆記及伴手禮分頁），搭配骨架圖（Skeleton），確保網路不佳時依然提供極度流暢的操作體驗。
- **極致響應式體驗** — 使用 Tailwind CSS 4 與 Ant Design 6 打造，桌機側欄、手機抽屜式操作完美銜接。

### 技術架構

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

| 層級 | 技術選擇 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| UI 元件庫 | Ant Design 6 + Tailwind CSS 4 |
| 3D 渲染 | react-globe.gl + Three.js |
| 2D 地圖 | react-leaflet + Leaflet |
| 富文字編輯器 | react-quill-new (Quill) |
| 資料庫 | **Supabase** (PostgreSQL) |
| 人工智慧 | Google Gemini 1.5 Flash |
| 身份驗證 | Google OAuth 2.0 (自定義整合) |
| 地理編碼 | Nominatim / OpenStreetMap |

### 本機開發

**1. 下載並安裝依賴**

```bash
git clone git@github-personal:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. 設定環境變數**

將 `.env.local.example` 複製為 `.env.local` 並填入：

```env
# Google OAuth 憑證
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Sheets ID
GOOGLE_SHEETS_ID=

# Supabase 憑證 (行程、費用、協作功能)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini AI 金鑰
GEMINI_API_KEY=
```

**3. 啟動開發伺服器**

```bash
npm run dev
```

### 資料庫遷移 (Supabase)

請於 Supabase SQL Editor 執行以下語法以啟用所有功能：

```sql
-- 行程支援跨日時間範圍
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS end_time text;

-- 地區級目的地坐標 + AI 筆記（儲存於 trips 表）
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destinations JSONB DEFAULT '[]';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ai_notes JSONB DEFAULT NULL;

-- 費用表結構
CREATE TABLE IF NOT EXISTS expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL,
  description text NOT NULL,
  amount decimal NOT NULL,
  currency text NOT NULL,
  category text,
  date date,
  paid_by text,
  split_with text[],
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 伴手禮與購物清單表結構
CREATE TABLE IF NOT EXISTS souvenirs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL,
  name text NOT NULL,
  is_checked boolean DEFAULT false,
  image_url text,
  tags text[],
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
```
