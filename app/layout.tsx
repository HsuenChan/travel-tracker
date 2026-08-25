import type { Metadata } from "next";
import { Geist, Geist_Mono, Michroma, Righteous, Comfortaa } from "next/font/google";
import localFont from "next/font/local";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  weight: "400",
  subsets: ["latin"],
});

// 全站主字：LINE Seed TC（圓潤現代、免費商用），中英文與數字同一套個性
const lineSeed = localFont({
  src: [
    { path: "./fonts/LINESeedTW-Rg.woff2", weight: "400", style: "normal" },
    { path: "./fonts/LINESeedTW-Bd.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-line-seed",
  display: "swap",
  preload: false,
});


const BASE_URL = "https://travel-tracker-nine-delta.vercel.app";

export const metadata: Metadata = {
  title: "Travel Tracker",
  description: "記錄你走過的每一段旅程",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travel Tracker",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Travel Tracker",
    description: "記錄你走過的每一段旅程",
    url: BASE_URL,
    siteName: "Travel Tracker",
    images: [
      {
        url: `${BASE_URL}/icon.svg`,
        width: 32,
        height: 32,
        alt: "Travel Tracker",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Travel Tracker",
    description: "記錄你走過的每一段旅程",
    images: [`${BASE_URL}/icon.svg`],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${geistSans.variable} ${geistMono.variable} ${comfortaa.variable} ${lineSeed.variable}`}>
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
