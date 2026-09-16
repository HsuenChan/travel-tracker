import { createServiceClient } from "@/lib/supabase/service";
import { aiBudgetGuard } from "@/lib/aiUsage";
import { parseReceipt } from "@/lib/receiptParser";
import {
  buildConfirmationFlex, buildInfoFlex, buildLinkedFlex, buildRecentFlex,
  buildSplitNumberFlex, buildSuccessFlex,
  type PendingExpense, type RecentExpense, type TripRow,
} from "@/lib/lineFlex";
import { dailyBriefMessages, loadBriefTrip, todayFor } from "@/lib/briefData";

/**
 * LINE 對話的決策層。
 *
 * 每支 handler 都是「收到這個 → 該回什麼」，**回傳**訊息而不是自己送出去。送出去的方式有兩種：
 * webhook 拿 replyToken 打 LINE API，後台模擬器直接渲染在畫面上。兩邊跑的是同一份邏輯，
 * 所以模擬器裡按下去發生的事，和群組裡按下去發生的事是同一件。
 */

type Service = ReturnType<typeof createServiceClient>;

export interface ChatContext {
  chatId: string;
  userId: string;
  isGroup: boolean;
  /** 後台模擬器用：直接指定行程，不查 line_group_mappings */
  tripOverride?: string;
  /** 後台模擬器用：只組訊息，不留下 mapping 這類真實副作用 */
  preview?: boolean;
}

const NO_REPLY: object[] = [];

const HELP_TEXT =
  "指令列表：\n\n/trip — 今天的行程\n/trip 2026-09-25 — 指定那天的行程\n/info — 目前連結的行程\n" +
  "/list — 最近 5 筆費用\n/divided 名字 — 用名字指定平分對象\n/help — 顯示此說明\n\n" +
  "記帳格式：\n描述 金額 [幣別] [付款人]\n\n輸入後回覆號碼選平分對象\n0 全選　12 選第1和第2人\n\n" +
  "更換行程：\n傳送新行程的連結碼 TRIP-XXXX-XXXX\n在 App 的「LINE Bot 記帳」複製，群組裡記得 @ 我";

const text = (t: string) => [{ type: "text", text: t }];

// ── 解析 ────────────────────────────────────────────────

async function fetchCurrencyCodes(): Promise<Set<string>> {
  try {
    const res = await fetch("https://openexchangerates.org/api/currencies.json", { next: { revalidate: 86400 } });
    const data: Record<string, string> = await res.json();
    return new Set(Object.keys(data));
  } catch {
    return new Set(["TWD", "JPY", "USD", "EUR", "HKD", "KRW", "THB", "SGD", "CNY", "MYR", "AUD", "GBP"]);
  }
}

