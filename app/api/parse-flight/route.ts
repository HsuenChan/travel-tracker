import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAuthenticatedClient } from "@/lib/google-oauth";

const PROMPT = `Extract ALL flight segments from this document or image (including connecting flights).
Return ONLY a JSON array. Each element represents one flight leg:
[
  {
    "type": "飛機",
    "from": "departure city name",
    "to": "destination city name",
    "fromIata": "departure airport IATA code (3 letters) or empty string",
    "toIata": "destination airport IATA code (3 letters) or empty string",
    "date": "YYYY-MM-DD or empty string",
    "time": "HH:mm 24-hour format or empty string",
    "flightNo": "airline + flight number e.g. CI061 or empty string",
    "aircraft": "aircraft type e.g. A350-900 or empty string"
  }
]
If there is only one flight, still return an array with one element.
Return only the JSON array, no markdown, no explanation.`;

async function runGemini(mimeType: string, base64: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash" });
  const result = await model.generateContent([{ inlineData: { mimeType, data: base64 } }, PROMPT]);
  return result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
}

export async function POST(request: NextRequest) {
  const authClient = await getAuthenticatedClient();
  if (!authClient) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let mimeType: string;
  let base64: string;

  if (contentType.includes("application/json")) {
    // Source: Google Photos baseUrl
    const { photoUrl } = await request.json() as { photoUrl: string };
    if (!photoUrl) return NextResponse.json({ error: "No photoUrl provided" }, { status: 400 });
    const imgRes = await fetch(`${photoUrl}=w1600`);
    if (!imgRes.ok) return NextResponse.json({ error: "Failed to download photo from Google Photos" }, { status: 502 });
    mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
    base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
  } else {
    // Source: file upload (FormData)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    mimeType = file.type;
    if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
      return NextResponse.json({ error: "請上傳圖片（JPG/PNG/WebP）或 PDF 檔案" }, { status: 400 });
    }
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  }

  try {
    const raw = await runGemini(mimeType, base64);
    try {
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: "AI 返回的格式無法解析，請再試一次", raw }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parse-flight] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
