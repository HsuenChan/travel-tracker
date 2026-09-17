import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travel Tracker",
    short_name: "Travel Tracker",
    description: "記錄你走過的每一段旅程",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#8b5cf6",
    /*
      把 App 註冊成系統的分享目標：IG、Threads 或任何 App 按分享時，清單裡會出現 Travel Tracker。
      用 GET 就夠了——只收文字與網址，不收檔案（收檔案要 POST，而 POST 需要 service worker）。
    */
    share_target: {
      action: "/share-target",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any" as const,
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any" as const,
      },
    ],
  };
}
