import { type NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const BOT_USER_ID = process.env.LINE_BOT_USER_ID ?? "";

function verifySignature(body: string, signature: string): boolean {
  return crypto.createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64") === signature;
}

async function replyMessage(replyToken: string, messages: object[]) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type PendingExpense = {
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

type TripRow = { id: string; name: string; currency: string | null; people: string[] | null; user_id: string };

type Mentionee = { index: number; length: number; userId: string; type: string };
type LineEvent = {
  type: string;
  replyToken?: string;
  source: { type?: "user" | "group" | "room"; userId: string; groupId?: string; roomId?: string };
  message?: { type: string; text: string; mention?: { mentionees: Mentionee[] } };
  postback?: { data: string };
};

function chatId(event: LineEvent): string {
  return event.source.groupId ?? event.source.roomId ?? event.source.userId;
}

function isBotMentioned(message: NonNullable<LineEvent["message"]>): boolean {
  if (!BOT_USER_ID) return true;
  return message.mention?.mentionees.some(m => m.userId === BOT_USER_ID) ?? false;
}

function stripMentions(text: string, mentionees: Mentionee[]): string {
  const sorted = [...mentionees].sort((a, b) => b.index - a.index);
  let result = text;
  for (const m of sorted) result = result.slice(0, m.index) + result.slice(m.index + m.length);
  return result.trim();
}

// ────────────────────────────────────────────────────────────────
// Expense parsing
// ────────────────────────────────────────────────────────────────

async function fetchCurrencyCodes(): Promise<Set<string>> {
  try {
    const res = await fetch("https://openexchangerates.org/api/currencies.json", { next: { revalidate: 86400 } });
    const data: Record<string, string> = await res.json();
    return new Set(Object.keys(data));
  } catch {
    return new Set(["TWD", "JPY", "USD", "EUR", "HKD", "KRW", "THB", "SGD", "CNY", "MYR", "AUD", "GBP"]);
  }
}

async function parseExpenseMessage(text: string) {
  const knownCurrencies = await fetchCurrencyCodes();
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const description = parts[0];
  const amount = parseFloat(parts[1]);
  if (isNaN(amount) || amount <= 0) return null;
  let currency: string | null = null;
  let paid_by: string | null = null;
  let idx = 2;
  if (idx < parts.length && knownCurrencies.has(parts[idx].toUpperCase())) { currency = parts[idx].toUpperCase(); idx++; }
  if (idx < parts.length && !parts[idx].startsWith("/")) { paid_by = parts[idx]; }
  return { description, amount, currency, paid_by };
}

function parseNumberSelection(text: string, allPeople: string[]): string[] | null {
  const cleaned = text.trim();
  if (!/^[0-9][0-9,，\s]*$/.test(cleaned)) return null;
  const digits = cleaned.replace(/[,，\s]/g, "");
  if (digits === "0") return [...allPeople];
  const indices = [...new Set([...digits].map(Number))];
  const selected = indices.filter(i => i >= 1 && i <= allPeople.length).map(i => allPeople[i - 1]);
  return selected.length > 0 ? selected : null;
}

// ────────────────────────────────────────────────────────────────
// Flex messages
// ────────────────────────────────────────────────────────────────

function buildSplitNumberFlex(pending: PendingExpense) {
  const badgeRow = (num: string, label: string) => ({
    type: "box", layout: "horizontal", alignItems: "center", spacing: "md",
    paddingTop: "8px", paddingBottom: "8px",
    contents: [
      {
        type: "box", layout: "vertical", width: "26px", height: "26px",
        cornerRadius: "13px", backgroundColor: "#6366f1",
        justifyContent: "center", alignItems: "center",
        contents: [{ type: "text", text: num, color: "#ffffff", size: "xs", weight: "bold", align: "center" }],
      },
      { type: "text", text: label, color: "#e4e4e7", size: "md", weight: "bold" },
    ],
  });
  return {
    type: "flex",
    altText: "選擇平分對象",
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#18181b", paddingAll: "14px",
        contents: [
          { type: "text", text: pending.description, color: "#ffffff", weight: "bold", size: "md" },
          {
            type: "text",
            text: `${pending.amount.toLocaleString()} ${pending.currency}${pending.paid_by ? `　${pending.paid_by} 付` : ""}`,
            color: "#a1a1aa", size: "sm", margin: "sm",
          },
        ],
      },
      body: {
        type: "box", layout: "vertical", backgroundColor: "#1c1c1f", paddingAll: "16px",
        contents: [
          { type: "text", text: "選擇平分對象", weight: "bold", size: "xs", color: "#71717a" },
          { type: "separator", margin: "sm", color: "#27272a" },
          badgeRow("0", "全部"),
          ...pending.all_people.map((p, i) => badgeRow(String(i + 1), p)),
          { type: "separator", margin: "sm", color: "#27272a" },
          {
            type: "box", layout: "vertical", backgroundColor: "#1e1e2e",
            cornerRadius: "8px", paddingAll: "10px", margin: "sm",
            contents: [
              { type: "text", text: "回覆號碼選擇平分對象", size: "xs", color: "#a78bfa", wrap: true },
              { type: "text", text: "全選 → 0　　多人 → 12 或 1,2", size: "xs", color: "#a78bfa", wrap: true, margin: "sm" },
            ],
          },
        ],
      },
    },
  };
}

