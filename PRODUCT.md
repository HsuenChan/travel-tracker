# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- 主要使用者：擁有者本人與同行親友（旅伴）。旅伴透過邀請連結加入旅程成為共同編輯者，或以分帳成員名字被記錄。
- 情境：行前共同規劃行程；旅途中以手機記帳（含 LINE 群組快速記帳）與查行程；旅程結束後回顧照片、與朋友分享唯讀連結。

## Product Purpose

記錄與分享個人旅程的一站式旅遊日誌：行程規劃（含每日天氣）、多幣別費用分帳與結算、Google Photos 照片牆、AI 生成旅遊筆記、3D 地球航跡視覺化。成功 = 旅程資料完整留存、旅伴協作順暢、回顧時的畫面令人想分享。

## Positioning

視覺體驗優先：3D 地球航跡、照片牆與整體「好看」本身就是核心價值，不只是功能的包裝。行程＋分帳＋照片＋協作的一站式整合服務於這個體驗。

## Operating Context

- 手機是旅途中的主要載具；桌機用於行前規劃與回顧。
- LINE 群組是旅伴間既有的溝通管道，記帳可直接在 LINE 完成並同步至旅程。
- 照片存放於 Google Photos 相簿（外部整合，非自建相簿）。
- 分享採唯讀 token 連結；共編採邀請連結，加入後可認領分帳成員身分。

## Capabilities and Constraints

- Next.js 16 + React 19 + Ant Design 6 + Tailwind CSS 4；Supabase（PostgreSQL / Auth / Storage）；Google Gemini（AI 筆記、收據與機票解析）。
- 免費維運為硬約束：匯率（open.er-api.com）、天氣（Open-Meteo）、地理編碼（Nominatim）皆為免費服務，設計不得依賴付費 API。
- 部署於 Vercel；PWA（可安裝、localStorage 快取先行）。
- 多幣別費用以旅程主幣別即時匯率換算，無歷史匯率快照（已知限制）。

## Brand Commitments

- 名稱：Travel Tracker。
- 深色紫調視覺（zinc 深色底＋violet 主色）為確定延續的品牌視覺。
- UI 文案一律繁體中文。
- 手機優先：行動體驗永遠優先於桌機。

## Evidence on Hand

- 真實個人旅程資料（使用者帳號內的實際旅程，非展示假資料）。
- 設計指南頁：`design_guideline.html`（倉庫根目錄，另發佈於 GitHub Pages）。
- `README.md` 內含完整功能清單（中英雙語）。

## Product Principles

1. 視覺體驗即產品：畫面質感與「想分享」的程度是第一評價標準。
2. 手機優先：所有互動先以旅途中的手機情境驗證。
3. 協作低門檻：旅伴用連結即可加入，不強迫額外學習。
4. 資料可信：金額、結算、行程時間的正確性不可為視覺讓步。
5. 免費可持續：功能設計以免費服務可承載為前提。
