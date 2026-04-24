import type { Metadata } from "next";
import { Geist, Geist_Mono, Michroma, Righteous, Comfortaa } from "next/font/google";
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
    <html lang="zh-TW" className={`${geistSans.variable} ${geistMono.variable} ${comfortaa.variable}`}>
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
