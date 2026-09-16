import { tripUrl } from "@/lib/linePush";
import { LINE_THEME as T, lineButton, postbackAction, uriAction } from "@/lib/lineTheme";

/**
 * LINE 對話裡會出現的所有 Flex 卡片。
 *
 * 從 webhook 的 route handler 搬出來，因為後台的模擬器要渲染同一批卡片 —— 各留一份的話，
 * 預覽看到的排版遲早會和真的送出去的那份不一樣，預覽就失去意義了。
 */

export type PendingExpense = {
  id: string;
  trip_id: string;
  user_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  selected_people: string[];
  all_people: string[];
  trip_name: string;
  expires_at: string;
};

export type TripRow = {
  id: string;
  name: string;
  currency: string | null;
  people: string[] | null;
  user_id: string;
};

export type RecentExpense = {
  description: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  split_with: string[] | null;
};

const header = (contents: object[]) => ({
  type: "box", layout: "vertical", backgroundColor: T.header, paddingAll: "14px", contents,
});

const body = (contents: object[], extra: object = {}) => ({
  type: "box", layout: "vertical", backgroundColor: T.card, paddingAll: "16px", contents, ...extra,
});

const footer = (contents: object[], extra: object = {}) => ({
  type: "box", layout: "vertical", backgroundColor: T.card, paddingAll: "14px", contents, ...extra,
});

/** 一般的「標籤 — 值」列 */
function detailRow(label: string, value: string, accent = false) {
  return {
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: T.muted, flex: 2 },
      {
        type: "text", text: value, size: "sm",
        color: accent ? T.accent : T.body,
        weight: accent ? "bold" : "regular", align: "end", wrap: true, flex: 5,
      },
    ],
  };
}

/**
 * 名單專用：標籤與內容分兩行。
 *
 * 併成一行右對齊時，名字會從中間被切斷（「五姑姑」變成「五姑 / 姑」）—— 寬度不夠時換行點
 * 落在字之間而不是詞之間。給它整行寬度就不會發生。
 */
function peopleRow(label: string, names: string) {
  return {
    type: "box", layout: "vertical", spacing: "xs",
    contents: [
      { type: "text", text: label, size: "sm", color: T.muted },
      { type: "text", text: names, size: "sm", color: T.body, wrap: true },
    ],
  };
}

export function buildSplitNumberFlex(pending: PendingExpense) {
  const row = (num: string, label: string) => ({
    type: "box", layout: "horizontal", alignItems: "center", spacing: "lg",
    paddingTop: "8px", paddingBottom: "8px",
    contents: [
      { type: "text", text: num, color: T.accent, size: "sm", weight: "bold", width: "16px", align: "center" },
      { type: "text", text: label, color: T.body, size: "md", weight: "bold", wrap: true },
    ],
  });
  return {
    type: "flex",
    altText: "選擇平分對象",
    contents: {
      type: "bubble",
      header: header([
        { type: "text", text: pending.description, color: T.title, weight: "bold", size: "md", wrap: true },
        {
          type: "text",
          text: `${pending.amount.toLocaleString()} ${pending.currency}${pending.paid_by ? `　${pending.paid_by} 付` : ""}`,
          color: T.muted, size: "sm", margin: "sm",
        },
      ]),
      body: body([
        { type: "text", text: "選擇平分對象", weight: "bold", size: "xs", color: T.muted },
        { type: "separator", margin: "sm", color: T.line },
        row("0", "全部"),
        // 0 是「全選」，和下面的個人不是同一種東西，用一條線分開才不會看成第一個人
        { type: "separator", color: T.line },
        ...pending.all_people.map((p, i) => row(String(i + 1), p)),
        { type: "separator", margin: "sm", color: T.line },
        {
          type: "box", layout: "vertical", backgroundColor: T.subtle,
          cornerRadius: "8px", paddingAll: "10px", margin: "md",
          contents: [
            { type: "text", text: "回覆號碼選擇平分對象", size: "xs", color: T.muted, wrap: true },
            { type: "text", text: "全選 → 0　　多人 → 12 或 1,2", size: "xs", color: T.muted, wrap: true, margin: "sm" },
          ],
        },
      ]),
    },
  };
}

function expenseDetail(
  e: { description: string; amount: number; currency: string; paid_by: string | null },
  splitWith: string[],
  tripName: string | null,
) {
  const perPerson = splitWith.length > 0 ? (e.amount / splitWith.length).toFixed(0) : null;
  return [
    { type: "text", text: e.description, weight: "bold", size: "lg", color: T.title, wrap: true },
    detailRow("金額", `${e.amount.toLocaleString()} ${e.currency}`),
    ...(e.paid_by ? [detailRow("付款人", e.paid_by)] : []),
    peopleRow("平分", splitWith.length > 0 ? splitWith.join("、") : "—"),
    ...(perPerson ? [detailRow("每人", `${perPerson} ${e.currency}`, true)] : []),
    ...(tripName ? [{ type: "separator", color: T.line }, detailRow("行程", tripName)] : []),
  ];
}

