import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiBudgetGuard } from "@/lib/aiUsage";
import { runReceiptGemini } from "@/lib/receiptParser";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  // 付費層按 token 計價，超過設定的每月預算就先擋下來，訊息講清楚是什麼狀況
  const overBudget = await aiBudgetGuard();
  if (overBudget) return NextResponse.json({ error: overBudget.error }, { status: overBudget.status });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const mimeType = file.type;
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    return NextResponse.json({ error: "請上傳圖片（JPG/PNG/WebP）或 PDF" }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const raw = await runReceiptGemini(mimeType, base64, { feature: "receipt", actorId: user.id, actorName: user.email ?? null });
    try {
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: "AI 返回的格式無法解析，請再試一次", raw }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parse-receipt] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