export async function parseExpenseMessage(input: string) {
  const knownCurrencies = await fetchCurrencyCodes();
  const parts = input.trim().split(/\s+/);
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

export function isNumberReply(input: string): boolean {
  return /^[0-9][0-9,，\s]*$/.test(input.trim());
}

function parseNumberSelection(input: string, allPeople: string[]): string[] | null {
  const cleaned = input.trim();
  if (!isNumberReply(cleaned)) return null;
  const digits = cleaned.replace(/[,，\s]/g, "");
  if (digits === "0") return [...allPeople];
  const indices = [...new Set([...digits].map(Number))];
  const selected = indices.filter((i) => i >= 1 && i <= allPeople.length).map((i) => allPeople[i - 1]);
  return selected.length > 0 ? selected : null;
}

// ── 共用查詢 ─────────────────────────────────────────────

async function resolveTrip(service: Service, ctx: ChatContext): Promise<TripRow | null> {
  if (ctx.tripOverride) {
    const { data } = await service
      .from("trips").select("id, name, currency, people, user_id")
      .eq("id", ctx.tripOverride).single();
    return (data as TripRow | null) ?? null;
  }
  const { data: mapping } = await service
    .from("line_group_mappings")
    .select("default_trip_id, trips(id, name, currency, people, user_id)")
    .eq("group_id", ctx.chatId)
    .single() as { data: { default_trip_id: string | null; trips: TripRow | TripRow[] | null } | null };
  if (!mapping?.default_trip_id) return null;
  const row = Array.isArray(mapping.trips) ? mapping.trips[0] : mapping.trips;
  return (row as TripRow | null) ?? null;
}

async function startSplit(
  service: Service, ctx: ChatContext, trip: TripRow,
  draft: { description: string; amount: number; currency: string; paid_by: string | null },
): Promise<object[]> {
  const people = trip.people ?? [];
  await service.from("line_pending_expenses").delete().eq("line_user_id", ctx.userId);
  const { data: pending } = await service.from("line_pending_expenses").insert({
    line_user_id: ctx.userId,
    trip_id: trip.id,
    user_id: trip.user_id,
    description: draft.description,
    amount: draft.amount,
    currency: draft.currency,
    paid_by: draft.paid_by,
    selected_people: [],
    all_people: people,
    trip_name: trip.name,
  }).select().single() as { data: PendingExpense | null };
  if (!pending) return NO_REPLY;
  return [people.length > 0 ? buildSplitNumberFlex(pending) : buildConfirmationFlex(pending, [])];
}

// ── 文字訊息 ─────────────────────────────────────────────

export async function handleChatText(ctx: ChatContext, input: string): Promise<object[]> {
  const service = createServiceClient();
  const body = input.trim();
  if (!body) return NO_REPLY;

  const tokenMatch = body.match(/^TRIP-([A-Z0-9]{4})-([A-Z0-9]{4})$/i);
  if (tokenMatch) {
    const raw = (tokenMatch[1] + tokenMatch[2]).toUpperCase();
    const { data: trip } = await service
      .from("trips").select("id, name, user_id").eq("line_token", raw)
      .single() as { data: { id: string; name: string; user_id: string } | null };
    if (!trip) return text("連結碼無效或已失效，請在 App 重新取得。");
    // 模擬器裡綁定沒有意義：行程是下拉選單指定的，真的寫下去只會留一筆用不到的 mapping
    if (!ctx.preview) {
      await service.from("line_group_mappings").upsert(
        { group_id: ctx.chatId, default_trip_id: trip.id, created_by: trip.user_id },
        { onConflict: "group_id" },
      );
    }
    return [buildLinkedFlex(trip.name)];
  }

  const trip = await resolveTrip(service, ctx);
  if (!trip) {
    return text(ctx.isGroup
      ? "請先在 App 開啟行程並複製連結碼，傳到此群組即可開始記帳。"
      : "請先在 App 開啟行程並複製連結碼，傳給我即可開始記帳。");
  }

  if (body.startsWith("/")) return handleCommand(service, ctx, trip, body);

  if (isNumberReply(body)) {
    const { data: pending } = await service
      .from("line_pending_expenses").select("*")
      .eq("line_user_id", ctx.userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1).single() as { data: PendingExpense | null };
    if (pending) {
      const splitWith = parseNumberSelection(body, pending.all_people);
      if (splitWith) {
        await service.from("line_pending_expenses").update({ selected_people: splitWith }).eq("id", pending.id);
        return [buildConfirmationFlex({ ...pending, selected_people: splitWith }, splitWith)];
      }
    }
  }

  const parsed = await parseExpenseMessage(body);
  if (!parsed) {
    return text("格式不對，請用：\n\n描述 金額\n描述 金額 幣別\n描述 金額 付款人\n\n例如：\n晚餐 500\n晚餐 500 JPY\n晚餐 500 Eliza");
  }

  return startSplit(service, ctx, trip, {
    description: parsed.description,
    amount: parsed.amount,
    currency: parsed.currency ?? (trip.currency ? trip.currency.split(",")[0] : "TWD"),
    paid_by: parsed.paid_by,
  });
}

// ── 指令 ────────────────────────────────────────────────

async function handleCommand(
  service: Service, ctx: ChatContext, trip: TripRow, body: string,
): Promise<object[]> {
  const parts = body.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const people = trip.people ?? [];

  if (cmd === "/help") return text(HELP_TEXT);

  if (cmd === "/info") return [buildInfoFlex(trip, people)];

  /*
    /trip 用的是排程推播的同一份查詢，所以群組裡隨時查到的那天，和早上八點被推出去的那則
    會是同一份內容。日期沒給就用那趟當地的今天 —— 人在國外時，手機的今天才是對的今天。
  */
  if (cmd === "/trip") {
    const briefTrip = await loadBriefTrip(service, trip.id);
    if (!briefTrip) return text("找不到這趟行程。");
    const arg = parts[1];
    if (arg && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      return text("日期格式是 YYYY-MM-DD，例如：/trip 2026-09-25");
    }
    const date = arg ?? todayFor(briefTrip);
    const messages = await dailyBriefMessages(service, briefTrip, date);
    return messages ?? text(`${date} 沒有安排行程。`);
  }

  if (cmd === "/divided") {
    const names = parts.slice(1).join(" ").split(/[,，]\s*|\s+/).map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return text("請輸入平分對象，例如：/divided Eliza, John");
    const { data: pending } = await service
      .from("line_pending_expenses").select("*")
      .eq("line_user_id", ctx.userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1).single() as { data: PendingExpense | null };
    if (!pending) return text("找不到待確認的費用，請重新輸入記帳資訊。");
    await service.from("line_pending_expenses").update({ selected_people: names }).eq("id", pending.id);
    return [buildConfirmationFlex({ ...pending, selected_people: names }, names)];
  }

  if (cmd === "/list") {
    const { data } = await service
      .from("expenses").select("description,amount,currency,paid_by,split_with,date")
      .eq("trip_id", trip.id)
      .order("date", { ascending: false })
      .limit(5);
    const expenses = (data ?? []) as RecentExpense[];
    if (expenses.length === 0) return text("這個行程還沒有費用紀錄。");
    return [buildRecentFlex(expenses, trip.name, trip.id)];
  }

  return text("未知指令，輸入 /help 查看說明。");
}

// ── Postback（確認／取消）────────────────────────────────

export async function handleChatPostback(ctx: ChatContext, data: string): Promise<object[]> {
  const service = createServiceClient();
  const params = new URLSearchParams(data);
  const action = params.get("action");
  const pendingId = params.get("id");
  if (!pendingId) return NO_REPLY;

  const { data: pending } = await service
    .from("line_pending_expenses").select("*")
    .eq("id", pendingId).eq("line_user_id", ctx.userId)
    .single() as { data: PendingExpense | null };

  if (!pending || new Date(pending.expires_at) < new Date()) {
    return text("操作已過期，請重新輸入記帳資訊。");
  }

  if (action === "cancel") {
    await service.from("line_pending_expenses").delete().eq("id", pendingId);
    return text("已取消。");
  }

  if (action !== "confirm") return NO_REPLY;

  const { error } = await service.from("expenses").insert({
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
  await service.from("line_pending_expenses").delete().eq("id", pendingId);
  if (error) return text(`記錄失敗：${error.message}`);

  return [buildSuccessFlex(
    {
      description: pending.description, amount: pending.amount, currency: pending.currency,
      paid_by: pending.paid_by, split_with: pending.selected_people,
    },
    pending.trip_id,
    pending.trip_name ?? "我的行程",
  )];
}

// ── 收據圖片 ─────────────────────────────────────────────

/**
 * 群組裡不要求 @ 機器人：圖片訊息沒有 mention，強制要求等於這個功能用不了。
 * 代價是任何圖片都會被辨識一次，所以認不出金額時安靜結束 —— 群組裡十張有九張是風景照。
 */
export async function handleChatImage(
  ctx: ChatContext,
  // 用 loader 而不是直接收 Buffer：沒連結行程或超出預算時就不該去下載那張圖
  loadImage: () => Promise<Buffer | null>,
): Promise<object[]> {
  const service = createServiceClient();
  const trip = await resolveTrip(service, ctx);
  if (!trip) return NO_REPLY;

  if (!process.env.GEMINI_API_KEY) return NO_REPLY;
  if (await aiBudgetGuard()) return text("AI 用量已達本月上限，請先手動記帳。");

  const image = await loadImage();
  if (!image) return NO_REPLY;

  let parsed;
  try {
    parsed = await parseReceipt("image/jpeg", image.toString("base64"), {
      feature: "receipt",
      // 沒有登入 session，掛在旅程擁有者名下，後台的 AI 用量才有帳可查
      actorId: trip.user_id,
      actorName: null,
    });
  } catch {
    return NO_REPLY;
  }

  if (!parsed || typeof parsed.amount !== "number" || !(parsed.amount > 0)) {
    return ctx.isGroup ? NO_REPLY : text("這張看不出金額，可以直接打「描述 金額」記帳。");
  }

  const messages = await startSplit(service, ctx, trip, {
    description: parsed.description?.slice(0, 200) || "收據",
    amount: parsed.amount,
    currency: parsed.currency || (trip.currency ? trip.currency.split(",")[0] : "TWD"),
    paid_by: null,
  });
  if (messages.length === 0) return NO_REPLY;

  return [
    { type: "text", text: `辨識到：${parsed.description?.slice(0, 200) || "收據"}　${parsed.currency || (trip.currency ? trip.currency.split(",")[0] : "TWD")} ${parsed.amount}` },
    ...messages,
  ];
}
