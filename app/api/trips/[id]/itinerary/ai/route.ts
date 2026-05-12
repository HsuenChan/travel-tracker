import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1].trim());
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) return JSON.parse(arr[0]);
  return JSON.parse(text.trim());
}

async function fetchWeatherSummary(
  city: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
    { headers: { "User-Agent": "travel-tracker-app/1.0" } },
  );
  const geoData = await geoRes.json();
  if (!geoData[0]) return "";

  const { lat, lon } = geoData[0];
  const today = new Date().toISOString().split("T")[0];
  const base = endDate < today
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    start_date: startDate, end_date: endDate, timezone: "auto",
  });
  const wRes = await fetch(`${base}?${params}`);
  const wData = await wRes.json();
  if (!wData.daily?.time) return "";

  const maxTemps: number[] = wData.daily.temperature_2m_max;
  const minTemps: number[] = wData.daily.temperature_2m_min;
  const codes: number[] = wData.daily.weather_code;
  const avgMax = Math.round(maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length);
  const avgMin = Math.round(minTemps.reduce((a, b) => a + b, 0) / minTemps.length);
  const rainyDays = codes.filter((c) => c >= 51).length;

  return `均溫約 ${avgMin}–${avgMax}°C${rainyDays > 0 ? `，預計 ${rainyDays} 天有雨` : "，天氣晴朗"}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as {
    action: string;
    pace?: string;
    interests?: string[];
    startTime?: string;
    endTime?: string;
    mustVisit?: string[];
    transport?: "public" | "self" | "mixed";
    carRentalStart?: string | null;
    carRentalEnd?: string | null;
  };
  const { action } = body;

  const { data: trip } = await supabase
    .from("trips")
    .select("name, countries, destinations, start_date, end_date")
    .eq("id", id)
    .single();
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const { data: rawItems } = await supabase
    .from("itinerary_items")
    .select("date, time, end_time, title, category, location")
    .eq("trip_id", id)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true });
  const items = rawItems ?? [];

  const destNames = (trip.destinations as { name: string }[] | null)?.length
    ? (trip.destinations as { name: string }[]).map((d) => d.name).join("、")
    : (trip.countries ?? "未指定目的地");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash" });

  // ── Health check ──────────────────────────────────────────
  if (action === "health_check") {
    if (items.length === 0) {
      return NextResponse.json({
        issues: [{ level: "warning", title: "尚無行程", detail: "請先新增行程項目再進行健康檢查。" }],
      });
    }

    const grouped: Record<string, typeof items> = {};
    items.forEach((item) => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    const formatted = Object.entries(grouped)
      .map(([date, dayItems]) => {
        const lines = dayItems
          .map((i) => `  ${i.time ?? "?"} ${i.title}（${i.category ?? "其他"}）${i.location ? ` @ ${i.location}` : ""}`)
          .join("\n");
        return `${date}:\n${lines}`;
      })
      .join("\n\n");

    const prompt = `分析以下旅程行程，找出問題並給建議。

旅程：${trip.name}，目的地：${destNames}
行程：
${formatted}

請以 JSON 陣列回覆（繁體中文），每個問題一個物件：
[{"level":"error","title":"標題（15字內）","detail":"說明（60字內）"}]

level 定義：
- "error"：需立即注意（時間衝突、同天超過 6 個景點）
- "warning"：建議改善（缺餐食、缺住宿、行程偏密）
- "ok"：正面評價（至多 1 條）

只輸出 JSON，不要任何前言或解釋。`;

    try {
      const result = await model.generateContent(prompt);
      const issues = extractJSON(result.response.text().trim());
      return NextResponse.json({ issues });
    } catch (err) {
      console.error("Health check AI error:", err);
      return NextResponse.json({ error: "AI generation failed", detail: String(err) }, { status: 500 });
    }
  }

  // ── Generate schedule ─────────────────────────────────────
  if (action === "generate") {
    const { pace = "normal", interests = [], startTime = "09:00", endTime = "21:00", mustVisit = [], transport = "public", carRentalStart, carRentalEnd } = body;

    let weatherSummary = "";
    try {
      const city =
        (trip.destinations as { name: string }[] | null)?.[0]?.name ??
        (trip.countries ?? "").split(/[,，、]/)[0].trim();
      if (city && trip.start_date && trip.end_date) {
        weatherSummary = await fetchWeatherSummary(city, trip.start_date, trip.end_date);
      }
    } catch { /* skip */ }

    const existingStr = items.length > 0
      ? items.map((i) => `${i.date} ${i.time ?? ""} ${i.title}`).join("\n")
      : "（無）";

    const paceLabel =
      pace === "relaxed" ? "輕鬆（每天 3–4 個景點）" :
      pace === "intensive" ? "密集（每天 6–7 個景點）" :
      "普通（每天 4–5 個景點）";

    const days = trip.start_date && trip.end_date
      ? Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1
      : "?";

    const transportLabel =
      transport === "self" ? "全程自駕" :
      transport === "mixed"
        ? carRentalStart && carRentalEnd
          ? `混合（自駕期間 ${carRentalStart} ~ ${carRentalEnd}，其餘搭大眾運輸）`
          : "混合（租車日期未定，請根據目的地分布在 notes 欄位建議最適合自駕的時段）"
        : "大眾運輸";

    const prompt = `你是一個旅遊規劃助手，請為以下旅程生成每日行程安排。

旅程：${trip.name}
目的地：${destNames}
日期：${trip.start_date} ~ ${trip.end_date}（${days} 天）
${weatherSummary ? `天氣：${weatherSummary}` : ""}
節奏：${paceLabel}
興趣偏好：${interests.length > 0 ? interests.join("、") : "綜合"}
每日時間：${startTime} – ${endTime}
交通方式：${transportLabel}
${mustVisit.length > 0 ? `必去地點（必須全部排入，AI 自行安排最佳順序）：${mustVisit.join("、")}` : ""}

已有行程（請保留，只填補空白）：
${existingStr}

輸出繁體中文 JSON 陣列（只輸出 JSON，不要前言）：
[{"date":"YYYY-MM-DD","time":"HH:mm","end_time":"HH:mm","title":"名稱","category":"food|attraction|hotel|transport|shopping|activity|other","location":"地點或null","notes":"備註或null"}]

規則：
- 必須包含每天早餐、午餐、晚餐（category: food）
- 時間不可與已有行程衝突
- 必須涵蓋 ${trip.start_date} 到 ${trip.end_date} 每一天
- 必去地點必須全部出現，依地理位置安排最有效率的順序`;

    try {
      const result = await model.generateContent(prompt);
      const raw = extractJSON(result.response.text().trim()) as Array<{
        date: string; time: string; end_time?: string;
        title: string; category?: string; location?: string; notes?: string;
      }>;

      const preview = raw.map((item, i) => ({
        _id: `ai-${Date.now()}-${i}`,
        date: item.date,
        time: item.time,
        end_time: item.end_time ?? null,
        title: item.title,
        category: item.category ?? "other",
        location: item.location ?? null,
        notes: item.notes ?? null,
        removed: false,
      }));

      return NextResponse.json({ items: preview });
    } catch (err) {
      console.error("Generate AI error:", err);
      return NextResponse.json({ error: "AI generation failed", detail: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
