# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

---

## English

A modern, interactive personal travel journal. Log your trips, visualize flight routes on a 3D globe, manage expenses, and plan your itinerary with ease.

**Live:** https://travel-tracker-nine-delta.vercel.app/

### Key Features

- **Interactive 3D Globe** — High-performance WebGL rendering with animated flight arcs, country markers, and smooth transitions.
- **Unified Trip Management** — Organize your travels into sections: Transport, Daily Itinerary, Expenses, and Photos.
- **Advanced Itinerary Planning** — Support for multi-day events with a unified range picker (date & time), allowing you to see your schedule at a glance.
- **Multi-Currency Expenses** — Track costs in different currencies (e.g., TWD, EUR, JPY) with automatic primary currency handling and settlement calculations.
- **AI-Powered Ticket Import** — Automatically extract flight details from boarding pass images or PDFs using Google Gemini.
- **Photo Wall** — Seamlessly integrated Google Photos albums with a beautiful masonry-style layout and skeleton loading.
- **Social Sharing & Collaboration** — Generate shareable links for friends or invite partners to co-edit your trip details.
- **Responsive & Fluid UI** — Built with Tailwind CSS 4 and Ant Design 6, featuring a sidebar-based desktop layout and a bottom-drawer mobile experience.

### Tech Stack

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-34A853?style=flat-square&logo=googlesheets&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Library | Ant Design 6 + Tailwind CSS 4 |
| 3D Rendering | react-globe.gl + Three.js |
| Database | **Supabase** (PostgreSQL) & **Google Sheets** (Hybrid) |
| AI | Google Gemini 1.5 Flash |
| Auth | Google OAuth 2.0 (Custom implementation) |

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

---

## 中文

現代化的互動式個人旅遊日誌。記錄旅程、在 3D 地球儀上視覺化飛行航線、管理旅遊費用，並輕鬆安排詳細行程。

**線上版本：** https://travel-tracker-nine-delta.vercel.app/

### 核心功能

- **互動式 3D 地球儀** — 使用 WebGL 渲染飛行弧線動畫與國家標記，支援流暢的視覺切換。
- **一站式細節管理** — 整合「交通、每日行程、費用、相片」四大分頁，資訊分類清晰。
- **進階行程規劃** — 支援跨日事件，配備統一的日期時間範圍選擇器 (RangePicker)，讓行程排佈一目了然。
- **多幣別費用追蹤** — 支援一趟旅程記錄多種貨幣（如台幣 TWD、歐元 EUR、日圓 JPY），自動計算結算金額。
- **AI 機票自動匯入** — 透過 Google Gemini AI 解析登機證圖片或 PDF，一鍵填入航班資訊。
- **旅遊照片牆** — 深度整合 Google Photos 相簿，配備瀑布流佈局與 Skeleton 載入效果。
- **分享與共同編輯** — 可生成分享連結給朋友查看，或邀請隊友登入後共同編輯旅程。
- **極致響應式體驗** — 使用 Tailwind CSS 4 與 Ant Design 6 打造，桌機側欄、手機抽屜式操作完美銜接。

### 技術架構

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-34A853?style=flat-square&logo=googlesheets&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

| 層級 | 技術選擇 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| UI 元件庫 | Ant Design 6 + Tailwind CSS 4 |
| 3D 渲染 | react-globe.gl + Three.js |
| 資料庫 | **Supabase** (PostgreSQL) + **Google Sheets** (混合架構) |
| 人工智慧 | Google Gemini 1.5 Flash |
| 身份驗證 | Google OAuth 2.0 (自定義整合) |

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

若需啟用行程範圍與費用功能，請於 Supabase SQL Editor 執行以下結構：

```sql
-- 行程表更新
ALTER TABLE itinerary_items ADD COLUMN end_date date;
ALTER TABLE itinerary_items ADD COLUMN end_time text;

-- 費用表結構
CREATE TABLE expenses (
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
```
