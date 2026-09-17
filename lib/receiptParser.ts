import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryTransient, trackGemini, type TrackMeta } from "@/lib/aiUsage";

/**
 * 收據辨識。
 *
 * 抽出來給兩個入口共用：App 裡的拍照上傳走 /api/parse-receipt（有登入 session），
 * LINE 群組丟照片走 webhook（沒有 session，只有 service client），兩邊的 prompt
 * 與解析規則必須是同一份，否則同一張收據在兩個地方會得到不一樣的金額。
 */

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

export interface ParsedReceipt {
  description?: string;
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  notes?: string;
}

/** 回傳 Gemini 的原始文字（已去掉 markdown 圍欄） */
export async function runReceiptGemini(
  mimeType: string,
  base64: string,
  meta: Omit<TrackMeta, "model">
): Promise<string> {
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await retryTransient(() =>
    trackGemini({ ...meta, model: modelName }, () =>
      model.generateContent([{ inlineData: { mimeType, data: base64 } }, PROMPT])
    )
  );
  return result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
}

/** 解析成物件；AI 回了不是 JSON 的東西就回 null，由呼叫端決定怎麼告訴使用者 */
export async function parseReceipt(
  mimeType: string,
  base64: string,
  meta: Omit<TrackMeta, "model">
): Promise<ParsedReceipt | null> {
  const raw = await runReceiptGemini(mimeType, base64, meta);
  try {
    return JSON.parse(raw) as ParsedReceipt;
  } catch {
    return null;
  }
}
