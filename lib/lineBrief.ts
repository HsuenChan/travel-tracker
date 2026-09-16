import { CATEGORY_LABEL } from "@/lib/itineraryExport";
import type { SettlementTransaction } from "@/lib/settlement";
import { LINE_THEME as T, lineButton, uriAction } from "@/lib/lineTheme";

/**
 * LINE 推播的訊息版面。
 *
 * 和 webhook 的 Flex 共用 lib/lineTheme 的色票，群組裡看起來才是同一個 bot。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 時間欄寬度。字型不是等寬數字，「20:00–22:00」那種零多的字串比「12:30–15:30」寬快十點，
 * 所以是照最寬的情況抓，不是照平均。
 */
const TIME_WIDTH = "76px";

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
  /*
    跨夜的第一天只報開始時間。住宿的 end_time 是隔天的退房時刻，寫成「20:00–09:00」會被
    讀成當天晚上九點結束。
  */
  const overnight = !!item.end_date && item.end_date !== item.date;
  return item.end_time && !overnight ? `${item.time}–${item.end_time}` : item.time;
}

/**
 * location 存的通常是 Google Maps 連結而不是地名。
 *
 * 印出來只是一串沒有用的網址，還會把卡片撐爆；掛成整列的 action 才用得上 —— 早上看行程時
 * 「點一下就導航」正好是那個情境會做的事。
 */
function placeOf(item: BriefItem): { link: string | null; label: string | null } {
  const raw = item.location?.trim();
  if (!raw) return { link: null, label: null };
  return /^https?:\/\//i.test(raw) ? { link: raw, label: null } : { link: null, label: raw };
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

  const rows = items.map((item, i) => {
    const backup = item.status === "backup";
    const { link, label } = placeOf(item);
    const meta = [item.category ? CATEGORY_LABEL[item.category] ?? item.category : "", label ?? ""]
      .filter(Boolean).join(" · ");

    return {
      type: "box", layout: "horizontal", spacing: "md",
      paddingTop: i === 0 ? "none" : "md",
      ...(link ? { action: uriAction(item.title, link) } : {}),
      contents: [
        {
          type: "text", text: timeLabel(item, date), size: "xxs",
          color: backup ? T.muted : T.accent,
          flex: 0, width: TIME_WIDTH,
        },
        {
          type: "box", layout: "vertical", spacing: "none",
          contents: [
            {
              type: "text",
              text: backup ? `${item.title}（備案）` : item.title,
              size: "sm",
              color: backup ? T.muted : T.title,
              weight: backup ? "regular" : "bold",
              wrap: true,
            },
            ...(meta
              ? [{ type: "text", text: meta, size: "xxs", color: T.muted, wrap: true, margin: "xs" }]
              : []),
          ],
        },
      ],
    };
  });

  return {
    type: "flex",
    altText: `${tripName} 今日行程（${items.length} 項）`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: T.header, paddingAll: "14px",
        contents: [
          { type: "text", text: "今日行程", color: T.title, weight: "bold", size: "md" },
          {
            type: "text",
            text: [`${date}（${weekdayOf(date)}）`, progress].filter(Boolean).join("　"),
            color: T.muted, size: "sm", margin: "sm",
          },
        ],
      },
      body: { type: "box", layout: "vertical", backgroundColor: T.card, paddingAll: "16px", contents: rows },
      footer: {
        type: "box", layout: "vertical", backgroundColor: T.card, paddingAll: "14px",
        contents: [lineButton(uriAction("打開行程", url))],
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
    type: "box", layout: "horizontal", spacing: "md",
    paddingTop: i === 0 ? "none" : "sm",
    contents: [
      { type: "text", text: `${t.from} → ${t.to}`, size: "sm", color: T.body, flex: 3, wrap: true },
      { type: "text", text: money(t.amount), size: "sm", color: T.accent, weight: "bold", align: "end", flex: 2 },
    ],
  }));

  return {
    type: "flex",
    altText: `${tripName} 結算：未付 ${transactions.length} 筆`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: T.header, paddingAll: "14px",
        contents: [
          { type: "text", text: "旅程結算", color: T.title, weight: "bold", size: "md" },
          { type: "text", text: tripName, color: T.muted, size: "sm", margin: "sm", wrap: true },
        ],
      },
      body: {
        type: "box", layout: "vertical", backgroundColor: T.card, paddingAll: "16px",
        contents: [
          ...rows,
          { type: "separator", margin: "lg", color: T.line },
          {
            type: "box", layout: "horizontal", margin: "lg", spacing: "md",
            contents: [
              { type: "text", text: `未付 ${transactions.length} 筆`, size: "xs", color: T.muted, flex: 3 },
              { type: "text", text: money(total), size: "sm", color: T.title, weight: "bold", align: "end", flex: 2 },
            ],
          },
        ],
      },
      footer: {
        type: "box", layout: "vertical", backgroundColor: T.card, paddingAll: "14px",
        contents: [lineButton(uriAction("查看結算", url))],
      },
    },
  };
}
