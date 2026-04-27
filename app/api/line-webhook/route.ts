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


async function fetchCurrencyCodes(): Promise<Set<string>> {
  try {
    const res = await fetch("https://openexchangerates.org/api/currencies.json", { next: { revalidate: 86400 } });
    const data: Record<string, string> = await res.json();
    return new Set(Object.keys(data));
  } catch {
    return new Set(["TWD", "JPY", "USD", "EUR", "HKD", "KRW", "THB", "SGD", "CNY", "MYR", "AUD", "GBP"]);
  }
}

// 格式：描述 金額 [幣別] [付款人]
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

// 解析數字選人：0=全部, 1=第一個人, 12=第一二個人
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

type TripRow = { id: string; name: string; currency: string | null; people: string[] | null };
type MappingRow = {
  user_id: string;
  default_trip_id: string | null;
  default_person: string | null;
  trips: TripRow | TripRow[] | null;
};
type GroupMappingRow = {
  default_trip_id: string | null;
  trips: TripRow | TripRow[] | null;
};
type Mentionee = { index: number; length: number; userId: string; type: string };
type LineEvent = {
  type: string;
  replyToken?: string;
  source: { type?: "user" | "group" | "room"; userId: string; groupId?: string; roomId?: string };
  message?: { type: string; text: string; mention?: { mentionees: Mentionee[] } };
  postback?: { data: string };
};

function isBotMentioned(message: NonNullable<LineEvent["message"]>): boolean {
  if (!BOT_USER_ID) return true; // if not configured, always respond
  return message.mention?.mentionees.some(m => m.userId === BOT_USER_ID) ?? false;
}

function stripMentions(text: string, mentionees: Mentionee[]): string {
  const sorted = [...mentionees].sort((a, b) => b.index - a.index);
  let result = text;
  for (const m of sorted) result = result.slice(0, m.index) + result.slice(m.index + m.length);
  return result.trim();
}

// ────────────────────────────────────────────────────────────────
// Flex Messages
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