export function buildConfirmationFlex(pending: PendingExpense, splitWith: string[]) {
  return {
    type: "flex",
    altText: `確認新增：${pending.description} ${pending.amount} ${pending.currency}`,
    contents: {
      type: "bubble",
      header: header([{ type: "text", text: "確認新增款項？", color: T.title, weight: "bold", size: "md" }]),
      body: body(expenseDetail(pending, splitWith, pending.trip_name ?? "我的行程"), { spacing: "md" }),
      footer: footer(
        [
          lineButton(postbackAction("取消", `action=cancel&id=${pending.id}`), { quiet: true, flex: 2 }),
          lineButton(postbackAction("是，新增", `action=confirm&id=${pending.id}`), { flex: 3 }),
        ],
        { layout: "horizontal", spacing: "sm" },
      ),
    },
  };
}

export function buildSuccessFlex(
  expense: { description: string; amount: number; currency: string; paid_by: string | null; split_with: string[] },
  tripId: string,
  tripName: string,
) {
  return {
    type: "flex",
    altText: `已記錄：${expense.description} ${expense.amount} ${expense.currency}`,
    contents: {
      type: "bubble",
      header: header([
        {
          type: "box", layout: "horizontal", spacing: "sm", alignItems: "center",
          contents: [
            { type: "text", text: "✓", color: T.accent, size: "sm", weight: "bold", flex: 0 },
            { type: "text", text: "費用已記錄", color: T.title, weight: "bold", size: "sm" },
          ],
        },
        { type: "text", text: tripName, color: T.muted, size: "xs", margin: "sm", wrap: true },
      ]),
      // 行程名稱標頭已經有了，內文不再重複一次
      body: body(expenseDetail(expense, expense.split_with, null), { spacing: "md" }),
      footer: footer([lineButton(uriAction("查看費用明細", tripUrl(tripId, "expenses")))]),
    },
  };
}

export function buildLinkedFlex(tripName: string) {
  return {
    type: "flex",
    altText: `已連結行程「${tripName}」`,
    contents: {
      type: "bubble",
      header: header([
        {
          type: "box", layout: "horizontal", spacing: "sm", alignItems: "center",
          contents: [
            { type: "text", text: "✓", color: T.accent, size: "sm", weight: "bold", flex: 0 },
            { type: "text", text: "行程已連結", color: T.title, weight: "bold", size: "md" },
          ],
        },
        { type: "text", text: tripName, color: T.muted, size: "sm", margin: "sm", wrap: true },
      ]),
      body: body([
        { type: "text", text: "現在可以直接記帳了", color: T.body, size: "sm", wrap: true },
        { type: "separator", margin: "md", color: T.line },
        { type: "text", text: "格式：描述 金額 [幣別] [付款人]", color: T.muted, size: "xs", margin: "md", wrap: true },
        { type: "text", text: "例如：晚餐 500　　計程車 200 JPY", color: T.muted, size: "xs", margin: "sm", wrap: true },
      ]),
    },
  };
}

export function buildInfoFlex(trip: TripRow, people: string[]) {
  return {
    type: "flex",
    altText: `目前行程：${trip.name}`,
    contents: {
      type: "bubble",
      header: header([{ type: "text", text: "目前行程", color: T.title, weight: "bold", size: "md" }]),
      body: body([
        { type: "text", text: trip.name, weight: "bold", size: "lg", color: T.title, wrap: true },
        ...(trip.currency
          ? [{ type: "text", text: `幣別：${trip.currency}`, size: "sm", color: T.muted, margin: "md" }] : []),
        ...(people.length > 0
          ? [{ type: "text", text: `成員：${people.join("、")}`, size: "sm", color: T.muted, wrap: true, margin: "sm" }] : []),
      ]),
      footer: footer([lineButton(uriAction("查看行程", tripUrl(trip.id)))]),
    },
  };
}

export function buildRecentFlex(expenses: RecentExpense[], tripName: string, tripId: string) {
  const rows = expenses.map((e, i) => ({
    type: "box", layout: "vertical", paddingTop: i === 0 ? "none" : "md",
    contents: [
      {
        type: "box", layout: "horizontal", alignItems: "center", spacing: "md",
        contents: [
          { type: "text", text: e.description, weight: "bold", size: "sm", color: T.body, wrap: true, flex: 3 },
          {
            type: "text", text: `${e.amount.toLocaleString()} ${e.currency}`,
            size: "sm", weight: "bold", color: T.accent, align: "end", flex: 2,
          },
        ],
      },
      {
        type: "text",
        text: [e.paid_by ? `${e.paid_by} 付` : null, e.split_with?.length ? `${e.split_with.join("、")} 分` : null]
          .filter(Boolean).join("　") || "—",
        size: "xs", color: T.muted, margin: "xs", wrap: true,
      },
      ...(i < expenses.length - 1 ? [{ type: "separator", margin: "md", color: T.line }] : []),
    ],
  }));
  return {
    type: "flex",
    altText: "最近 5 筆費用",
    contents: {
      type: "bubble",
      header: header([
        { type: "text", text: "最近費用", color: T.title, weight: "bold", size: "md" },
        { type: "text", text: tripName, color: T.muted, size: "xs", margin: "sm", wrap: true },
      ]),
      body: body(rows),
      footer: footer([lineButton(uriAction("查看全部費用", tripUrl(tripId, "expenses")))]),
    },
  };
}
