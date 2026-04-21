import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_SECTIONS = ["travel_tips", "packing_list", "driving", "metro", "bus", "transit"];

function buildPrompt(section: string, tripName: string, destinations: string, startDate: string | null, endDate: string | null): string {
  const dateRange = startDate && endDate ? `${startDate} ~ ${endDate}` : "";
  const ctx = `旅程「${tripName}」，目的地：${destinations}${dateRange ? `，日期：${dateRange}` : ""}`;

  switch (section) {
    case "travel_tips":
      return `${ctx}\n\n請用繁體中文，提供 6-8 條重要旅遊注意事項，涵蓋文化禁忌、治安、氣候穿著、消費須知、緊急聯絡等。直接條列，每條以「• 」開頭，不需前言與結語。`;

    case "packing_list":
      return `${ctx}\n\n請用繁體中文，列出行李清單，依類別分組（旅行文件、衣物、電子設備、個人衛生、藥品、其他），每類 3-5 項。格式：\n【類別】\n• 物品\n不需前言與結語。`;

    case "driving":
      return `${ctx}\n\n請用繁體中文，提供 6-8 條自駕旅遊注意事項，涵蓋靠左/靠右行駛規則、國際駕照需求、速限與交通規定、加油注意事項、停車規定、常用導航 App 推薦。直接條列，每條以「• 」開頭，不需前言與結語。`;

    case "metro":
      return `${ctx}\n\n請用繁體中文，提供搭地鐵/捷運的實用攻略 6-8 條，涵蓋購票方式（一次性/儲值卡）、推薦交通卡、重要路線/換乘站、禁止事項、實用 App 推薦。直接條列，每條以「• 」開頭，不需前言與結語。`;

    case "bus":
      return `${ctx}\n\n請用繁體中文，提供搭公車/巴士的實用資訊 6-8 條，涵蓋付款方式、上下車規則、常用路線或巴士 Pass、實用 App、與地鐵的搭配建議。直接條列，每條以「• 」開頭，不需前言與結語。`;

    case "transit":
      return `${ctx}\n\n請用繁體中文，提供轉車換乘的實用攻略 6-8 條，涵蓋機場到市區的交通方式、主要交通樞紐、各交通工具之間的換乘技巧、行李拖運注意事項。直接條列，每條以「• 」開頭，不需前言與結語。`;

    default:
      return `${ctx}\n\n請用繁體中文，提供關於「${section}」的旅遊實用資訊 6-8 條。直接條列，每條以「• 」開頭，不需前言與結語。`;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { section } = await request.json() as { section: string };
  if (!VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("name, countries, destinations, start_date, end_date")
    .eq("id", id)
    .single();

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const destNames = trip.destinations?.length
    ? (trip.destinations as { name: string }[]).map((d) => d.name).join("、")
    : (trip.countries ?? "未指定目的地");

  const prompt = buildPrompt(section, trip.name, destNames, trip.start_date, trip.end_date);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();
    return NextResponse.json({ content });
  } catch (err) {
    console.error("Gemini error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
