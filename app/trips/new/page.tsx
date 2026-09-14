"use client";
import { useState, useEffect, useRef, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Form, Input, DatePicker, Select, Row, Col } from "antd";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useAnimationFrame, useMotionValue, useMotionTemplate, useSpring, useTransform } from "framer-motion";

/** three 只在新增旅程這一頁載入 */
import type { GlobePin } from "@/app/components/WizardStage";

const WizardStage = dynamic(() => import("@/app/components/WizardStage"), { ssr: false });
import {
  PlaneIcon, PhotoIcon, CalendarIcon, CoinIcon, NotepadIcon, GiftIcon,
} from "@/app/components/Icons";
import dayjs, { type Dayjs } from "dayjs";
import QuillEditor from "@/app/components/QuillEditor";

const ALL_TABS = [
  { key: "transport",  label: "路線",  icon: <PlaneIcon size={18} /> },
  { key: "itinerary",  label: "行程",  icon: <CalendarIcon size={18} /> },
  { key: "expenses",   label: "費用",  icon: <CoinIcon size={18} /> },
  { key: "photos",     label: "照片",  icon: <PhotoIcon size={18} /> },
  { key: "notes",      label: "筆記",  icon: <NotepadIcon size={18} /> },
  { key: "souvenirs",  label: "伴手禮", icon: <GiftIcon size={18} /> },
];

interface CurrencyOption { value: string; label: string; }
interface DestOption { value: string; label: string; lat: number; lng: number; countryCode?: string; }

const STEPS = [
  { title: "旅程起點",  subtitle: "給這趟旅行一個名字" },
  { title: "選定目的地", subtitle: "你想去哪裡？" },
  { title: "旅行準備",  subtitle: "成員、貨幣與細節" },
];

// ── Twinkling star particle ───────────────────────────────────────────────────
// ── Scene 1 – Suitcase ────────────────────────────────────────────────────────
const STICKER = {
  plane: "M2 16l20-9-9 20-2-7-9-4z",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 2.5 15.4 0 18",
  camera: "M3 8h3l2-2h8l2 2h3v11H3zM12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  map: "M9 4L3 7v13l6-3 6 3 6-3V4l-6 3-6-3zM9 4v13M15 7v13",
  wave: "M3 15c2 0 2-2 4.5-2S10 15 12 15s2-2 4.5-2 2.5 2 4.5 2M3 19c2 0 2-2 4.5-2S10 19 12 19s2-2 4.5-2 2.5 2 4.5 2",
};

/**
 * 浮在箱子周圍的 icon。
 *
 * 箱子是「物件」，這些是「介面」—— 所以用的是全站的玻璃語彙（主 guideline §3 的
 * glass-premium：135deg 白 8%→3% 漸層、blur(12px) saturate(180%)、白 10% 邊、
 * 0 8px 32px 的投影加 inset 白 5%），值直接照抄，不另外發明一套。
 */
