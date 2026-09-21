"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { App, Select, Segmented, Checkbox, Input, Button, Spin } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { recentTripIds } from "@/lib/recentTrips";
import { getCountryCodes } from "@/lib/countries";
import { SOURCE_LABEL, type ParsedShare } from "@/lib/sharedLink";
import type { ParsedPlace, PostDigest } from "@/lib/placeParser";

/**
 * 分享進來之後的整段流程。
 *
 * 先解析再存，不是先存再補：口袋名單是精挑的清單，AI 抽錯時塞進去的爛資料，之後要花更久清掉。
 * 代價是要等抓取（實測 11～17 秒）加上 AI（6 秒），所以進度要講清楚現在在做什麼。
 *
 * 一次只存一個目的地。同一則貼文想同時進口袋名單和筆記的情況少，為此把三組內容同時攤在
 * 手機螢幕上，代價比再分享一次大得多。
 */

type Trip = {
  id: string; name: string; start_date: string | null;
  countries: string | null; country_codes: string | null;
};

type Phase = "idle" | "working" | "ready" | "saving" | "done";

type Target = "wishlist" | "souvenir" | "note";

const TARGETS: { value: Target; label: string }[] = [
  { value: "wishlist", label: "口袋名單" },
  { value: "souvenir", label: "伴手禮" },
  { value: "note", label: "旅遊筆記" },
];

const SAVE_LABEL: Record<Target, string> = {
  wishlist: "加入口袋名單",
  souvenir: "加入伴手禮",
  note: "寫進旅遊筆記",
};

/** 地址是誰給的，直接標在欄位旁邊 —— 查來的那種本來就可能查錯，要讓人一眼看出該不該確認 */
const ADDRESS_SOURCE: Record<string, { text: string; className: string }> = {
  post: { text: "貼文寫的", className: "text-emerald-300/70" },
  map: { text: "貼文的地圖連結", className: "text-emerald-300/70" },
  lookup: { text: "查到的，確認一下", className: "text-amber-300/70" },
  manual: { text: "你填的", className: "text-violet-300/70" },
};

const REASON_TEXT: Record<string, string> = {
  no_token: "還沒設定抓取服務的金鑰，先手動輸入名稱。",
  timeout: "這則讀太久了，先手動輸入名稱。",
  not_found: "讀不到這則貼文——可能是私人帳號或已被刪除。",
  error: "讀取時出錯了，先手動輸入名稱。",
  no_ai: "AI 沒有設定，先手動輸入名稱。",
  over_budget: "AI 用量已達本月上限，先手動輸入名稱。",
  unparsable: "AI 回了看不懂的東西，先手動輸入名稱。",
  ai_error: "AI 服務暫時忙不過來（重試過幾次了），先手動輸入名稱，或等幾分鐘再分享一次。",
  no_place: "這則裡看不出具體地點，自己打一個吧。",
};

const DONE_TEXT: Record<Target, { title: (trip: string) => string; hint: string; tab: string }> = {
  wishlist: {
    title: (trip) => `已加入「${trip}」的口袋名單`,
    hint: "之後把它拖到某一天就排進行程了。",
    tab: "itinerary",
  },
  souvenir: {
    title: (trip) => `已加入「${trip}」的伴手禮清單`,
    hint: "買到了回來勾掉就行。",
    tab: "souvenirs",
  },
  note: {
    title: (trip) => `已寫進「${trip}」的旅遊筆記`,
    hint: "接在筆記最後面，要改隨時可以編輯。",
    tab: "notes",
  },
};

/*
  預設存到哪：整串都是可以帶回家的東西就是伴手禮貼文；一個地點都沒抽到、但有重點整理的
  通常是攻略型貼文（買票、轉乘），那種的歸宿是筆記。其餘照舊走口袋名單。
*/
function defaultTarget(places: ParsedPlace[], digest: PostDigest | null): Target {
  if (places.length === 0 && digest) return "note";
  if (places.length > 0 && places.every((p) => p.kind === "souvenir")) return "souvenir";
  return "wishlist";
}

