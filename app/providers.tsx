"use client";

import { ConfigProvider, theme, App } from "antd";
import zhTW from "antd/locale/zh_TW";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhTW}
      modal={{
        styles: {
          wrapper: { paddingBottom: 24 },
          body: { paddingBottom: 16 },
        },
      }}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#8b5cf6",
          colorBgBase: "#09090b",
          colorBgContainer: "#18181b",
          colorBorder: "#27272a",
          borderRadius: 20,
          fontFamily: 'var(--font-geist-sans), -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif',
        },
        components: {
          Layout: {
            headerBg: "#09090b",
            siderBg: "#18181b",
            bodyBg: "#09090b",
            headerPadding: "0 32px",
          },
          Modal: {
            contentBg: "#18181b",
            headerBg: "#18181b",
            borderRadiusLG: 28,
          },
          Button: {
            borderRadius: 100, // 可愛圓潤按鈕
            fontWeight: 600,
          },
          Tag: {
            borderRadiusSM: 10,
          },
          Tooltip: {
            // darkAlgorithm 給的 colorBgSpotlight 是偏亮的灰，壓在深色介面上會浮起來
            colorBgSpotlight: "#1f1d26",
            colorTextLightSolid: "#e4e4e7",
            borderRadius: 10,
          },
          List: {
            itemPaddingSM: "10px 16px",
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
