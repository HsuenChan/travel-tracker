# ✈️ Travel Tracker

A personal travel journal with an interactive 3D globe. Log your trips, visualize flight routes, and import tickets with AI.

**Live:** https://my-travel-tracker.vercel.app/

---

## Features

- **Interactive 3D globe** — animated flight arcs and country markers, powered by WebGL
- **Trip management** — create, edit, and delete trips stored in Google Sheets
- **Transport segments** — log flights, trains, buses, ferries with IATA airport codes
- **AI ticket import** — upload a boarding pass image or PDF and let Gemini fill in the details automatically
- **Google Photos integration** — link a photo album to each trip
- **Responsive UI** — desktop sidebar + mobile bottom drawer with long-press navigation

---

## Tech Stack

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

---

## Local Development

### 1. Clone & install

```bash
git clone git@github-personal:HsuenChan/travel-tracker.git
cd travel-tracker
npm install
```

### 2. Set up environment variables

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

### 3. Google Cloud setup

In [Google Cloud Console](https://console.cloud.google.com) → Credentials → your OAuth Client:

- **Authorized JavaScript origins:** `http://localhost:3000`
- **Authorized redirect URIs:** `http://localhost:3000/api/auth/google/callback`

Enable these APIs:
- Google Sheets API
- Google Photos Library API

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Google Sheets Structure

The app auto-initialises two sheets on first run.

**Sheet 1 — Trips**

| ID | Name | Start Date | End Date | Countries | Notes | Photo Album ID |
|---|---|---|---|---|---|---|

**Sheet 2 — Segments**

| ID | Trip ID | Order | From | From IATA | To | To IATA | Type | Date | Time | Flight No | Aircraft |
|---|---|---|---|---|---|---|---|---|---|---|---|

---

## Deployment (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com)
2. Add environment variables (same keys as `.env.local.example`, update `GOOGLE_REDIRECT_URI` to your Vercel domain)
3. Add the Vercel URL to Google Cloud → Authorized redirect URIs
4. Deploy

> CI/CD is configured on the `main` branch. Day-to-day development happens on `dev` and is merged to `main` via PR when ready to ship.
