import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { handleChatPostback, handleChatText, type ChatContext } from "@/lib/lineChat";
import { dailyBriefMessages, loadBriefTrip, settlementMessages, todayFor } from "@/lib/briefData";

/**
 * 後台的 LINE 模擬器。
 *
 * 跑的是 lib/lineChat 的同一批函式，所以這裡按下去真的會寫進資料庫 —— 這是刻意的：
 * 只看排版的預覽騙得過眼睛，騙不過「確認之後那筆費用到底有沒有進去」。
 */

/** 模擬器的身分固定，line_pending_expenses 才能跨請求接續同一段對話 */
const simChat = (adminId: string) => `admin-sim:${adminId}`;

async function latestExpenseId(service: ReturnType<typeof createServiceClient>, tripId: string) {
  const { data } = await service
    .from("expenses").select("id").eq("trip_id", tripId)
    .order("created_at", { ascending: false }).limit(1).single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET() {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });
  const service = createServiceClient();
  const { data, error } = await service
    .from("trips").select("id,name,start_date,end_date,currency,people")
    .order("start_date", { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trips: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse(null, { status: 404 });

  const body = await request.json().catch(() => null);
  const tripId = typeof body?.tripId === "string" ? body.tripId : null;
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const service = createServiceClient();

  if (body?.kind === "brief" || body?.kind === "settlement") {
    const trip = await loadBriefTrip(service, tripId);
    if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

    if (body.kind === "settlement") {
      const messages = await settlementMessages(service, trip);
      return NextResponse.json({
        messages: messages ?? [{ type: "text", text: "（沒有未付款項，結算不會推播）" }],
      });
    }
    const date = typeof body.date === "string" ? body.date : (trip.start_date ?? todayFor(trip));
    const messages = await dailyBriefMessages(service, trip, date);
    return NextResponse.json({
      messages: messages ?? [{ type: "text", text: `（${date} 沒有行程，這天不會推播）` }],
    });
  }

  const ctx: ChatContext = {
    chatId: simChat(admin.id),
    userId: simChat(admin.id),
    isGroup: body?.isGroup === true,
    tripOverride: tripId,
    preview: true,
  };

  const before = await latestExpenseId(service, tripId);

  const messages = typeof body?.postback === "string"
    ? await handleChatPostback(ctx, body.postback)
    : await handleChatText(ctx, String(body?.text ?? ""));

  const after = await latestExpenseId(service, tripId);
  return NextResponse.json({
    messages,
    // 模擬器真的寫了一筆進去，把 id 給前端，測完可以當場刪掉
    createdExpenseId: after && after !== before ? after : null,
  });
}

/** 刪掉模擬時建立的那筆費用 */
export async function DELETE(request: NextRequest) {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });
  const id = new URL(request.url).searchParams.get("expenseId");
  if (!id) return NextResponse.json({ error: "expenseId required" }, { status: 400 });
  const { error } = await createServiceClient().from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