function Sticker({ path, tint = "#c4b5fd", size = 30 }: { path: string; tint?: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
        backdropFilter: "blur(12px) saturate(180%)",
        WebkitBackdropFilter: "blur(12px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 32px 0 rgba(0,0,0,0.37), inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none"
        stroke={tint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  );
}

/** 場景面板的實際尺寸：膠囊、貼紙都要跟著它算位置，不能釘在面板下緣 */
function usePanelSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function SuitcaseScene({ tripName }: { tripName: string }) {
  // 面板在手機是 210px 高、桌機是半個螢幕；貼紙用固定 px 會在桌機縮成小點，
  // 所以位置改成面板的百分比、大小跟著面板縮放
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panel = usePanelSize(panelRef);
  const unit = Math.min(panel.w, panel.h) || 210;
  // 箱子的高度與 SuitcaseModel 的 fitCamera 用同一條式子；膠囊貼在箱子下緣而不是面板下緣
  const caseH = Math.min(Math.max((panel.h || 210) * 0.38, 104), 300);
  // 手機面板只有 210px：算出來的位置可能讓膠囊尾巴超出面板被切掉，所以再夾一次
  const badgeTop = Math.min((panel.h || 210) / 2 + caseH / 2 + 16, (panel.h || 210) - 40);
  // 注意：貼在 translateZ(90) 上，透視還會再放大約 13%，所以上限要比看到的數字小一階
  const stickerSize = Math.min(Math.max(unit * 0.11, 24), 46);

  // 位置是相對面板中心的百分比，箱子放大時貼紙跟著往外站
  const stickers = [
    { path: STICKER.wave, tint: "#c4b5fd", left: "29%", top: "17%", scale: 0.9 },
    { path: STICKER.globe, tint: "#c4b5fd", left: "74%", top: "24%", scale: 1.15 },
    { path: STICKER.plane, tint: "#a5b4fc", left: "15%", top: "47%", scale: 1 },
    { path: STICKER.map, tint: "#a5b4fc", left: "27%", top: "77%", scale: 0.95 },
    { path: STICKER.camera, tint: "#c4b5fd", left: "79%", top: "73%", scale: 0.88 },
  ];

  return (
    <div ref={panelRef} className="relative w-full h-full flex items-center justify-center"
      style={{ transformStyle: "preserve-3d" }}>

      {/* 星點 */}

      {/* 背光 */}
      <div className="absolute w-64 h-64 rounded-full bg-violet-500/12 blur-3xl pointer-events-none"
        style={{ transform: "translateZ(-70px)" }} />

      {/* 浮在前面的貼紙 */}
      {stickers.map((s, i) => (
        <motion.div
          key={s.path}
          className="absolute select-none pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: s.left, top: s.top, translateZ: 90 }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.35 + i * 0.13 }}
        >
          <Sticker path={s.path} tint={s.tint} size={Math.round(stickerSize * s.scale)} />
        </motion.div>
      ))}

      <AnimatePresence>
        {tripName && (
          <motion.div
            key="badge"
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-1/2 -translate-x-1/2 max-w-[86%] z-20"
            style={{ top: badgeTop, translateZ: 30 }}
          >
            {/* preserve-3d 裡的前後看的是 z 位置不是 z-index：要蓋過箱子就得真的往前站。
                30px 在 perspective 760 下只放大 4%，不會像先前 80px 那樣被面板切掉 */}
            <div className="px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-200 text-sm font-semibold backdrop-blur-sm truncate">
              {tripName}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Scene 2 – Destination globe ───────────────────────────────────────────────
function MapScene({ pins }: { pins: GlobePin[] }) {
  const latest = pins[pins.length - 1];
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panel = usePanelSize(panelRef);
  // 與 GlobeModel 的 fitCamera 同一條式子，文字才會貼在地球下緣
  const globeH = Math.min(Math.max((panel.h || 210) * 0.46, 118), 330);
  const captionTop = Math.min((panel.h || 210) / 2 + globeH / 2 + 16, (panel.h || 210) - 38);

  return (
    <div ref={panelRef} className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>

      {/* 還沒選：一行提示就好，不要再放一顆會轉的 emoji 地球跟真地球打架 */}
      <AnimatePresence>
        {pins.length === 0 && (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.9, 0.4] }} exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 2.4, repeat: Infinity } }}
            className="absolute left-1/2 -translate-x-1/2 text-zinc-500 text-xs"
            style={{ top: captionTop, translateZ: 30 }}
          >
            搜尋你的目的地...
          </motion.p>
        )}
      </AnimatePresence>

      {/* 選了就把最新的那個名字掛出來，與第一幕的名稱膠囊同一個樣式 */}
      <AnimatePresence mode="wait">
        {latest && (
          <motion.div
            key={latest.name}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-1/2 -translate-x-1/2 max-w-[86%] z-20"
            style={{ top: captionTop, translateZ: 30 }}
          >
            <div className="px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-200 text-sm font-semibold backdrop-blur-sm truncate">
              {latest.name}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Scene 3 – Team + Folder tabs ─────────────────────────────────────────────
function TagScene({ people, currencies }: { people: string[]; currencies: string[] }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panel = usePanelSize(panelRef);
  const tagsH = Math.min(Math.max((panel.h || 210) * 0.52, 140), 380);
  const captionTop = Math.min((panel.h || 210) / 2 + tagsH / 2 + 12, (panel.h || 210) - 36);

  const caption = people.length
    ? `${people.length} 位旅伴${currencies.length ? ` · ${currencies.length} 種貨幣` : ""}`
    : "一個人的旅程";

  return (
    <div ref={panelRef} className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>

      {/* 牌面上已經寫著名字與幣別，這裡只補一句總結 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-1/2 -translate-x-1/2 max-w-[86%] z-20"
        style={{ top: captionTop, translateZ: 30 }}
      >
        <div className="px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-200 text-sm font-semibold backdrop-blur-sm truncate">
          {caption}
        </div>
      </motion.div>
    </div>
  );
}

// ── Success overlay ───────────────────────────────────────────────────────────
function SuccessOverlay({
  tripName,
  startDate,
  destination,
  onDone,
}: {
  tripName: string;
  /** 出發日期：倒數是這一頁的主角，它指向未來而不是回頭看 */
  startDate: Dayjs | null;
  destination: string | null;
  onDone: () => void;
}) {
  const daysLeft = startDate ? startDate.startOf("day").diff(dayjs().startOf("day"), "day") : null;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [onDone]);

  /* 數字從 0 數上去：期待是累積出來的，不是一次爆開 */
  useEffect(() => {
    if (daysLeft === null || daysLeft <= 0) return;
    let frame = 0;
    const startAt = performance.now() + 500;
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / dur));
      setShown(Math.round((1 - Math.pow(1 - p, 3)) * daysLeft));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [daysLeft]);

  const headline =
    daysLeft === null ? "準備出發" :
    daysLeft > 0 ? null :
    daysLeft === 0 ? "今天就出發" : "旅程進行中";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ background: "linear-gradient(180deg,#0b0a18 0%,#150f2e 58%,#2a1a3f 100%)" }}
    >
      {/* 地平線的第一道光：從下緣升起，不是爆開的彩帶 */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(196,181,253,0.28) 0%, rgba(139,92,246,0.12) 35%, transparent 70%)" }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-[33%] h-px pointer-events-none"
        initial={{ opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: 0.5, scaleX: 1 }}
        transition={{ duration: 1.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: "linear-gradient(90deg, transparent, rgba(196,181,253,0.7), transparent)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="text-violet-300/80 text-sm tracking-[0.2em]"
        >
          {destination ? destination.toUpperCase() : "NEXT TRIP"}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-zinc-100 text-2xl font-bold max-w-[80vw] truncate"
        >
          {tripName || "你的旅程"}
        </motion.div>

        {headline ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="text-5xl font-extrabold text-white tracking-tight mt-1"
            style={{ fontFamily: "var(--font-comfortaa)" }}
          >
            {headline}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mt-1 flex items-baseline gap-2"
          >
            <span className="text-zinc-400 text-sm">距離出發還有</span>
            <span
              className="text-6xl font-extrabold text-white tabular-nums leading-none"
              style={{ fontFamily: "var(--font-comfortaa)" }}
            >
              {shown}
            </span>
            <span className="text-zinc-400 text-sm">天</span>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="text-zinc-500 text-[13px] mt-2"
        >
          {daysLeft === null ? "補上出發日期就會開始倒數" : "正在打開行程，開始準備吧"}
        </motion.p>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewTripPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const isTransitioning = useRef(false);
  const lastScrollTime = useRef(0);
  const wheelAccum = useRef(0);

  // 3D mouse parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  // three 的迴圈每幀自己讀，用 ref 才不會每次滑鼠移動都重新 render
  const pointerRef = useRef({ x: 0, y: 0 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-18, 18]), { stiffness: 140, damping: 18 });
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [18, -18]), { stiffness: 140, damping: 18 });
  const glowX  = useTransform(mouseX, [-0.5, 0.5], [20, 80]);
  const glowY  = useTransform(mouseY, [-0.5, 0.5], [20, 80]);
  const glowBg = useMotionTemplate`radial-gradient(circle at ${glowX}% ${glowY}%, rgba(139,92,246,0.22) 0%, rgba(99,102,241,0.08) 35%, transparent 65%)`;
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [success, setSuccess] = useState(false);
  const [created, setCreated] = useState<{ start: string | null; destination: string | null }>({ start: null, destination: null });
  const [savedId, setSavedId] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(true);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [destQuery, setDestQuery] = useState("");
  const [destSearchError, setDestSearchError] = useState(false);
  const [destOptions, setDestOptions] = useState<DestOption[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const destCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const destCodesRef = useRef<Record<string, string>>({});

  // 手機沒有滑鼠，場景本來完全不動；給一段很慢的自轉，層次才活著（陀螺儀要權限，不值得）
  useAnimationFrame((t) => {
    if (!isMobile) return;
    const x = Math.sin(t / 2600) * 0.34;
    const y = Math.cos(t / 3400) * 0.2;
    mouseX.set(x);
    mouseY.set(y);
    pointerRef.current = { x, y };
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/me").then(r => r.ok ? r.json() : null).then(data => {
      if (!data?.name) return;
      form.setFieldValue("people", [data.name]);
    });
  }, [form]);

  // Live scene values
  const tripName: string = Form.useWatch("name", form) ?? "";
  const selectedDests: string[] = Form.useWatch("destinations", form) ?? [];
  // 只畫得出有座標的：座標是搜尋 Nominatim 時一起收下來的
  const globePins: GlobePin[] = selectedDests
    .filter((n) => destCoordsRef.current[n])
    .map((n) => ({ name: n, ...destCoordsRef.current[n] }));
  const selectedPeople: string[] = Form.useWatch("people", form) ?? [];
  const selectedCurrencies: string[] = Form.useWatch("currency", form) ?? [];

  useEffect(() => {
    const CURRENCY_API = "https://openexchangerates.org/api/currencies.json";
    const TRANSLATION_API = "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-numbers-full/main/zh-Hant/currencies.json";
    Promise.all([fetch(CURRENCY_API).then(r => r.json()), fetch(TRANSLATION_API).then(r => r.json())])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(([cd, td]: [Record<string, string>, any]) => {
        const zh = td?.main?.["zh-Hant"]?.numbers?.currencies ?? {};
        const opts = Object.entries(cd).map(([code, eng]) => ({
          value: code, label: `${code} - ${zh[code]?.displayName || eng}`,
        }));
        opts.sort((a, b) => a.value.localeCompare(b.value));
        setCurrencyOptions(opts);
      })
      .catch(() => setCurrencyOptions([
        { value: "TWD", label: "TWD - 新台幣" }, { value: "USD", label: "USD - 美元" },
        { value: "EUR", label: "EUR - 歐元" },   { value: "JPY", label: "JPY - 日圓" },
        { value: "KRW", label: "KRW - 韓元" },   { value: "HKD", label: "HKD - 港幣" },
        { value: "SGD", label: "SGD - 新加坡幣" },{ value: "THB", label: "THB - 泰銖" },
        { value: "GBP", label: "GBP - 英鎊" },   { value: "AUD", label: "AUD - 澳幣" },
        { value: "CNY", label: "CNY - 人民幣" },  { value: "MYR", label: "MYR - 馬來西亞林吉特" },
      ]));
  }, []);

  useEffect(() => {
    if (destQuery.length < 2) { setDestOptions([]); return; }
    const t = setTimeout(async () => {
      setDestSearching(true);
      try {
        const res = await fetch(`/api/search-destinations?q=${encodeURIComponent(destQuery)}`);
        if (res.ok) {
          const { results } = await res.json() as { results: DestOption[] };
          setDestOptions(results);
          setDestSearchError(false);
          results.forEach(r => { destCoordsRef.current[r.value] = { lat: r.lat, lng: r.lng }; });
          results.forEach(r => { if (r.countryCode) destCodesRef.current[r.value] = r.countryCode; });
        } else {
          setDestOptions([]);
          setDestSearchError(true);
        }
      } catch {
        setDestOptions([]);
        setDestSearchError(true);
      } finally { setDestSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [destQuery]);

  async function handleNext() {
    if (isTransitioning.current) return;
    const fieldsByStep = [["name"], ["destinations"], []];
    try {
      await form.validateFields(fieldsByStep[step]);
      isTransitioning.current = true;
      setDirection(1);
      setStep(s => s + 1);
      setTimeout(() => { isTransitioning.current = false; }, 500);
    } catch (_) { isTransitioning.current = false; }
  }

  function handleBack() {
    if (isTransitioning.current || step === 0) return;
    isTransitioning.current = true;
    setDirection(-1);
    setStep(s => s - 1);
    setTimeout(() => { isTransitioning.current = false; }, 500);
  }

  function handlePageWheel(e: React.WheelEvent) {
    if (isMobile) return;
    const now = Date.now();
    if (now - lastScrollTime.current < 700) return;

    const formEl = formScrollRef.current;
    if (formEl && formEl.contains(e.target as Node)) {
      if (e.deltaY > 0) {
        const atBottom = formEl.scrollTop + formEl.clientHeight >= formEl.scrollHeight - 4;
        if (!atBottom) { wheelAccum.current = 0; return; }
      } else if (formEl.scrollTop > 0) {
        wheelAccum.current = 0;
        return;
      }
    }

    // 蓄力翻頁：反向滾動清零，累積超過閾值才翻，觸控板輕掃不誤觸
    if (Math.sign(e.deltaY) !== Math.sign(wheelAccum.current)) wheelAccum.current = 0;
    wheelAccum.current += e.deltaY;

    if (wheelAccum.current > 120 && step < STEPS.length - 1) {
      lastScrollTime.current = now;
      wheelAccum.current = 0;
      handleNext();
    } else if (wheelAccum.current < -120 && step > 0) {
      lastScrollTime.current = now;
      wheelAccum.current = 0;
      handleBack();
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const values = form.getFieldsValue(true);
      const destNames: string[] = values.destinations ?? [];
      // 成功頁顯示的是實際送出的值，不再回頭讀表單（送出後表單狀態不保證還在）
      const startStr = values.dateRange
        ? (values.dateRange as [Dayjs, Dayjs])[0]?.format("YYYY-MM-DD") ?? ""
        : values.startDate ? (values.startDate as Dayjs).format("YYYY-MM-DD") : "";
      const endStr = values.dateRange
        ? (values.dateRange as [Dayjs, Dayjs])[1]?.format("YYYY-MM-DD") ?? ""
        : values.endDate ? (values.endDate as Dayjs).format("YYYY-MM-DD") : "";
      setCreated({ start: startStr || null, destination: destNames[0] ?? null });
      const destinations = destNames.filter(n => destCoordsRef.current[n]).map(n => ({ name: n, ...destCoordsRef.current[n] }));
      const countries = destNames.join("、");
      const country_codes = [...new Set(destNames.map(n => destCodesRef.current[n]).filter(Boolean))].join(",");

      const res = await fetchWithAuth("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          startDate: startStr,
          endDate: endStr,
          countries, destinations, country_codes,
          notes: (values.notes as string ?? "").replace(/<[^>]*>/g, "").trim() ? (values.notes as string) : "",
          photoAlbumId: values.photoAlbumId ?? "",
          people: values.people ?? [],
          currency: Array.isArray(values.currency) ? values.currency.join(",") : (values.currency || "TWD"),
          enabledTabs: values.enabledTabs ?? ALL_TABS.map(t => t.key),
        }),
      });
      if (res.ok) {
        const { id } = await res.json();
        setSavedId(id);
        setSuccess(true);
      }
    } finally { setSaving(false); }
  }

  const scenes = [
    <SuitcaseScene key="s1" tripName={tripName} />,
    <MapScene key="s2" pins={globePins} />,
    <TagScene key="s3" people={selectedPeople} currencies={selectedCurrencies} />,
  ];

  return (
    <div className="h-[100dvh] bg-[#09090b] flex flex-col overflow-hidden relative" onWheel={handlePageWheel}>
      {/* Ambient background that shifts per step */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ background: [
          "radial-gradient(ellipse at 30% 20%, rgba(139,92,246,.13) 0%, transparent 60%)",
          "radial-gradient(ellipse at 68% 28%, rgba(99,102,241,.11) 0%, transparent 58%)",
          "radial-gradient(ellipse at 50% 70%, rgba(16,185,129,.10) 0%, transparent 60%)",
        ][step] }}
        transition={{ duration: 0.9 }}
      />

      {/* Header – full width on both mobile and desktop */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-white/[0.05] relative z-10">
        <button
          onClick={() => step > 0 ? handleBack() : router.push("/")}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, y: d * 8 }),
                center: { opacity: 1, y: 0 },
                exit: (d: number) => ({ opacity: 0, y: d * -8 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
            >
              <div className="text-[#f4f4f5] font-bold text-sm leading-tight">{STEPS[step].title}</div>
              <div className="text-zinc-500 text-[11px]">{STEPS[step].subtitle}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              className="h-1.5 rounded-full"
              animate={{
                width: i === step ? 20 : 6,
                background: i <= step ? "#8b5cf6" : "rgba(255,255,255,0.15)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            />
          ))}
        </div>
      </div>

      {/* Content: stacked on mobile, side-by-side on desktop */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* Scene panel: fixed 210px tall on mobile, full-height left half on desktop */}
        <div
          className="shrink-0 md:flex-1 relative overflow-hidden md:border-r md:border-white/[0.05]"
          style={{ height: isMobile ? 210 : undefined, perspective: "760px" }}
          onMouseMove={!isMobile ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            mouseX.set(x);
            mouseY.set(y);
            pointerRef.current = { x, y };
          } : undefined}
          onMouseLeave={!isMobile ? () => { mouseX.set(0); mouseY.set(0); pointerRef.current = { x: 0, y: 0 }; } : undefined}
        >
          {/* 3D 舞台跨三幕都不卸載：箱蓋掀開→地球升起→地球縮成火漆印、吊牌垂下，
              這幾段轉場才連得起來 */}
          <div
            className="absolute inset-0"
          >
            <WizardStage step={step} tripName={tripName} pins={globePins} people={selectedPeople} currencies={selectedCurrencies} pointerRef={pointerRef} />
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, y: d * 140, scale: 0.94 }),
                center: { opacity: 1, y: 0, scale: 1 },
                exit: (d: number) => ({ opacity: 0, y: d * -140, scale: 0.94 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", inset: 0, rotateX, rotateY, transformStyle: "preserve-3d" }}
            >
              {scenes[step]}
            </motion.div>
          </AnimatePresence>

          {/* Mouse glow overlay – desktop only */}
          {!isMobile && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-10"
              style={{ background: glowBg }}
            />
          )}

          {/* Scroll hint – desktop only, hide after step 0 */}
          {!isMobile && step < STEPS.length - 1 && (
            <motion.div
              className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <motion.div
                className="flex flex-col items-center gap-1 text-zinc-600 text-[10px]"
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                滾動繼續
              </motion.div>
            </motion.div>
          )}

          {/* Separator fade – mobile only */}
          {isMobile && <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #09090b)" }} />}
        </div>

        {/* Form + button panel: scrollable form area + sticky bottom button */}
        <div className="flex-1 md:w-[440px] md:shrink-0 flex flex-col overflow-hidden">
          <div ref={formScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-5 pt-5 pb-4">
            <Form
              form={form}
              layout="vertical"
              className="cute-form"
              initialValues={{ currency: ["TWD"], enabledTabs: ALL_TABS.map(t => t.key) }}
            >
              <AnimatePresence mode="popLayout" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, y: d * 48 }),
                    center: { opacity: 1, y: 0 },
                    exit: (d: number) => ({ opacity: 0, y: d * -48 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ willChange: "opacity, transform" }}
                >
                  {step === 0 && (
                    <>
                      <Form.Item name="name" label="旅程名稱" rules={[{ required: true, message: "請輸入旅程名稱" }]}>
                        <Input placeholder="例如：日本春季旅行" autoFocus />
                      </Form.Item>
                      {isMobile ? (
                        <div className="overflow-hidden">
                          <Row gutter={[12, 0]}>
                            <Col span={12}>
                              <Form.Item name="startDate" label="出發日期">
                                <DatePicker className="w-full" placeholder="選擇日期" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="endDate" label="結束日期">
                                <DatePicker className="w-full" placeholder="選擇日期" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
                      ) : (
                        <Form.Item name="dateRange" label="出發 / 結束日期">
                          <DatePicker.RangePicker className="w-full" placeholder={["出發日期", "結束日期"]} />
                        </Form.Item>
                      )}
                    </>
                  )}

                  {step === 1 && (
                    <Form.Item name="destinations" label="目的地" extra="輸入地區名稱搜尋（如「沖繩」、「澎湖」），可選多個地點">
                      <Select
                        mode="multiple" showSearch filterOption={false}
                        onSearch={setDestQuery}
                        options={destOptions.map(o => ({ value: o.value, label: o.label }))}
                        loading={destSearching}
                        notFoundContent={
                          destQuery.length < 2
                            ? <span className="text-zinc-400 text-xs">請輸入至少 2 個字搜尋</span>
                            : destSearchError
                              ? <span className="text-amber-400/90 text-xs">搜尋服務忙碌中，請稍後再試</span>
                              : <span className="text-zinc-400 text-xs">找不到相符地點</span>
                        }
                        placeholder="搜尋地區..."
                      />
                    </Form.Item>
                  )}

                  {step === 2 && (
                    <>
                      <Form.Item name="people" label="旅伴" extra="輸入名字後按 Enter 加入" className="!mb-3">
                        <Select mode="tags" placeholder="輸入成員名字，按 Enter 確認" tokenSeparators={[","]} options={[]} />
                      </Form.Item>
                      <Form.Item name="currency" label="預設貨幣 (可多選)" extra="選擇旅程中會用到的貨幣" className="!mb-3">
                        <Select
                          mode="multiple" showSearch placeholder="選擇貨幣"
                          options={currencyOptions}
                          filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                        />
                      </Form.Item>
                      <Form.Item name="enabledTabs" label="顯示的分頁" extra="選擇要顯示哪些功能分頁（會依照順序顯示）" className="!mb-3">
                        <Select mode="multiple" placeholder="選擇要顯示的分頁">
                          {ALL_TABS.map(t => (
                            <Select.Option key={t.key} value={t.key}>
                              <div className="flex items-center gap-2">{t.icon} {t.label}</div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="notes" label="副標題" className="!mb-3">
                        <QuillEditor placeholder="一句話介紹這趟旅程，會顯示在標題下方..." />
                      </Form.Item>
                      <Form.Item name="photoAlbumId" label="Google Photos 相簿連結" extra="在 Google Photos 相簿內點「分享」→「建立連結」取得網址" className="!mb-0">
                        <Input placeholder="https://photos.app.goo.gl/..." />
                      </Form.Item>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </Form>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="shrink-0 px-5 pb-6 pt-3 border-t border-white/[0.05]">
            {step < STEPS.length - 1 ? (
              <motion.button
                onClick={handleNext}
                whileHover={{ scale: 1.02, boxShadow: "0 10px 32px rgba(139,92,246,0.55)" }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-12 rounded-full font-bold text-white text-base md:hidden"
                style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)", boxShadow: "0 6px 24px rgba(139,92,246,0.4)" }}
              >
                下一步 →
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSubmit}
                disabled={saving}
                whileHover={!saving ? { scale: 1.02, boxShadow: "0 10px 32px rgba(139,92,246,0.6)" } : {}}
                whileTap={!saving ? { scale: 0.97 } : {}}
                className="w-full h-12 rounded-full font-bold text-white text-base disabled:opacity-70"
                style={{ background: "linear-gradient(90deg,#8b5cf6,#d946ef,#f472b6)", boxShadow: "0 6px 24px rgba(217,70,239,0.4)" }}
              >
                {saving ? "建立中..." : (<span className="inline-flex items-center gap-2">出發！<PlaneIcon size={17} /></span>)}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <SuccessOverlay
            tripName={tripName}
            startDate={created.start ? dayjs(created.start) : null}
            destination={created.destination}
            onDone={() => { if (savedId) router.push(`/trips/${savedId}`); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
