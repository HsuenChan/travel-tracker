"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { App, Select, Checkbox, Input, Button, Spin } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { recentTripIds } from "@/lib/recentTrips";
import { getCountryCodes } from "@/lib/countries";
import { SOURCE_LABEL, type ParsedShare } from "@/lib/sharedLink";
import type { ParsedPlace } from "@/lib/placeParser";

/**
 * 分享進來之後的整段流程。
 *
 * 先解析再存，不是先存再補：口袋名單是精挑的清單，AI 抽錯時塞進去的爛資料，之後要花更久清掉。
 * 代價是要等抓取（實測 11～17 秒）加上 AI（6 秒），所以進度要講清楚現在在做什麼。
 */

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 連結文字去掉 https://www. —— 備註那一行不需要被一長串網址佔滿 */
function shortLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

type Trip = {
  id: string; name: string; start_date: string | null;
  countries: string | null; country_codes: string | null;
};

type Phase = "idle" | "working" | "ready" | "saving" | "done";

const REASON_TEXT: Record<string, string> = {
  no_token: "還沒設定抓取服務的金鑰，先手動輸入名稱。",
  timeout: "這則讀太久了，先手動輸入名稱。",
  not_found: "讀不到這則貼文——可能是私人帳號或已被刪除。",
  error: "讀取時出錯了，先手動輸入名稱。",
  no_ai: "AI 沒有設定，先手動輸入名稱。",
  over_budget: "AI 用量已達本月上限，先手動輸入名稱。",
  unparsable: "AI 回了看不懂的東西，先手動輸入名稱。",
  no_place: "這則裡看不出具體地點，自己打一個吧。",
};

