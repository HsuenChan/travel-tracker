import type { NextConfig } from "next";

/*
  後台底部那行「現在線上是哪一版」。

  Vercel 沒有「部署時刻」這個環境變數，但建置當下的時間就是它 —— 這裡的值在 build 時
  就被寫死進去，之後不會再變。本機開發時 config 只在 dev server 啟動時求值一次。
*/
const buildInfo = {
  BUILD_TIME: new Date().toISOString(),
  COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "",
  DEPLOY_ENV: process.env.VERCEL_ENV ?? "",
  REPO: [process.env.VERCEL_GIT_REPO_OWNER, process.env.VERCEL_GIT_REPO_SLUG]
    .filter(Boolean).join("/"),
};

const nextConfig: NextConfig = {
  env: buildInfo,
  // 家目錄有另一份 pnpm-lock.yaml，Turbopack 會把 workspace root 推斷到那裡並每次啟動警告。
  // 明確指向這個專案。
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