function buildConfirmationFlex(pending: PendingExpense, splitWith: string[]) {
  const perPerson = splitWith.length > 0 ? (pending.amount / splitWith.length).toFixed(0) : null;
  const darkRow = (label: string, value: string, accent = false) => ({
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#71717a", flex: 1 },
      { type: "text", text: value, size: "sm", color: accent ? "#a78bfa" : "#e4e4e7", weight: accent ? "bold" : "regular", align: "end", wrap: true },
    ],
  });
  return {
    type: "flex",
    altText: `確認新增：${pending.description} ${pending.amount} ${pending.currency}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#18181b", paddingAll: "14px",
        contents: [{ type: "text", text: "確認新增款項？", color: "#ffffff", weight: "bold", size: "md" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", backgroundColor: "#1c1c1f",
        contents: [
          { type: "text", text: pending.description, weight: "bold", size: "xl", color: "#f4f4f5" },
          darkRow("金額", `${pending.amount.toLocaleString()} ${pending.currency}`),
          ...(pending.paid_by ? [darkRow("付款人", pending.paid_by)] : []),
          darkRow("平分", splitWith.length > 0 ? splitWith.join("、") : "—"),
          ...(perPerson ? [darkRow("每人", `${perPerson} ${pending.currency}`, true)] : []),
          { type: "separator", color: "#27272a" },
          darkRow("行程", pending.trip_name ?? "我的行程"),
        ],
      },
      footer: {
        type: "box", layout: "horizontal", spacing: "sm", paddingAll: "14px", backgroundColor: "#1c1c1f",
        contents: [
          {
            type: "button",
            action: { type: "postback", label: "取消", data: `action=cancel&id=${pending.id}` },
            style: "primary", color: "#3f3f46", height: "sm", flex: 1,
          },
          {
            type: "button",
            action: { type: "postback", label: "是，新增", data: `action=confirm&id=${pending.id}` },
            style: "primary", color: "#6366f1", height: "sm", flex: 2,
          },
        ],
      },
    },
  };
}

function buildSuccessFlex(
  expense: { description: string; amount: number; currency: string; paid_by: string | null; split_with: string[] },
  tripId: string,
  tripName: string
) {
  const perPerson = expense.split_with.length > 0 ? (expense.amount / expense.split_with.length).toFixed(0) : null;
  const darkRow = (label: string, value: string, accent = false) => ({
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#71717a", flex: 1 },
      { type: "text", text: value, size: "sm", color: accent ? "#a78bfa" : "#e4e4e7", weight: accent ? "bold" : "regular", align: "end", wrap: true },
    ],
  });
  return {
    type: "flex",
    altText: `已記錄：${expense.description} ${expense.amount} ${expense.currency}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical",
        background: { type: "linearGradient", angle: "90deg", startColor: "#6366f1", centerColor: "#8b5cf6", endColor: "#14b8a6" },
        paddingAll: "14px",
        contents: [
          {
            type: "box", layout: "horizontal", alignItems: "center", spacing: "sm",
            contents: [
              {
                type: "box", layout: "vertical", width: "18px", height: "18px",
                cornerRadius: "9px", backgroundColor: "#ffffff33",
                justifyContent: "center", alignItems: "center",
                contents: [{ type: "text", text: "✓", color: "#ffffff", size: "xxs", weight: "bold", align: "center" }],
              },
              { type: "text", text: "費用已記錄", color: "#ffffff", weight: "bold", size: "sm" },
            ],
          },
          { type: "text", text: tripName, color: "#ffffffaa", size: "xs", margin: "sm" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", backgroundColor: "#1c1c1f",
        contents: [
          { type: "text", text: expense.description, weight: "bold", size: "xl", color: "#f4f4f5" },
          darkRow("金額", `${expense.amount.toLocaleString()} ${expense.currency}`),
          ...(expense.paid_by ? [darkRow("付款人", expense.paid_by)] : []),
          darkRow("平分", expense.split_with.length > 0 ? expense.split_with.join("、") : "—"),
          ...(perPerson ? [darkRow("每人", `${perPerson} ${expense.currency}`, true)] : []),
          { type: "separator", color: "#27272a" },
          darkRow("行程", tripName),
        ],
      },
      footer: {
        type: "box", layout: "vertical", backgroundColor: "#1c1c1f",
        contents: [{
          type: "button",
          action: { type: "uri", label: "查看費用明細", uri: `${APP_BASE_URL}/trips/${tripId}?tab=expenses` },
          style: "primary", color: "#6366f1", height: "sm",
        }],
      },
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Postback handler
// ────────────────────────────────────────────────────────────────

async function handlePostback(
  data: string,
  lineUserId: string,
  replyToken: string,
  supabase: ReturnType<typeof createServiceClient>,
) {
  const params = new URLSearchParams(data);
  const action = params.get("action");
  const pendingId = params.get("id");
  if (!pendingId) return;

  const { data: pending } = await supabase
    .from("line_pending_expenses")
    .select("*")
    .eq("id", pendingId)
    .eq("line_user_id", lineUserId)
    .single() as { data: PendingExpense | null };

  if (!pending || new Date(pending.expires_at) < new Date()) {
    await replyMessage(replyToken, [{ type: "text", text: "操作已過期，請重新輸入記帳資訊。" }]);
    return;
  }

  if (action === "confirm") {
    const { error } = await supabase.from("expenses").insert({
      trip_id: pending.trip_id,
      user_id: pending.user_id,
      date: new Date().toISOString().slice(0, 10),
      description: pending.description,
      amount: pending.amount,
      currency: pending.currency,
      paid_by: pending.paid_by,
      split_with: pending.selected_people,
      notes: "via LINE Bot",
    });
    await supabase.from("line_pending_expenses").delete().eq("id", pendingId);
    if (error) { await replyMessage(replyToken, [{ type: "text", text: `記錄失敗：${error.message}` }]); return; }
    await replyMessage(replyToken, [buildSuccessFlex(
      { description: pending.description, amount: pending.amount, currency: pending.currency, paid_by: pending.paid_by, split_with: pending.selected_people },
      pending.trip_id, pending.trip_name ?? "我的行程"
    )]);
    return;
  }

  if (action === "cancel") {
    await supabase.from("line_pending_expenses").delete().eq("id", pendingId);
    await replyMessage(replyToken, [{ type: "text", text: "已取消。" }]);
    return;
  }
}

// ────────────────────────────────────────────────────────────────
// Main event handler
// ────────────────────────────────────────────────────────────────

async function handleEvent(event: LineEvent) {
  const lineUserId = event.source.userId;
  const replyToken = event.replyToken!;
  const isGroup = !!(event.source.groupId ?? event.source.roomId);
  const cid = chatId(event);
  const supabase = createServiceClient();

  if (event.type === "postback" && event.postback) {
    await handlePostback(event.postback.data, lineUserId, replyToken, supabase);
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;

  const rawText = event.message.text.trim();
  if (isGroup) {
    const isNumberReply = /^[0-9][0-9,，\s]*$/.test(rawText);
    if (!isNumberReply && !isBotMentioned(event.message)) return;
  }

  const text = isGroup && !(/^[0-9][0-9,，\s]*$/.test(rawText))
    ? stripMentions(event.message.text, event.message.mention?.mentionees ?? [])
    : rawText;

  if (!text) return;

  // Token activation: TRIP-XXXX-XXXX
  const tokenMatch = text.match(/^TRIP-([A-Z0-9]{4})-([A-Z0-9]{4})$/i);
  if (tokenMatch) {
    const raw = (tokenMatch[1] + tokenMatch[2]).toUpperCase();
    const { data: trip } = await supabase
      .from("trips")
      .select("id, name, user_id")
      .eq("line_token", raw)
      .single() as { data: { id: string; name: string; user_id: string } | null };

    if (!trip) {
      await replyMessage(replyToken, [{ type: "text", text: "連結碼無效或已失效，請在 App 重新取得。" }]);
      return;
    }

    await supabase.from("line_group_mappings").upsert(
      { group_id: cid, default_trip_id: trip.id, created_by: trip.user_id },
      { onConflict: "group_id" }
    );

    await replyMessage(replyToken, [{
      type: "flex",
      altText: `已連結行程「${trip.name}」`,
      contents: {
        type: "bubble",
        header: {
          type: "box", layout: "vertical",
          background: { type: "linearGradient", angle: "90deg", startColor: "#6366f1", centerColor: "#8b5cf6", endColor: "#14b8a6" },
          paddingAll: "14px",
          contents: [
            { type: "text", text: "✓ 行程已連結", color: "#ffffff", weight: "bold", size: "md" },
            { type: "text", text: trip.name, color: "#ffffffaa", size: "sm", margin: "sm" },
          ],
        },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#1c1c1f", paddingAll: "16px",
          contents: [
            { type: "text", text: "現在可以直接記帳了！", color: "#e4e4e7", size: "sm", wrap: true },
            { type: "separator", margin: "md", color: "#27272a" },
            { type: "text", text: "格式：描述 金額 [幣別] [付款人]", color: "#71717a", size: "xs", margin: "md", wrap: true },
            { type: "text", text: "例如：晚餐 500　　計程車 200 JPY", color: "#71717a", size: "xs", margin: "sm", wrap: true },
          ],
        },
      },
    }]);
    return;
  }

  // Look up trip for this chat
  const { data: chatMapping } = await supabase
    .from("line_group_mappings")
    .select("default_trip_id, trips(id, name, currency, people, user_id)")
    .eq("group_id", cid)
    .single() as { data: { default_trip_id: string | null; trips: TripRow | TripRow[] | null } | null };

  const tripRow = chatMapping
    ? (Array.isArray(chatMapping.trips) ? chatMapping.trips[0] : chatMapping.trips) as TripRow | null
    : null;

  if (!tripRow || !chatMapping?.default_trip_id) {
    const hint = isGroup
      ? "請先在 App 開啟行程並複製連結碼，傳到此群組即可開始記帳。"
      : "請先在 App 開啟行程並複製連結碼，傳給我即可開始記帳。";
    await replyMessage(replyToken, [{ type: "text", text: hint }]);
    return;
  }

  const tripPeople = tripRow.people ?? [];
  const primaryCurrency = tripRow.currency ? tripRow.currency.split(",")[0] : "TWD";

  // Commands
  if (text.startsWith("/")) {
    await handleCommand(text, lineUserId, tripRow, tripPeople, replyToken, supabase, chatMapping.default_trip_id);
    return;
  }

  // Number reply for split selection
  if (/^[0-9][0-9,，\s]*$/.test(text)) {
    const { data: pending } = await supabase
      .from("line_pending_expenses").select("*")
      .eq("line_user_id", lineUserId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1).single() as { data: PendingExpense | null };

    if (pending) {
      const splitWith = parseNumberSelection(text, pending.all_people);
      if (splitWith) {
        await supabase.from("line_pending_expenses").update({ selected_people: splitWith }).eq("id", pending.id);
        await replyMessage(replyToken, [buildConfirmationFlex({ ...pending, selected_people: splitWith }, splitWith)]);
        return;
      }
    }
  }

  // Expense message
  const parsed = await parseExpenseMessage(text);
  if (!parsed) {
    await replyMessage(replyToken, [{
      type: "text",
      text: "格式不對，請用：\n\n描述 金額\n描述 金額 幣別\n描述 金額 付款人\n\n例如：\n晚餐 500\n晚餐 500 JPY\n晚餐 500 Eliza",
    }]);
    return;
  }

  const currency = parsed.currency ?? primaryCurrency;
  const paid_by = parsed.paid_by ?? null;

  await supabase.from("line_pending_expenses").delete().eq("line_user_id", lineUserId);

  if (tripPeople.length === 0) {
    const { data: pendingRow } = await supabase.from("line_pending_expenses").insert({
      line_user_id: lineUserId, trip_id: tripRow.id, user_id: tripRow.user_id,
      description: parsed.description, amount: parsed.amount, currency, paid_by,
      selected_people: [], all_people: [], trip_name: tripRow.name,
    }).select().single() as { data: PendingExpense | null };
    if (pendingRow) await replyMessage(replyToken, [buildConfirmationFlex(pendingRow, [])]);
    return;
  }

  const { data: pendingRow } = await supabase.from("line_pending_expenses").insert({
    line_user_id: lineUserId, trip_id: tripRow.id, user_id: tripRow.user_id,
    description: parsed.description, amount: parsed.amount, currency, paid_by,
    selected_people: [], all_people: tripPeople, trip_name: tripRow.name,
  }).select().single() as { data: PendingExpense | null };

  if (pendingRow) await replyMessage(replyToken, [buildSplitNumberFlex(pendingRow)]);
}

// ────────────────────────────────────────────────────────────────
// Command handler
// ────────────────────────────────────────────────────────────────

async function handleCommand(
  text: string,
  lineUserId: string,
  tripRow: TripRow,
  tripPeople: string[],
  replyToken: string,
  supabase: ReturnType<typeof createServiceClient>,
  tripId: string,
) {
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const reply = (msgs: object[]) => replyMessage(replyToken, msgs);

  if (cmd === "/info") {
    await reply([{
      type: "flex", altText: `目前行程：${tripRow.name}`,
      contents: {
        type: "bubble",
        header: {
          type: "box", layout: "vertical", backgroundColor: "#18181b", paddingAll: "14px",
          contents: [{ type: "text", text: "目前行程", color: "#ffffff", weight: "bold", size: "md" }],
        },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#1c1c1f", paddingAll: "16px", spacing: "sm",
          contents: [
            { type: "text", text: tripRow.name, weight: "bold", size: "xl", color: "#f4f4f5" },
            ...(tripRow.currency ? [{ type: "text", text: `幣別：${tripRow.currency}`, size: "sm", color: "#a1a1aa" }] : []),
            ...(tripPeople.length > 0 ? [{ type: "text", text: `成員：${tripPeople.join("、")}`, size: "sm", color: "#a1a1aa", wrap: true }] : []),
          ],
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#1c1c1f",
          contents: [{
            type: "button",
            action: { type: "uri", label: "查看行程", uri: `${APP_BASE_URL}/trips/${tripId}` },
            style: "primary", color: "#6366f1", height: "sm",
          }],
        },
      },
    }]);
    return;
  }

  if (cmd === "/divided") {
    const peopleStr = parts.slice(1).join(" ");
    const people = peopleStr.split(/[,，]\s*|\s+/).map((s) => s.trim()).filter(Boolean);
    if (people.length === 0) {
      await reply([{ type: "text", text: "請輸入平分對象，例如：/divided Eliza, John" }]);
      return;
    }
    const { data: pending } = await supabase
      .from("line_pending_expenses").select("*")
      .eq("line_user_id", lineUserId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1).single() as { data: PendingExpense | null };
    if (!pending) {
      await reply([{ type: "text", text: "找不到待確認的費用，請重新輸入記帳資訊。" }]);
      return;
    }
    await supabase.from("line_pending_expenses").update({ selected_people: people }).eq("id", pending.id);
    await reply([buildConfirmationFlex({ ...pending, selected_people: people }, people)]);
    return;
  }

  if (cmd === "/help") {
    await reply([{
      type: "text",
      text: "指令列表：\n\n/info — 目前連結的行程\n/list — 最近 5 筆費用\n/help — 顯示此說明\n\n記帳格式：\n描述 金額 [幣別] [付款人]\n\n輸入後回覆號碼選平分對象\n0 全選　12 選第1和第2人",
    }]);
    return;
  }

  if (cmd === "/list") {
    const { data: expenses } = await supabase.from("expenses").select("description, amount, currency, paid_by, split_with, date")
      .eq("trip_id", tripId).order("date", { ascending: false }).limit(5);
    if (!expenses?.length) { await reply([{ type: "text", text: "這個行程還沒有費用紀錄。" }]); return; }
    const expenseRows = expenses.map((e, i) => ({
      type: "box", layout: "vertical",
      paddingTop: i === 0 ? "none" : "sm",
      paddingBottom: "sm",
      contents: [
        {
          type: "box", layout: "horizontal", alignItems: "center",
          contents: [
            { type: "text", text: e.description, weight: "bold", size: "md", color: "#e4e4e7", flex: 1 },
            { type: "text", text: `${e.amount.toLocaleString()} ${e.currency}`, size: "md", weight: "bold", color: "#a78bfa", align: "end" },
          ],
        },
        {
          type: "text",
          text: [e.paid_by ? `${e.paid_by} 付` : null, e.split_with?.length ? `${e.split_with.join("、")} 分` : null].filter(Boolean).join("　") || "—",
          size: "xs", color: "#71717a", margin: "sm",
        },
        ...(i < expenses.length - 1 ? [{ type: "separator", margin: "sm", color: "#27272a" }] : []),
      ],
    }));
    await reply([{
      type: "flex", altText: "最近 5 筆費用",
      contents: {
        type: "bubble",
        header: {
          type: "box", layout: "vertical", backgroundColor: "#18181b", paddingAll: "14px",
          contents: [
            { type: "text", text: "最近費用", color: "#ffffff", weight: "bold", size: "md" },
            { type: "text", text: tripRow.name, color: "#71717a", size: "xs", margin: "sm" },
          ],
        },
        body: { type: "box", layout: "vertical", backgroundColor: "#1c1c1f", contents: expenseRows },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#1c1c1f",
          contents: [{
            type: "button",
            action: { type: "uri", label: "查看全部費用", uri: `${APP_BASE_URL}/trips/${tripId}?tab=expenses` },
            style: "primary", color: "#6366f1", height: "sm",
          }],
        },
      },
    }]);
    return;
  }

  await reply([{ type: "text", text: "未知指令，輸入 /help 查看說明。" }]);
}

// ────────────────────────────────────────────────────────────────
// Route
// ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!verifySignature(body, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const payload = JSON.parse(body);
  await Promise.all((payload.events as LineEvent[]).map(handleEvent));
  return NextResponse.json({ ok: true });
}
