/**
 * 把一趟旅程的行程整理成 Google Sheets 要的形狀。
 *
 * 刻意只吃純資料、不碰 Supabase 也不碰 fetch：欄位怎麼排、備註怎麼轉純文字這些規則
 * 最容易改，抽出來才能單獨看懂，路由那邊只負責取資料與呼叫 Google。
 */
import dayjs from "dayjs";
import { EXPENSE_CATEGORY_MAP } from "@/lib/expenseCategories";
import { WAYPOINT_TYPE_LABEL } from "@/lib/waypointTypes";

export interface ExportTrip {
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export interface ExportItem {
  id: string;
  date: string | null;
  status?: string | null;
  title: string;
  category: string | null;
  time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  distance_km: number | null;
  ascent_m: number | null;
  descent_m: number | null;
}

export interface ExportSegment {
  order: number | null;
  type: string | null;
  date: string | null;
  time: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  from_city: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_iata: string | null;
  flight_no: string | null;
  aircraft: string | null;
}

export interface ExportExpense {
  date: string | null;
  description: string;
  category: string | null;
  amount: number;
  currency: string;
  paid_by: string | null;
  split_with: string[] | null;
  notes: string | null;
}

export interface ExportSouvenir {
  name: string;
  is_checked: boolean | null;
  tags: string[] | null;
  notes: string | null;
}

export interface ExportGear {
  name: string;
  category: string | null;
  scope: string;
  weight_role: string;
  weight_g: number | null;
  qty: number;
  assigned_to: string | null;
  is_checked: boolean | null;
  notes: string | null;
}

export interface ExportWaypoint {
  itinerary_item_id: string;
  order_index: number;
  name: string;
  elevation_m: number | null;
  distance_km: number | null;
  drop_m: number | null;
  duration_min: number | null;
  day_offset: number;
  type: string | null;
  notes: string | null;
}

type Cell = string | number | null;

interface SheetSpec {
  title: string;
  columns: { label: string; width: number }[];
  rows: Cell[][];
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 行程分類的中文名：與費用分類同一組 value，只多了戶外 */
export const CATEGORY_LABEL: Record<string, string> = { ...EXPENSE_CATEGORY_MAP, outdoor: "戶外" };

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

/**
 * 備註是 Quill 存下來的 HTML，直接丟進表格會看到一堆標籤。
 * 段落與列表項換成換行（Sheets 的單一儲存格吃得下換行），其餘標籤去掉。
 */
export function htmlToPlainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "・")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

function weekday(date: string): string {
  const d = dayjs(date);
  return d.isValid() ? WEEKDAYS[d.day()] : "";
}

/** 匯出檔名：旅程名稱 + 日期區間，同一趟重複匯出時在雲端硬碟裡還認得出是哪一版旅程 */
export function spreadsheetTitle(trip: ExportTrip): string {
  const range = trip.start_date
    ? ` ${trip.start_date}${trip.end_date && trip.end_date !== trip.start_date ? `~${trip.end_date}` : ""}`
    : "";
  return `${trip.name} 行程${range}`;
}

/**
 * 一列一個行程項目，順序沿用時間軸（日期 → 時間 → 手動排序）。
 * 距離／上升／下降只在這趟真的有戶外數字時才出現，一般旅遊行程不用看三個空欄。
 */
/**
 * 口袋名單另起一張工作表。
 *
 * 它沒有日期，塞進「一列一天」的行程表只會多出一堆空的日期欄，排序也會亂掉。
 * 一個都沒有的話整張不出現。
 */
function wishlistSheet(items: ExportItem[]): SheetSpec | null {
  const wishes = items.filter((i) => i.status === "wishlist");
  if (wishes.length === 0) return null;

  return {
    title: "口袋名單",
    columns: [
      { label: "項目", width: 220 },
      { label: "分類", width: 62 },
      { label: "地點", width: 260 },
      { label: "備註", width: 320 },
    ],
    rows: wishes.map((i) => [
      i.title,
      i.category ? CATEGORY_LABEL[i.category] ?? i.category : "",
      i.location ?? "",
      htmlToPlainText(i.notes),
    ] satisfies Cell[]),
  };
}

function itinerarySheet(items: ExportItem[]): SheetSpec {
  const hasOutdoor = items.some(
    (i) => i.distance_km !== null || i.ascent_m !== null || i.descent_m !== null
  );
  const hasMultiDay = items.some((i) => i.end_date && i.end_date !== i.date);
  // 備案也在行程表裡（它有日期、就排在那一天），只是標明它是備案
  const hasBackup = items.some((i) => i.status === "backup");

  const columns = [
    { label: "日期", width: 92 },
    { label: "星期", width: 48 },
    { label: "開始", width: 62 },
    { label: "結束", width: 62 },
    ...(hasMultiDay ? [{ label: "結束日期", width: 92 }] : []),
    { label: "分類", width: 62 },
    { label: "項目", width: 220 },
    ...(hasBackup ? [{ label: "備案", width: 48 }] : []),
    { label: "地點", width: 180 },
    ...(hasOutdoor
      ? [
          { label: "距離 (km)", width: 78 },
          { label: "上升 (m)", width: 78 },
          { label: "下降 (m)", width: 78 },
        ]
      : []),
    { label: "備註", width: 320 },
  ];

  const rows = items.map((i) => [
    i.date ?? "",
    i.date ? weekday(i.date) : "",
    i.time ?? "",
    i.end_time ?? "",
    ...(hasMultiDay ? [i.end_date && i.end_date !== i.date ? i.end_date : ""] : []),
    i.category ? CATEGORY_LABEL[i.category] ?? i.category : "",
    i.title,
    ...(hasBackup ? [i.status === "backup" ? "備案" : ""] : []),
    i.location ?? "",
    ...(hasOutdoor ? [i.distance_km, i.ascent_m, i.descent_m] : []),
    htmlToPlainText(i.notes),
  ] satisfies Cell[]);

  return { title: "行程", columns, rows };
}

/**
 * 途經點另開一張表：一個戶外路段動輒二三十個點，塞回行程列的備註會讓那一格沒人想讀。
 * 日期是路段起日加上 day_offset，跨日溪降才對得起來。
 */
function waypointSheet(items: ExportItem[], waypoints: ExportWaypoint[]): SheetSpec {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const rows = waypoints.map((w) => {
    const item = itemById.get(w.itinerary_item_id);
    const date = item ? dayjs(item.date).add(w.day_offset ?? 0, "day").format("YYYY-MM-DD") : "";
    return [
      item?.title ?? "",
      date,
      w.order_index + 1,
      w.name,
      w.type ? WAYPOINT_TYPE_LABEL[w.type] ?? w.type : "",
      w.elevation_m,
      w.distance_km,
      w.drop_m,
      w.duration_min,
      w.notes ?? "",
    ] satisfies Cell[];
  });

  return {
    title: "途經點",
    columns: [
      { label: "路段", width: 160 },
      { label: "日期", width: 92 },
      { label: "順序", width: 52 },
      { label: "名稱", width: 180 },
      { label: "類型", width: 72 },
      { label: "海拔 (m)", width: 78 },
      { label: "累積距離 (km)", width: 104 },
      { label: "落差 (m)", width: 78 },
      { label: "耗時 (分)", width: 78 },
      { label: "備註", width: 280 },
    ],
    rows,
  };
}

function segmentSheet(rows: ExportSegment[]): SheetSpec {
  return {
    title: "路線",
    columns: [
      { label: "日期", width: 92 },
      { label: "出發", width: 62 },
      { label: "抵達", width: 62 },
      { label: "方式", width: 62 },
      { label: "從", width: 150 },
      { label: "到", width: 150 },
      { label: "班次", width: 90 },
      { label: "機型／車種", width: 120 },
    ],
    rows: rows.map((r) => [
      r.date ?? "",
      r.time ?? "",
      [r.arrival_date && r.arrival_date !== r.date ? r.arrival_date : "", r.arrival_time ?? ""].filter(Boolean).join(" "),
      r.type ?? "",
      [r.from_city, r.from_iata].filter(Boolean).join(" "),
      [r.to_city, r.to_iata].filter(Boolean).join(" "),
      r.flight_no ?? "",
      r.aircraft ?? "",
    ] satisfies Cell[]),
  };
}

function expenseSheet(rows: ExportExpense[]): SheetSpec {
  return {
    title: "費用",
    columns: [
      { label: "日期", width: 92 },
      { label: "項目", width: 220 },
      { label: "分類", width: 72 },
      { label: "金額", width: 90 },
      { label: "幣別", width: 56 },
      { label: "付款人", width: 90 },
      { label: "分攤", width: 180 },
      { label: "備註", width: 260 },
    ],
    rows: rows.map((r) => [
      r.date ?? "",
      r.description,
      r.category ? EXPENSE_CATEGORY_MAP[r.category] ?? r.category : "",
      r.amount,
      r.currency,
      r.paid_by ?? "",
      (r.split_with ?? []).join("、"),
      htmlToPlainText(r.notes),
    ] satisfies Cell[]),
  };
}

function souvenirSheet(rows: ExportSouvenir[]): SheetSpec {
  return {
    title: "伴手禮",
    columns: [
      { label: "已買", width: 48 },
      { label: "項目", width: 240 },
      { label: "標籤", width: 160 },
      { label: "備註", width: 300 },
    ],
    rows: rows.map((r) => [
      r.is_checked ? "✓" : "",
      r.name,
      (r.tags ?? []).join("、"),
      htmlToPlainText(r.notes),
    ] satisfies Cell[]),
  };
}

const GEAR_ROLE_LABEL: Record<string, string> = { base: "基準", worn: "穿著", consumable: "消耗" };

function gearSheet(rows: ExportGear[]): SheetSpec {
  return {
    title: "裝備",
    columns: [
      { label: "已打包", width: 58 },
      { label: "項目", width: 220 },
      { label: "分類", width: 100 },
      { label: "個人／公裝", width: 86 },
      { label: "重量歸類", width: 78 },
      { label: "單件 (g)", width: 72 },
      { label: "數量", width: 52 },
      { label: "小計 (g)", width: 78 },
      { label: "攜帶者", width: 90 },
      { label: "備註", width: 240 },
    ],
    rows: rows.map((r) => [
      r.is_checked ? "✓" : "",
      r.name,
      r.category ?? "",
      r.scope === "group" ? "公裝" : "個人",
      GEAR_ROLE_LABEL[r.weight_role] ?? r.weight_role,
      r.weight_g,
      r.qty,
      r.weight_g != null ? r.weight_g * r.qty : null,
      r.assigned_to ?? "",
      htmlToPlainText(r.notes),
    ] satisfies Cell[]),
  };
}

function notesSheet(html: string | null): SheetSpec | null {
  const text = htmlToPlainText(html);
  if (!text) return null;
  return {
    title: "筆記",
    columns: [{ label: "內容", width: 720 }],
    // 一行一列，試算表裡才讀得動；整段塞進一格會變成一條看不完的線
    rows: text.split("\n").map((line) => [line] satisfies Cell[]),
  };
}

export interface ExportData {
  items: ExportItem[];
  waypoints: ExportWaypoint[];
  segments: ExportSegment[];
  expenses: ExportExpense[];
  souvenirs: ExportSouvenir[];
  gear: ExportGear[];
  notes: string | null;
}

/**
 * 挑出來的分頁各自變成一張工作表，順序照旅程分頁的順序。
 *
 * 沒有資料的分頁不會產生空白工作表 —— 勾了但那一頁其實是空的，給一張只有標題列的表沒有意義。
 */
export function buildSheets(tabs: string[], data: ExportData): SheetSpec[] {
  const sheets: SheetSpec[] = [];

  for (const tab of tabs) {
    if (tab === "transport" && data.segments.length > 0) {
      sheets.push(segmentSheet(data.segments));
    } else if (tab === "itinerary") {
      // 行程表只放有日期的；口袋名單沒有日期，另起一張
      const scheduled = data.items.filter((i) => i.status !== "wishlist");
      if (scheduled.length > 0) sheets.push(itinerarySheet(scheduled));
      if (data.waypoints.length > 0) sheets.push(waypointSheet(scheduled, data.waypoints));
      const wishes = wishlistSheet(data.items);
      if (wishes) sheets.push(wishes);
    } else if (tab === "expenses" && data.expenses.length > 0) {
      sheets.push(expenseSheet(data.expenses));
    } else if (tab === "souvenirs" && data.souvenirs.length > 0) {
      sheets.push(souvenirSheet(data.souvenirs));
    } else if (tab === "gear" && data.gear.length > 0) {
      sheets.push(gearSheet(data.gear));
    } else if (tab === "notes") {
      const n = notesSheet(data.notes);
      if (n) sheets.push(n);
    }
  }

  return sheets;
}

/**
 * spreadsheets.create 的 request body。
 *
 * 只在這一支請求裡放標題列與版面（粗體、凍結、欄寬），資料列另外用 values.batchUpdate 寫，
 * 因為資料列用二維陣列就夠，不需要每一格都包成 CellData。
 */
export function spreadsheetCreateBody(title: string, sheets: SheetSpec[]) {
  return {
    properties: { title },
    sheets: sheets.map((s) => ({
      properties: {
        title: s.title,
        gridProperties: {
          frozenRowCount: 1,
          rowCount: Math.max(s.rows.length + 1, 2),
          columnCount: s.columns.length,
        },
      },
      data: [
        {
          startRow: 0,
          startColumn: 0,
          rowData: [
            {
              values: s.columns.map((c) => ({
                userEnteredValue: { stringValue: c.label },
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.93, green: 0.93, blue: 0.94 },
                },
              })),
            },
          ],
          columnMetadata: s.columns.map((c) => ({ pixelSize: c.width })),
        },
      ],
    })),
  };
}

/**
 * values.batchUpdate 的 request body。
 *
 * 用 RAW 而不是 USER_ENTERED：備註裡以 = 或 + 開頭的一行會被當成公式，而 09:00 這種時間
 * 字串會被吃成當地時區的時間值。數字欄位本來就以 JSON number 傳，RAW 之下仍然是數字。
 */
export function valuesUpdateBody(sheets: SheetSpec[]) {
  return {
    valueInputOption: "RAW",
    data: sheets
      .filter((s) => s.rows.length > 0)
      .map((s) => ({
        range: `'${s.title}'!A2`,
        values: s.rows.map((row) => row.map((cell) => (cell === null ? "" : cell))),
      })),
  };
}
