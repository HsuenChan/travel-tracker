import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

const PROMPT = `You are a receipt/invoice parser. Extract expense information from this receipt image.
The receipt may be in any language and any country's format. Preserve the original language for item names but add Chinese translations.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "description": "Merchant name and main purpose. If non-English/Chinese, include original + Chinese translation. E.g.: 'さくら食堂 Sakura Shokudo 桜食堂餐廳' or 'Supermarché Casino 超級市場'",
  "amount": 1234.56,
  "currency": "JPY",
  "date": "YYYY-MM-DD or empty string",
  "category": "food | transport | accommodation | shopping | activity | other",
  "notes": "Itemized list if available. Each item on a new line: original name + Chinese translation + amount. E.g.:\\nラーメン 拉麵 ¥800\\nビール 啤酒 ¥500"
}

Rules:
- amount: total amount after tax as a number, no currency symbols
- currency: 3-letter ISO code (JPY, KRW, EUR, THB, USD, TWD, etc.) — detect from receipt symbols or context
- date: from the receipt date field, format as YYYY-MM-DD
- category: best guess based on merchant type
- notes: only include if receipt has itemized list; keep concise`;

async function runGemini(mimeType: string, base64: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash" });
  const result = await model.generateContent([{ inlineData: { mimeType, data: base64 } }, PROMPT]);
  return result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const mimeType = file.type;
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    return NextResponse.json({ error: "請上傳圖片（JPG/PNG/WebP）或 PDF" }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const raw = await runGemini(mimeType, base64);
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
