import { CATEGORY_LABEL } from "@/lib/itineraryExport";
import type { SettlementTransaction } from "@/lib/settlement";

/**
 * LINE 推播的訊息版面。
 *
 * 和 webhook 裡的 Flex 用同一套配色（zinc 底、violet 主色），群組裡看起來才是同一個 bot。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export interface BriefItem {
  title: string;
  category: string | null;
  time: string | null;
  end_time: string | null;
  location: string | null;
  date: string;
  end_date: string | null;
  status?: string | null;
}

function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function timeLabel(item: BriefItem, today: string): string {
  // 跨日行程的續日沒有「今天幾點開始」可講，改標它進行到第幾天
  if (item.date !== today) {
    const day = Math.round((Date.parse(today) - Date.parse(item.date)) / 86_400_000) + 1;
    const end = item.end_date ?? item.date;
    const total = Math.round((Date.parse(end) - Date.parse(item.date)) / 86_400_000) + 1;
    return `第 ${day}/${total} 天`;
  }
  if (!item.time) return "—";
  return item.end_time ? `${item.time}–${item.end_time}` : item.time;
}

export function buildDailyBrief(input: {
  tripName: string;
  date: string;
  zone: string;
  dayNumber: number | null;
  totalDays: number | null;
  items: BriefItem[];
  url: string;
}): object {
  const { tripName, date, dayNumber, totalDays, items, url } = input;
  const progress = dayNumber && totalDays ? `第 ${dayNumber} / ${totalDays} 天` : "";

  const rows = items.map((item, i) => ({
    type: "box",
    layout: "horizontal",
    spacing: "md",
    paddingTop: i === 0 ? "none" : "md",
    contents: [
      {
        type: "text",
        text: timeLabel(item, date),
        size: "xs",
        color: "#a78bfa",
        flex: 0,
        // 固定寬度讓時間對齊成一欄，像時刻表一樣可以縱向掃
        width: "62px",
      },
      {
        type: "box",
        layout: "vertical",
        spacing: "none",
        contents: [
          {
            type: "text",
            text: item.status === "backup" ? `${item.title}（備案）` : item.title,
            size: "sm",
            color: item.status === "backup" ? "#a1a1aa" : "#f4f4f5",
            weight: item.status === "backup" ? "regular" : "bold",
            wrap: true,
          },
          ...(item.category || item.location
            ? [{
                type: "text",
                text: [item.category ? CATEGORY_LABEL[item.category] ?? item.category : "", item.location ?? ""]
                  .filter(Boolean).join(" · "),
                size: "xxs",
                color: "#71717a",
                wrap: true,
                margin: "xs",
              }]
            : []),
        ],
      },
    ],
  }));

  return {
    type: "flex",
    altText: `${tripName} 今日行程（${items.length} 項）`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        background: { type: "linearGradient", angle: "90deg", startColor: "#6366f1", centerColor: "#8b5cf6", endColor: "#14b8a6" },
        paddingAll: "14px",
        contents: [
          { type: "text", text: "今日行程", color: "#ffffff", weight: "bold", size: "md" },
          {
            type: "text",
            text: [`${date}（${weekdayOf(date)}）`, progress].filter(Boolean).join("　"),
            color: "#ffffffcc", size: "sm", margin: "sm",
          },
        ],
      },
      body: {
        type: "box", layout: "vertical", backgroundColor: "#1c1c1f", paddingAll: "16px",
        contents: rows,
      },
      footer: {
        type: "box", layout: "vertical", backgroundColor: "#1c1c1f",
        contents: [{
          type: "button",
          action: { type: "uri", label: "打開行程", uri: url },
          style: "primary", color: "#6366f1", height: "sm",
        }],
      },
    },
  };
}

export function buildSettlementBrief(input: {
  tripName: string;
  currency: string;
  transactions: SettlementTransaction[];
  url: string;
}): object {
  const { tripName, currency, transactions, url } = input;
  const money = (n: number) =>
    `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  const rows = transactions.map((t, i) => ({
    type: "box",
    layout: "horizontal",
    paddingTop: i === 0 ? "none" : "sm",
    contents: [
      { type: "text", text: `${t.from} → ${t.to}`, size: "sm", color: "#e4e4e7", flex: 3, wrap: true },
      { type: "text", text: money(t.amount), size: "sm", color: "#a78bfa", align: "end", flex: 2 },
    ],
  }));

  return {
    type: "flex",
    altText: `${tripName} 結算：未付 ${transactions.length} 筆`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical",
        background: { type: "linearGradient", angle: "90deg", startColor: "#6366f1", centerColor: "#8b5cf6", endColor: "#14b8a6" },
        paddingAll: "14px",
        contents: [
          { type: "text", text: "旅程結算", color: "#ffffff", weight: "bold", size: "md" },
          { type: "text", text: tripName, color: "#ffffffcc", size: "sm", margin: "sm", wrap: true },
        ],
      },
      body: {
        type: "box", layout: "vertical", backgroundColor: "#1c1c1f", paddingAll: "16px",
        contents: [
          ...rows,
          { type: "separator", margin: "lg", color: "#27272a" },
          {
            type: "box", layout: "horizontal", margin: "lg",
            contents: [
              { type: "text", text: `未付 ${transactions.length} 筆`, size: "xs", color: "#71717a", flex: 3 },
              { type: "text", text: money(total), size: "sm", color: "#f4f4f5", weight: "bold", align: "end", flex: 2 },
            ],
          },
        ],
      },
      footer: {
        type: "box", layout: "vertical", backgroundColor: "#1c1c1f",
        contents: [{
          type: "button",
          action: { type: "uri", label: "查看結算", uri: url },
          style: "primary", color: "#6366f1", height: "sm",
        }],
      },
    },
  };
}
