import { TRIP_TABS } from "@/lib/tripTabs";

/**
 * 後台查詢列的語法。
 *
 * 前端只負責把字串原封不動送上來，解析一律在這裡做，所以 chips 點出來的東西
 * 跟手打出來的東西走完全同一條路 —— 兩份解析器遲早會長歪。
 *
 * 支援的寫法（中英皆可）：
 *   刪除 / action:delete / 動作:刪除
 *   tab:itinerary / 分頁:行程
 *   trip:義大利 / 旅程:義大利
 *   since:7d / 近:7天 / 近7天
 * 其餘的字當成自由文字，比對標題、備註與旅程名稱。
 */

export const ACTION_LABELS: Record<string, string> = {
  create: "新增",
  update: "修改",
  delete: "刪除",
  restore: "還原",
  login: "登入",
  logout: "登出",
  login_failed: "登入失敗",
  share_view: "分享瀏覽",
};

const ACTION_ALIASES: Record<string, string> = {
  ...Object.fromEntries(Object.keys(ACTION_LABELS).map((k) => [k, k])),
  ...Object.fromEntries(Object.entries(ACTION_LABELS).map(([k, v]) => [v, k])),
  新增: "create",
  建立: "create",
  修改: "update",
  編輯: "update",
  刪除: "delete",
  還原: "restore",
  登入: "login",
  登出: "logout",
};

const TAB_ALIASES: Record<string, string> = {
  ...Object.fromEntries(TRIP_TABS.map((t) => [t.key, t.key])),
  ...Object.fromEntries(TRIP_TABS.map((t) => [t.label, t.key])),
  trip: "trip",
  旅程: "trip",
};

export interface ParsedQuery {
  text: string;
  tabs: string[];
  actions: string[];
  trip: string | null;
  sinceHours: number | null;
}

/** "7d" / "24h" / "30天" / "12小時" → 小時數 */
function parseSince(raw: string): number | null {
  const m = raw.match(/^(\d+)\s*(d|day|days|天|h|hr|hour|hours|小時)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^(d|day|days|天)$/i.test(m[2]) ? n * 24 : n;
}

export function parseActivityQuery(input: string): ParsedQuery {
  const result: ParsedQuery = { text: "", tabs: [], actions: [], trip: null, sinceHours: null };
  const free: string[] = [];

  for (const token of (input || "").trim().split(/\s+/).filter(Boolean)) {
    const colon = token.match(/^([A-Za-z一-龥]+)[:：](.+)$/);
    if (colon) {
      const key = colon[1].toLowerCase();
      const value = colon[2];
      if (key === "tab" || key === "分頁") {
        const tab = TAB_ALIASES[value];
        if (tab) { result.tabs.push(tab); continue; }
      }
      if (key === "action" || key === "動作") {
        const action = ACTION_ALIASES[value.toLowerCase()] ?? ACTION_ALIASES[value];
        if (action) { result.actions.push(action); continue; }
      }
      if (key === "trip" || key === "旅程") { result.trip = value; continue; }
      if (key === "since" || key === "近") {
        const hours = parseSince(value);
        if (hours) { result.sinceHours = hours; continue; }
      }
      // 認不出來的前綴就當自由文字，不要默默吃掉使用者打的東西
      free.push(token);
      continue;
    }

    const bareSince = token.match(/^近(\d+\s*(?:天|小時))$/);
    if (bareSince) {
      const hours = parseSince(bareSince[1].replace(/\s+/g, ""));
      if (hours) { result.sinceHours = hours; continue; }
    }

    const bareAction = ACTION_ALIASES[token.toLowerCase()] ?? ACTION_ALIASES[token];
    if (bareAction) { result.actions.push(bareAction); continue; }

    free.push(token);
  }

  result.text = free.join(" ");
  return result;
}

/** 查詢列下方那排 chips：點一下就把 token 接上去，不用會打字也能組查詢 */
export const QUERY_CHIPS: { label: string; token: string }[] = [
  { label: "刪除", token: "action:delete" },
  { label: "修改", token: "action:update" },
  { label: "新增", token: "action:create" },
  { label: "近 7 天", token: "since:7d" },
  ...TRIP_TABS.filter((t) => t.key !== "photos").map((t) => ({
    label: t.label,
    token: `tab:${t.key}`,
  })),
];