export default function ShareTargetClient({ parsed }: { parsed: ParsedShare }) {
  const { message: toast } = App.useApp();
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState("");
  const [places, setPlaces] = useState<ParsedPlace[]>([]);
  const [digest, setDigest] = useState<PostDigest | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | undefined>();
  const [savedTo, setSavedTo] = useState<Trip | null>(null);
  const [savedTarget, setSavedTarget] = useState<Target>("wishlist");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [useImage, setUseImage] = useState(false);
  const [touched, setTouched] = useState(false);
  const [target, setTarget] = useState<Target>("wishlist");

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
      const foundDigest: PostDigest | null = data.digest ?? null;
      setPlaces(found);
      setDigest(foundDigest);
      setTarget(defaultTarget(found, foundDigest));
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

  function editAddress(index: number, value: string) {
    setPlaces((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, address: value, addressSource: value.trim() ? "manual" : undefined } : p
      )
    );
  }

  async function save() {
    if (!tripId) { toast.warning("請選一趟旅程"); return; }

    const chosen = places.filter((_, i) => picked.has(i));
    const items = chosen.length > 0 ? chosen : (manual.trim() ? [{ name: manual.trim() } as ParsedPlace] : []);
    if (target === "note" && !digest) { toast.warning("這則沒有可以寫進筆記的重點"); return; }
    if (target !== "note" && items.length === 0) { toast.warning("至少要有一個項目"); return; }

    setPhase("saving");
    const res = await fetchWithAuth("/api/share/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        target,
        link: parsed.link,
        places: target === "note" ? [] : items,
        digest: target === "note" ? digest : null,
        // 筆記是一整份文件，塞一張封面進去只會打斷閱讀
        imageUrl: target !== "note" && useImage ? imageUrl : null,
      }),
    });
    const ok = res.ok ? ((await res.json()).saved ?? 0) : 0;

    if (ok === 0) { toast.error("存入失敗"); setPhase("ready"); return; }
    setSavedTo(trips.find((t) => t.id === tripId) ?? null);
    setSavedTarget(target);
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
    const done = DONE_TEXT[savedTarget];
    return (
      <div className="mt-6">
        <p className="text-[15px] font-semibold text-zinc-100">{done.title(savedTo?.name ?? "")}</p>
        <p className="mt-1 text-[13px] text-zinc-500">{done.hint}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/trips/${tripId}?tab=${done.tab}`}>
            <Button type="primary">打開那趟旅程</Button>
          </Link>
          <Link href="/"><Button>回到旅程列表</Button></Link>
        </div>
      </div>
    );
  }

  // 抽不到地點但整理得出重點時，出路是筆記而不是叫人自己打一個地名
  const reasonText =
    reason === "no_place" && digest
      ? "這則裡看不出具體地點，不過重點整理好了，可以存進旅遊筆記。"
      : reason
        ? REASON_TEXT[reason] ?? "解析失敗，先手動輸入名稱。"
        : null;

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
          <div className="text-[11px] text-zinc-600">讀貼文、找地點加上補地址大約 30 秒</div>
        </div>
      )}

      {(phase === "ready" || phase === "saving") && (
        <>
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">存到哪裡</div>
            <Segmented
              block
              disabled={phase === "saving"}
              value={target}
              onChange={(v) => setTarget(v as Target)}
              options={TARGETS}
            />
          </div>

          {reasonText && (
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-200/80">
              {reasonText}
            </p>
          )}

          {target === "note" && (
            digest ? (
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="text-[14px] font-semibold text-zinc-100">{digest.heading}</div>
                <ul className="mt-2 space-y-1">
                  {digest.lines.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-zinc-400">
                      <span className="text-zinc-600">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-zinc-600">會接在這趟旅程的筆記最後面。</p>
              </div>
            ) : (
              <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
                這則貼文沒有整理得出來的重點，換一個目的地吧。
              </p>
            )
          )}

          {target !== "note" && places.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                找到 {places.length} 個{target === "souvenir" ? "項目" : "地點"}
              </div>
              {places.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3"
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
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-zinc-100">{p.name}</span>
                      {p.kind === "souvenir" && (
                        <span className="shrink-0 rounded-md border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                          伴手禮
                        </span>
                      )}
                    </div>
                    {(p.city || p.country) && (
                      <div className="mt-0.5 text-[12px] text-zinc-500">
                        {[p.city, p.country].filter(Boolean).join("、")}
                      </div>
                    )}
                    {p.note && <div className="mt-1 text-[12px] leading-relaxed text-zinc-400">{p.note}</div>}

                    {/* 地址當場可以改：AI 猜錯時在這裡改掉，比存進去之後再翻到行程頁改快得多 */}
                    <div className="mt-2">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[11px] text-zinc-600">
                          {target === "souvenir" ? "哪裡買" : "地址"}
                        </span>
                        {p.addressSource && (
                          <span className={`text-[11px] ${ADDRESS_SOURCE[p.addressSource].className}`}>
                            {ADDRESS_SOURCE[p.addressSource].text}
                          </span>
                        )}
                      </div>
                      <Input
                        size="small"
                        disabled={phase === "saving"}
                        value={p.address ?? ""}
                        onChange={(e) => editAddress(i, e.target.value)}
                        placeholder="沒抓到，可以自己填或貼 Google Maps 連結"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {target !== "note" && places.length === 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                {target === "souvenir" ? "伴手禮名稱" : "地點名稱"}
              </div>
              <Input
                disabled={phase === "saving"}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={target === "souvenir" ? "例如：白色戀人餅乾" : "例如：Piazza del Duomo 主教堂廣場"}
              />
            </div>
          )}

          {target !== "note" && imageUrl && (
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
            disabled={target === "note" && !digest}
            onClick={save}
          >
            {SAVE_LABEL[target]}
          </Button>

          <Link href="/" className="mt-4 block text-center text-[13px] text-zinc-500">
            取消
          </Link>
        </>
      )}
    </div>
  );
}