function buildPersonSelectFlex(people: string[], currentPerson: string | null, tripName: string) {
  return {
    type: "flex",
    altText: "選擇你的身份",
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#18181b", paddingAll: "14px",
        contents: [
          { type: "text", text: "你是誰？", color: "#ffffff", weight: "bold", size: "md" },
          { type: "text", text: "選擇後，記帳時付款人預設為你", color: "#71717a", size: "xs", margin: "sm" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", backgroundColor: "#1c1c1f",
        contents: [
          { type: "text", text: tripName, weight: "bold", size: "sm", color: "#a1a1aa", margin: "sm" },
          ...people.map((p) => ({
            type: "button",
            action: { type: "postback", label: p, data: `action=setperson&name=${encodeURIComponent(p)}` },
            style: "primary",
            color: p === currentPerson ? "#6366f1" : "#3f3f46",
            height: "sm", margin: "sm",
          })),
        ],
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
  groupId: string | null = null,
) {
  const params = new URLSearchParams(data);
  const action = params.get("action");

  // 選行程
  if (action === "settrip") {
    const tripId = params.get("id")!;
    const { data: trip } = await supabase.from("trips").select("id, name, currency, people")
      .eq("id", tripId).single() as { data: TripRow | null };
    if (!trip) { await replyMessage(replyToken, [{ type: "text", text: "找不到該行程。" }]); return; }
    const { data: mapping } = await supabase.from("line_user_mappings")
      .select("user_id").eq("line_user_id", lineUserId).single() as { data: { user_id: string } | null };
    if (!mapping) return;
    await supabase.from("line_user_mappings").update({ default_trip_id: tripId, default_person: null }).eq("line_user_id", lineUserId);
    if (groupId) {
      await supabase.from("line_group_mappings").upsert(
        { group_id: groupId, default_trip_id: tripId, created_by: mapping.user_id },
        { onConflict: "group_id" }
      );
    }
    const people = trip.people ?? [];
    const prefix = groupId ? "群組" : "";
    const messages: object[] = [{ type: "text", text: `已設定${prefix}預設行程「${trip.name}」✓` }];
    if (people.length > 0 && !groupId) messages.push(buildPersonSelectFlex(people, null, trip.name));
    await replyMessage(replyToken, messages);
    return;
  }

  // 選身份
  if (action === "setperson") {
    const person = params.get("name")!;
    await supabase.from("line_user_mappings").update({ default_person: person }).eq("line_user_id", lineUserId);
    await replyMessage(replyToken, [{ type: "text", text: `已設定「${person}」為預設付款人 ✓` }]);
    return;
  }

  // 確認 / 取消費用
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
  const groupId = event.source.groupId ?? event.source.roomId ?? null;
  const isGroup = !!groupId;
  const supabase = createServiceClient();

  if (event.type === "postback" && event.postback) {
    await handlePostback(event.postback.data, lineUserId, replyToken, supabase, groupId);
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;

  // 群組裡：純數字回覆（選人）不要求 @mention，其他都要
  const rawText = event.message.text.trim();
  if (isGroup) {
    const isNumberReply = /^[0-9][0-9,，\s]*$/.test(rawText);
    if (!isNumberReply && !isBotMentioned(event.message)) return;
  }

  const text = isGroup && !(/^[0-9][0-9,，\s]*$/.test(rawText))
    ? stripMentions(event.message.text, event.message.mention?.mentionees ?? [])
    : rawText;

  if (!text) return;

  // 綁定驗證碼（1 對 1 才支援）
  if (/^\d{6}$/.test(text)) {
    if (isGroup) {
      await replyMessage(replyToken, [{ type: "text", text: "請在與 Bot 的私人對話中完成帳號綁定。" }]);
      return;
    }
    const { data: codeRow } = await supabase
      .from("line_binding_codes").select("user_id, expires_at, used").eq("code", text).single();
    if (!codeRow || codeRow.used || new Date(codeRow.expires_at) < new Date()) {
      await replyMessage(replyToken, [{ type: "text", text: "驗證碼無效或已過期，請在 App 重新產生。" }]);
      return;
    }
    await supabase.from("line_binding_codes").update({ used: true }).eq("code", text);
    await supabase.from("line_user_mappings").upsert(
      { line_user_id: lineUserId, user_id: codeRow.user_id }, { onConflict: "line_user_id" }
    );
    await replyMessage(replyToken, [{ type: "text", text: "帳號綁定成功！\n\n接下來：\n1. 輸入 /trips 選擇行程\n2. 選完行程後選擇你是誰\n3. 就可以開始快速記帳了！" }]);
    return;
  }

  // 查詢使用者設定
  const { data: mapping } = await supabase
    .from("line_user_mappings")
    .select("user_id, default_trip_id, default_person, trips(id, name, currency, people)")
    .eq("line_user_id", lineUserId)
    .single() as { data: MappingRow | null };

  if (!mapping) {
    await replyMessage(replyToken, [{ type: "text", text: "請先在與 Bot 的私人對話中完成帳號綁定！" }]);
    return;
  }

  // 群組有共用行程設定時，優先使用群組行程
  let effectiveTripId = mapping.default_trip_id;
  let effectiveTripRow = (Array.isArray(mapping.trips) ? mapping.trips[0] : mapping.trips) as TripRow | null;

  if (isGroup && groupId) {
    const { data: groupMapping } = await supabase
      .from("line_group_mappings")
      .select("default_trip_id, trips(id, name, currency, people)")
      .eq("group_id", groupId)
      .single() as { data: GroupMappingRow | null };
    if (groupMapping?.default_trip_id) {
      effectiveTripId = groupMapping.default_trip_id;
      const gt = (Array.isArray(groupMapping.trips) ? groupMapping.trips[0] : groupMapping.trips) as TripRow | null;
      if (gt) effectiveTripRow = gt;
    }
  }

  const tripPeople = effectiveTripRow?.people ?? [];
  const primaryCurrency = effectiveTripRow?.currency ? effectiveTripRow.currency.split(",")[0] : "TWD";

  // 指令
  if (text.startsWith("/")) {
    await handleCommand(text, lineUserId, mapping, effectiveTripRow, tripPeople, replyToken, supabase, groupId, effectiveTripId);
    return;
  }

  // 數字選人回覆（有待確認的 pending 時）
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
        await supabase.from("line_pending_expenses")
          .update({ selected_people: splitWith }).eq("id", pending.id);
        await replyMessage(replyToken, [buildConfirmationFlex({ ...pending, selected_people: splitWith }, splitWith)]);
        return;
      }
    }
  }

  // 解析記帳訊息
  const parsed = await parseExpenseMessage(text);
  if (!parsed) {
    await replyMessage(replyToken, [{
      type: "text",
      text: "格式不對，請用：\n\n描述 金額\n描述 金額 幣別\n描述 金額 付款人\n\n例如：\n晚餐 500\n晚餐 500 JPY\n晚餐 500 Eliza",
    }]);
    return;
  }

  if (!effectiveTripId) {
    const hint = isGroup ? "請先用 @Bot /settrip 設定群組行程。" : "還沒設定預設行程，請輸入 /trips 選擇行程。";
    await replyMessage(replyToken, [{ type: "text", text: hint }]);
    return;
  }

  const currency = parsed.currency ?? primaryCurrency;
  const paid_by = parsed.paid_by ?? mapping.default_person ?? null;

  // 清除舊 pending
  await supabase.from("line_pending_expenses").delete().eq("line_user_id", lineUserId);

  // 無成員 → 直接跳確認卡
  if (tripPeople.length === 0) {
    const { data: pendingRow } = await supabase.from("line_pending_expenses").insert({
      line_user_id: lineUserId, trip_id: effectiveTripId, user_id: mapping.user_id,
      description: parsed.description, amount: parsed.amount, currency, paid_by,
      selected_people: [], all_people: [], trip_name: effectiveTripRow?.name ?? "我的行程",
    }).select().single() as { data: PendingExpense | null };
    if (pendingRow) await replyMessage(replyToken, [buildConfirmationFlex(pendingRow, [])]);
    return;
  }

  // 有成員 → 顯示數字選人卡
  const { data: pendingRow } = await supabase.from("line_pending_expenses").insert({
    line_user_id: lineUserId, trip_id: effectiveTripId, user_id: mapping.user_id,
    description: parsed.description, amount: parsed.amount, currency, paid_by,
    selected_people: [], all_people: tripPeople, trip_name: effectiveTripRow?.name ?? "我的行程",
  }).select().single() as { data: PendingExpense | null };

  if (pendingRow) await replyMessage(replyToken, [buildSplitNumberFlex(pendingRow)]);
}

// ────────────────────────────────────────────────────────────────
// Command handler
// ────────────────────────────────────────────────────────────────

async function handleCommand(
  text: string,
  lineUserId: string,
  mapping: MappingRow,
  tripRow: TripRow | null,
  tripPeople: string[],
  replyToken: string,
  supabase: ReturnType<typeof createServiceClient>,
  groupId: string | null = null,
  effectiveTripId: string | null = null,
) {
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  const reply = (msgs: object[]) => replyMessage(replyToken, msgs);

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
      text: "指令列表：\n\n/trips — 選擇預設行程\n/me — 設定我是誰\n/list — 最近 5 筆費用\n/help — 顯示此說明\n\n記帳格式：\n描述 金額 [幣別] [付款人]\n\n輸入後回覆號碼選平分對象\n0 全選　12 選第1和第2人",
    }]);
    return;
  }

  if (cmd === "/trips") {
    const { data: trips } = await supabase.from("trips").select("id, name, currency")
      .eq("user_id", mapping.user_id).order("created_at", { ascending: false }).limit(8);
    if (!trips?.length) { await reply([{ type: "text", text: "還沒有行程，請先在 App 建立行程。" }]); return; }
    await reply([{
      type: "flex", altText: "選擇預設行程",
      contents: {
        type: "bubble",
        header: {
          type: "box", layout: "vertical", backgroundColor: "#18181b", paddingAll: "14px",
          contents: [
            { type: "text", text: "選擇預設行程", color: "#ffffff", weight: "bold", size: "md" },
            { type: "text", text: "點選行程來設為預設", color: "#71717a", size: "xs", margin: "sm" },
          ],
        },
        body: {
          type: "box", layout: "vertical", spacing: "sm", backgroundColor: "#1c1c1f",
          contents: trips.map((t) => ({
            type: "button",
            action: { type: "postback", label: t.name, data: `action=settrip&id=${t.id}` },
            style: "primary",
            color: t.id === effectiveTripId ? "#6366f1" : "#3f3f46",
            height: "sm", margin: "sm",
          })),
        },
      },
    }]);
    return;
  }

  if (cmd === "/settrip") {
    const tripId = parts[1];
    if (!tripId) { await reply([{ type: "text", text: "請輸入 /settrip <行程ID>" }]); return; }
    const { data: trip } = await supabase.from("trips").select("id, name, currency, people")
      .eq("id", tripId).single() as { data: TripRow | null };
    if (!trip) { await reply([{ type: "text", text: "找不到該行程。" }]); return; }
    await supabase.from("line_user_mappings").update({ default_trip_id: tripId, default_person: null }).eq("line_user_id", lineUserId);
    if (groupId) {
      await supabase.from("line_group_mappings").upsert(
        { group_id: groupId, default_trip_id: tripId, created_by: mapping.user_id },
        { onConflict: "group_id" }
      );
    }
    const people = trip.people ?? [];
    const prefix = groupId ? "群組" : "";
    const messages: object[] = [{ type: "text", text: `已設定${prefix}預設行程「${trip.name}」✓` }];
    if (people.length > 0 && !groupId) messages.push(buildPersonSelectFlex(people, null, trip.name));
    await reply(messages);
    return;
  }

  if (cmd === "/me") {
    if (!tripRow) { await reply([{ type: "text", text: "還沒設定預設行程，請先輸入 /trips。" }]); return; }
    if (tripPeople.length === 0) { await reply([{ type: "text", text: "這個行程還沒有設定成員，請先在 App 編輯行程。" }]); return; }
    await reply([buildPersonSelectFlex(tripPeople, mapping.default_person, tripRow.name)]);
    return;
  }

  if (cmd === "/setperson") {
    const person = parts.slice(1).join(" ");
    if (!person) { await reply([{ type: "text", text: "請輸入 /setperson <姓名>" }]); return; }
    await supabase.from("line_user_mappings").update({ default_person: person }).eq("line_user_id", lineUserId);
    await reply([{ type: "text", text: `已設定「${person}」為預設付款人 ✓\n之後記帳付款人預設就是你！` }]);
    return;
  }

  if (cmd === "/list") {
    const tripIdToUse = effectiveTripId ?? mapping.default_trip_id;
    if (!tripIdToUse) { await reply([{ type: "text", text: "還沒設定預設行程，請輸入 /trips 選擇。" }]); return; }
    const { data: expenses } = await supabase.from("expenses").select("description, amount, currency, paid_by, split_with, created_at")
      .eq("trip_id", tripIdToUse).order("created_at", { ascending: false }).limit(5);
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
            { type: "text", text: tripRow?.name ?? "我的行程", color: "#71717a", size: "xs", margin: "sm" },
          ],
        },
        body: { type: "box", layout: "vertical", backgroundColor: "#1c1c1f", contents: expenseRows },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#1c1c1f",
          contents: [{
            type: "button",
            action: { type: "uri", label: "查看全部費用", uri: `${APP_BASE_URL}/trips/${tripIdToUse}?tab=expenses` },
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