export default function ShareTargetClient({ parsed }: { parsed: ParsedShare }) {
  const { message: toast } = App.useApp();
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState("");
  const [places, setPlaces] = useState<ParsedPlace[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | undefined>();
  const [savedTo, setSavedTo] = useState<Trip | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [useImage, setUseImage] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/sheets")
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((d) => setTrips(d.trips ?? []))
      .catch(() => setTrips([]));
  }, []);

  /*
    預設挑哪一趟：先看地點的國家對得上哪一趟 —— 存佛羅倫斯的廣場時，要的顯然是義大利那趟，
    而不是清單第一筆。對不上才退回最近開過的，再退回第一筆。
    使用者自己選過就不再覆蓋。
  */
  useEffect(() => {
    if (touched || trips.length === 0) return;
    const wanted = places
      .flatMap((p) => getCountryCodes(p.country ?? ""))
      .filter(Boolean);
    const byCountry = wanted.length
      ? trips.find((t) =>
          getCountryCodes(t.countries ?? "", t.country_codes ?? "").some((c) => wanted.includes(c))
        )
      : undefined;
    const recent = recentTripIds().find((id) => trips.some((t) => t.id === id));
    setTripId(byCountry?.id ?? recent ?? trips[0]?.id);
  }, [trips, places, touched]);

  const extract = useCallback(async () => {
    if (!parsed.link) return;
    setPhase("working");
    setStep("讀取貼文中…");
    const slow = setTimeout(() => setStep("還在讀，這則比較久…"), 9000);
    try {
      const res = await fetchWithAuth("/api/share/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.link }),
      });
      clearTimeout(slow);
      if (!res.ok) { setReason("error"); setPhase("ready"); return; }
      const data = await res.json();
      const found: ParsedPlace[] = data.places ?? [];
      setPlaces(found);
      setPicked(new Set(found.map((_, i) => i)));
      setReason(data.reason ?? null);
      setImageUrl(data.post?.imageUrl ?? null);
      setPhase("ready");
    } catch {
      clearTimeout(slow);
      setReason("error");
      setPhase("ready");
    }
  }, [parsed.link]);

  useEffect(() => { if (parsed.link) extract(); }, [parsed.link, extract]);

  async function save() {
    const chosen = places.filter((_, i) => picked.has(i));
    const names = chosen.length > 0 ? chosen : (manual.trim() ? [{ name: manual.trim() } as ParsedPlace] : []);
    if (names.length === 0) { toast.warning("至少要有一個地點"); return; }
    if (!tripId) { toast.warning("請選一趟旅程"); return; }

    setPhase("saving");
    const payload = names.map((place) => {
      const where = [place.city, place.country].filter(Boolean).join("、");
      // 備註是 HTML（行程頁用 dangerouslySetInnerHTML 渲染），純文字換行不會斷行、
      // 網址也不會變成連結 —— processLinks 只幫既有的 <a> 補 target，不會自己 linkify
      const notes = [
        where ? `<p>${escapeHtml(where)}</p>` : null,
        // 貼文給了好幾條（買票、時段、價格）時 note 會是多行，一行一段才讀得下去
        ...(place.note ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
          .map((l) => `<p>${escapeHtml(l)}</p>`),
        parsed.link
          ? `<p><a href="${escapeHtml(parsed.link)}">${escapeHtml(shortLink(parsed.link))}</a></p>`
          : null,
      ].filter(Boolean).join("");
      return { title: place.name, category: place.category ?? "other", notes };
    });

    const res = await fetchWithAuth("/api/share/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, places: payload, imageUrl: useImage ? imageUrl : null }),
    });
    const ok = res.ok ? ((await res.json()).saved ?? 0) : 0;

    if (ok === 0) { toast.error("存入失敗"); setPhase("ready"); return; }
    setSavedTo(trips.find((t) => t.id === tripId) ?? null);
    setPhase("done");
  }

  if (!parsed.link) {
    return (
      <p className="mt-4 text-[14px] leading-relaxed text-zinc-400">
        這一頁是給系統分享用的落點，直接打開不會有東西。
        在 IG 或 Threads 按分享、選 Travel Tracker，收到的內容就會出現在這裡。
      </p>
    );
  }

  if (phase === "done") {
    return (
      <div className="mt-6">
        <p className="text-[15px] font-semibold text-zinc-100">已加入「{savedTo?.name}」的口袋名單</p>
        <p className="mt-1 text-[13px] text-zinc-500">之後把它拖到某一天就排進行程了。</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/trips/${tripId}?tab=itinerary`}>
            <Button type="primary">打開那趟旅程</Button>
          </Link>
          <Link href="/"><Button>回到旅程列表</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
          {SOURCE_LABEL[parsed.source]}
        </div>
        <div className="mt-1 break-all font-mono text-[11px] text-zinc-500">{parsed.link}</div>
      </div>

      {phase === "working" && (
        <div className="mt-8 flex flex-col items-center gap-3 py-6">
          <Spin />
          <div className="text-[13px] text-zinc-400">{step}</div>
          <div className="text-[11px] text-zinc-600">讀貼文加上找地點大約 20 秒</div>
        </div>
      )}

      {(phase === "ready" || phase === "saving") && (
        <>
          {reason && (
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-200/80">
              {REASON_TEXT[reason] ?? "解析失敗，先手動輸入名稱。"}
            </p>
          )}

          {places.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                找到 {places.length} 個地點
              </div>
              {places.map((p, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <Checkbox
                    disabled={phase === "saving"}
                    checked={picked.has(i)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(i); else next.delete(i);
                      setPicked(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-100">{p.name}</div>
                    {(p.city || p.country) && (
                      <div className="mt-0.5 text-[12px] text-zinc-500">
                        {[p.city, p.country].filter(Boolean).join("、")}
                      </div>
                    )}
                    {p.note && <div className="mt-1 text-[12px] leading-relaxed text-zinc-400">{p.note}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}

          {places.length === 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">地點名稱</div>
              <Input
                disabled={phase === "saving"}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="例如：Piazza del Duomo 主教堂廣場"
              />
            </div>
          )}

          {imageUrl && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">封面照片</div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <Checkbox
                  disabled={phase === "saving"}
                  checked={useImage}
                  onChange={(e) => setUseImage(e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-zinc-100">用這張當封面</div>
                  {/*
                    預設不勾：Reels 的封面是發文者自己挑的一幀，現在很多人拿它當標題卡，
                    和地點沒有關係。我們拿不到「哪一幀才是現場」，所以讓使用者看過再決定。
                  */}
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                    這是 Reels 的封面，由發文者自己挑的一幀，不一定是現場畫面——常常只是標題卡。
                  </p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl border border-white/[0.08] object-cover"
                />
              </label>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">存到哪一趟</div>
            <Select
              disabled={phase === "saving"}
              value={tripId}
              onChange={(v) => { setTripId(v); setTouched(true); }}
              placeholder="選一趟旅程…"
              showSearch
              optionFilterProp="label"
              style={{ width: "100%" }}
              options={trips.map((t) => ({
                value: t.id,
                label: t.start_date ? `${t.name}（${t.start_date}）` : t.name,
              }))}
            />
          </div>

          <Button
            type="primary"
            block
            size="large"
            className="!mt-5"
            loading={phase === "saving"}
            onClick={save}
          >
            加入口袋名單
          </Button>

          <Link href="/" className="mt-4 block text-center text-[13px] text-zinc-500">
            取消
          </Link>
        </>
      )}
    </div>
  );
}
