import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 家目錄有另一份 pnpm-lock.yaml，Turbopack 會把 workspace root 推斷到那裡並每次啟動警告。
  // 明確指向這個專案。
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
