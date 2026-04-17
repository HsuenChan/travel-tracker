# ✈️ Travel Tracker

[English](#english) | [中文](#中文)

---

## English

A personal travel journal with an interactive 3D globe. Log your trips, visualize flight routes, and import tickets with AI.

**Live:** https://travel-tracker-nine-delta.vercel.app/

### Features

- **Interactive 3D globe** — animated flight arcs and country markers, powered by WebGL
- **Trip management** — create, edit, and delete trips stored in Google Sheets
- **Transport segments** — log flights, trains, buses, ferries with IATA airport codes
- **AI ticket import** — upload a boarding pass image or PDF and let Gemini fill in the details automatically
- **Google Photos integration** — link a photo album to each trip
- **Responsive UI** — desktop sidebar + mobile bottom drawer with long-press navigation

### Tech Stack

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=flat-square&logo=three.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets_API-34A853?style=flat-square&logo=googlesheets&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth_2.0-4285F4?style=flat-square&logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-black?style=flat-square&logo=vercel)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI Library | Ant Design 6 |
| 3D Rendering | react-globe.gl + Three.js |
| Auth | Google OAuth 2.0 (custom, no NextAuth) |
| Database | Google Sheets (via Sheets API v4) |
| AI | Google Gemini 1.5 Flash |
| Deployment | Vercel |

### Local Development

**1. Clone & install**

```bash
git clone git@github-personal:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. Set up environment variables**

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
GOOGLE_CLIENT_ID=        # Google Cloud Console → OAuth 2.0 Client
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_SHEETS_ID=        # The ID in your Google Sheets URL (/d/<ID>/)
GEMINI_API_KEY=          # Google AI Studio → Get API Key
```

**3. Google Cloud setup**

In [Google Cloud Console](https://console.cloud.google.com) → Credentials → your OAuth Client:

- **Authorized JavaScript origins:** `http://localhost:3000`
- **Authorized redirect URIs:** `http://localhost:3000/api/auth/google/callback`

Enable these APIs: Google Sheets API, Google Photos Library API

**4. Run**

```bash
npm run dev
```

### Google Sheets Structure

**Sheet 1 — Trips**

| ID | Name | Start Date | End Date | Countries | Notes | Photo Album ID |
|---|---|---|---|---|---|---|

**Sheet 2 — Segments**

| ID | Trip ID | Order | From | From IATA | To | To IATA | Type | Date | Time | Flight No | Aircraft |
|---|---|---|---|---|---|---|---|---|---|---|---|

### Deployment (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com)
2. Add environment variables (same keys as `.env.local.example`, update `GOOGLE_REDIRECT_URI` to your Vercel domain)
3. Add the Vercel URL to Google Cloud → Authorized redirect URIs
4. Deploy

> CI/CD is configured on the `main` branch. Day-to-day development happens on `dev` and is merged to `main` via PR when ready to ship.

---

## 中文

用互動式 3D 地球儀記錄個人旅程，視覺化飛行航線，並支援 AI 自動匯入機票資訊。

**線上版本：** https://travel-tracker-nine-delta.vercel.app/

### 功能特色

- **互動式 3D 地球儀** — WebGL 渲染，支援飛行弧線動畫與國家標記
- **旅程管理** — 新增、編輯、刪除旅程，資料儲存於 Google Sheets
- **交通段落** — 記錄飛機、火車、巴士、渡輪等交通方式，支援 IATA 機場代碼
- **AI 機票匯入** — 上傳登機證圖片或 PDF，由 Gemini 自動解析填入航班資訊
- **Google Photos 整合** — 為每趟旅程連結相片相簿
- **響應式介面** — 桌機側欄 + 手機底部抽屜，支援長按進入旅程詳情

### 技術架構

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant_Design_6-0170FE?style=flat-square&logo=antdesign&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=flat-square&logo=three.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets_API-34A853?style=flat-square&logo=googlesheets&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth_2.0-4285F4?style=flat-square&logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-black?style=flat-square&logo=vercel)

| 層級 | 技術選擇 |
|---|---|
| 框架 | Next.js 16 App Router |
| 語言 | TypeScript |
| UI 元件庫 | Ant Design 6 |
| 3D 渲染 | react-globe.gl + Three.js |
| 身份驗證 | Google OAuth 2.0（自製，不依賴 NextAuth）|
| 資料庫 | Google Sheets（Sheets API v4）|
| AI | Google Gemini 1.5 Flash |
| 部署 | Vercel |

### 本機開發

**1. 下載並安裝依賴**

```bash
git clone git@github-personal:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

**2. 設定環境變數**

```bash
cp .env.local.example .env.local
```

填入 `.env.local`：

```env
GOOGLE_CLIENT_ID=        # Google Cloud Console → OAuth 2.0 用戶端
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_SHEETS_ID=        # Google Sheets 網址中 /d/ 後面的 ID
GEMINI_API_KEY=          # Google AI Studio → 取得 API 金鑰
```

**3. Google Cloud 設定**

至 [Google Cloud Console](https://console.cloud.google.com) → 憑證 → 你的 OAuth 2.0 用戶端 ID：

- **已授權的 JavaScript 來源：** `http://localhost:3000`
- **已授權的重新導向 URI：** `http://localhost:3000/api/auth/google/callback`

啟用以下 API：Google Sheets API、Google Photos Library API

**4. 啟動**

```bash
npm run dev
```

### Google Sheets 資料結構

**Sheet 1 — 旅程（Trips）**

| ID | Name | Start Date | End Date | Countries | Notes | Photo Album ID |
|---|---|---|---|---|---|---|

**Sheet 2 — 交通段落（Segments）**

| ID | Trip ID | Order | From | From IATA | To | To IATA | Type | Date | Time | Flight No | Aircraft |
|---|---|---|---|---|---|---|---|---|---|---|---|

### 部署（Vercel）

1. 推送到 GitHub 並在 [Vercel](https://vercel.com) 匯入專案
2. 新增環境變數（與 `.env.local.example` 相同的 key，`GOOGLE_REDIRECT_URI` 改為 Vercel 網域）
3. 將 Vercel 網址加入 Google Cloud → 已授權的重新導向 URI
4. 部署

> CI/CD 設定為 `main` branch 有變動時自動部署。日常開發在 `dev` 進行，功能完成後透過 PR 合併至 `main`。
