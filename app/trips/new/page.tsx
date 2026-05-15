"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Form, Input, DatePicker, Select, Row, Col } from "antd";
import { motion, AnimatePresence, useAnimation, useMotionValue, useMotionTemplate, useSpring, useTransform } from "framer-motion";
import {
  PlaneIcon, PhotoIcon, CalendarIcon, CreditCardIcon, NotepadIcon, GiftIcon,
} from "@/app/components/Icons";
import dayjs from "dayjs";
import QuillEditor from "@/app/components/QuillEditor";
import LoginGlobe from "@/app/components/LoginGlobe";

const ALL_TABS = [
  { key: "transport",  label: "路線",  icon: <PlaneIcon size={18} /> },
  { key: "itinerary",  label: "行程",  icon: <CalendarIcon size={18} /> },
  { key: "expenses",   label: "費用",  icon: <CreditCardIcon size={18} /> },
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

const AVATAR_COLORS = ["#7c3aed","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6","#14b8a6"];
const KAOMOJI = ["❍ᴥ❍ʋ", "⩌ᴗ⩌", " ¯•ω•¯ ","๑´ㅂ`๑","ˊಠಿ_ಠ","•ᴥ•"," ✿＞◡❛","＾◡＾","✿◠‿◠","*^▽^*"];

// ── Twinkling star particle ───────────────────────────────────────────────────
function Star({ delay = 0, size = 2, x = 50, y = 50 }: { delay?: number; size?: number; x?: number; y?: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white pointer-events-none"
      style={{ width: size, height: size, left: `${x}%`, top: `${y}%` }}
      animate={{ opacity: [0.15, 0.9, 0.15], scale: [0.7, 1.3, 0.7] }}
      transition={{ duration: 2.2 + (delay % 1.5), repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

// ── Scene 1 – Suitcase ────────────────────────────────────────────────────────
function SuitcaseScene({ tripName }: { tripName: string }) {
  const ctrl = useAnimation();
  const prev = useRef("");

  useEffect(() => { ctrl.start({ y: 0, opacity: 1 }); }, [ctrl]);

  useEffect(() => {
    if (tripName && tripName !== prev.current) {
      prev.current = tripName;
      ctrl.start({ rotate: [-5, 5, -4, 4, 0], scale: [1, 1.07, 1], transition: { duration: 0.45 } });
    }
  }, [tripName, ctrl]);

  const stickers = [
    { e: "✈️", x: -68, y: -28 },
    { e: "🌏", x:  72, y: -38 },
    { e: "📸", x: -78, y:  32 },
    { e: "🗺️",  x:  74, y:  24 },
    { e: "🏖️", x:   2, y: -60 },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center"
      style={{ transformStyle: "preserve-3d" }}>

      {/* Stars – far back */}
      <div className="absolute inset-0" style={{ transform: "translateZ(-60px)" }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <Star key={i} delay={i * 0.14} size={1.5 + (i % 3)} x={4 + i * 4.3} y={8 + (i * 39) % 85} />
        ))}
      </div>

      {/* Glow blob – mid-back */}
      <div className="absolute w-56 h-56 rounded-full bg-violet-500/10 blur-3xl pointer-events-none"
        style={{ transform: "translateZ(-20px)" }} />

      {/* Suitcase + badge – front */}
      <motion.div initial={{ y: 220, opacity: 0 }} animate={ctrl}
        style={{ originY: 1, translateZ: 60, transformStyle: "preserve-3d" }}
        className="relative">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="flex flex-col items-center">
          <svg width="130" height="130" viewBox="0 0 130 130" fill="none">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="130" y2="130" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
              </linearGradient>
            </defs>
            <rect x="8" y="34" width="114" height="82" rx="13" fill="#7c3aed" />
            <rect x="8" y="34" width="114" height="82" rx="13" fill="url(#sg)" />
            <rect x="8" y="70" width="114" height="9" fill="#6d28d9" />
            <rect x="44" y="23" width="42" height="13" rx="6.5" fill="#8b5cf6" />
            <path d="M49 23 Q65 6 81 23" stroke="#c4b5fd" strokeWidth="5" fill="none" strokeLinecap="round" />
            <rect x="50" y="67" width="30" height="15" rx="5" fill="#4c1d95" />
            <rect x="59" y="62" width="12" height="8" rx="3" fill="none" stroke="#6d28d9" strokeWidth="3" />
            <circle cx="65" cy="74" r="2.5" fill="#7c3aed" />
            <circle cx="27" cy="120" r="7" fill="#4c1d95" />
            <circle cx="103" cy="120" r="7" fill="#4c1d95" />
            <rect x="20" y="115" width="90" height="5" rx="2.5" fill="#3b0764" />
          </svg>

          <AnimatePresence>
            {tripName && (
              <motion.div
                key="badge"
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3"
              >
                <div className="px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-200 text-sm font-semibold backdrop-blur-sm whitespace-nowrap">
                  {tripName} ✨
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Stickers – most front */}
        {stickers.map((s, i) => (
          <motion.div
            key={s.e}
            className="absolute text-[22px] select-none pointer-events-none"
            style={{ left: "50%", top: "42%", x: s.x, y: s.y, translateZ: 50 }}
            initial={{ scale: 0, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.25 + i * 0.13 }}
          >
            {s.e}
          </motion.div>
        ))}
      </motion.div>

    </div>
  );
}

// ── Scene 2 – Destination map ─────────────────────────────────────────────────
const PINS = [
  { x: 18, y: 38 }, { x: 62, y: 22 }, { x: 44, y: 62 },
  { x: 76, y: 52 }, { x: 12, y: 64 },
];

// Footprint SVG – toes pointing up; flip for right foot
function FootprintSVG({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor"
         style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      <ellipse cx="4.5" cy="9"   rx="3"   ry="4"   />
      <circle  cx="1.3" cy="4.2" r="1.1" />
      <circle  cx="2.9" cy="2.9" r="1.2" />
      <circle  cx="4.8" cy="2.5" r="1.2" />
      <circle  cx="6.4" cy="2.9" r="1.1" />
      <circle  cx="7.7" cy="4.2" r="0.95" />
    </svg>
  );
}

// Irregular bezier control points for each path segment
const PATH_CONTROLS = [
  { cx: 36, cy: 5  },   // 0→1 弧往上
  { cx: 72, cy: 46 },   // 1→2 弧往右
  { cx: 65, cy: 76 },   // 2→3 弧往下
  { cx: 40, cy: 38 },   // 3→4 弧往內
];

function bezierPt(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const mt = 1 - t;
  return { x: mt*mt*x0 + 2*mt*t*cx + t*t*x1, y: mt*mt*y0 + 2*mt*t*cy + t*t*y1 };
}

function FootprintTrail({ count }: { count: number }) {
  const { footprints, svgPaths } = useMemo(() => {
    const fps: { x: number; y: number; rotate: number; flip: boolean; delay: number }[] = [];
    const paths: string[] = [];

    for (let seg = 0; seg < count - 1 && seg < PINS.length - 1; seg++) {
      const p0 = PINS[seg];
      const p1 = PINS[seg + 1];
      const { cx, cy } = PATH_CONTROLS[seg % PATH_CONTROLS.length];

      paths.push(`M ${p0.x} ${p0.y} Q ${cx} ${cy} ${p1.x} ${p1.y}`);

      const STEPS = 8;
      for (let j = 0; j < STEPS; j++) {
        const t = (j + 0.5) / STEPS;
        const pt = bezierPt(t, p0.x, p0.y, cx, cy, p1.x, p1.y);

        const dx = 2*(1-t)*(cx-p0.x) + 2*t*(p1.x-cx);
        const dy = 2*(1-t)*(cy-p0.y) + 2*t*(p1.y-cy);
        const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        const perpRad = Math.atan2(dy, dx) + Math.PI / 2;
        const side = (j % 2 === 0 ? 1 : -1) * 1.8;

        fps.push({
          x: pt.x + Math.cos(perpRad) * side,
          y: pt.y + Math.sin(perpRad) * side,
          rotate: baseAngle + 90,
          flip: j % 2 === 1,
          delay: seg * 1.4 + j * 0.14,
        });
      }
    }
    return { footprints: fps, svgPaths: paths };
  }, [count]);

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {svgPaths.map((d, i) => (
          <motion.path key={i} d={d} stroke="#818cf8" strokeWidth="0.7" strokeDasharray="1.8 2.2"
            fill="none" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            transition={{ duration: 1.3, delay: i * 1.4, ease: "easeInOut" }}
          />
        ))}
      </svg>

      {footprints.map((fp, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
          style={{ left: `${fp.x}%`, top: `${fp.y}%`, translateX: "-50%", translateY: "-50%", rotate: fp.rotate, color: "#818cf8" }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ type: "spring", stiffness: 520, damping: 13, delay: fp.delay }}
        >
          <FootprintSVG flip={fp.flip} />
        </motion.div>
      ))}
    </>
  );
}

function MapScene({ destinations }: { destinations: string[] }) {
  const count = Math.min(destinations.length, PINS.length);
  return (
    <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>

      {/* Grid – far back */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]"
        viewBox="0 0 400 220" preserveAspectRatio="none"
        style={{ transform: "translateZ(-60px)" }}>
        {[0,1,2,3,4,5,6,7,8].map(i => <line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2="220" stroke="#818cf8" strokeWidth="0.5" />)}
        {[0,1,2,3,4].map(i => <line key={`h${i}`} x1="0" y1={i*55} x2="400" y2={i*55} stroke="#818cf8" strokeWidth="0.5" />)}
        <line x1="0" y1="110" x2="400" y2="110" stroke="#818cf8" strokeWidth="1.2" strokeDasharray="5 4" />
      </svg>

      {/* Footprint trail – mid-back */}
      <div className="absolute inset-0" style={{ transform: "translateZ(-20px)" }}>
        {count >= 2 && <FootprintTrail key={count} count={count} />}
      </div>

      {/* Empty state – mid-front */}
      <AnimatePresence>
        {destinations.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ translateZ: 40 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              className="text-6xl select-none"
            >
              🌏
            </motion.div>
            <motion.p
              animate={{ opacity: [0.35, 0.9, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="text-zinc-500 text-xs"
            >
              搜尋你的目的地...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination pins – front */}
      <AnimatePresence>
        {destinations.map((dest, i) => (
          <motion.div
            key={dest}
            className="absolute"
            style={{ left: `${PINS[i % PINS.length].x}%`, top: `${PINS[i % PINS.length].y}%`, translateZ: 60 }}
            initial={{ y: -90, opacity: 0, scale: 0.4 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: i * 0.08 }}
          >
            <div className="flex flex-col items-center">
              <div className="px-2.5 py-1 rounded-full bg-indigo-500/85 border border-indigo-300/40 text-white text-[11px] font-bold backdrop-blur-sm shadow-[0_0_14px_rgba(99,102,241,0.55)] whitespace-nowrap max-w-[120px] truncate">
                📍 {dest}
              </div>
              <motion.div className="w-px h-3 bg-indigo-400/70" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.12 }} style={{ originY: 0 }} />
              <motion.div
                className="w-2 h-2 rounded-full bg-indigo-400"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.6, 1] }}
                transition={{ delay: 0.18, duration: 0.35 }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Scene 3 – Team + Folder tabs ─────────────────────────────────────────────
const TAB_SCENE_EMOJI: Record<string, string> = {
  transport:  "✈️",
  itinerary:  "📅",
  expenses:   "💳",
  photos:     "📷",
  notes:      "📝",
  souvenirs:  "🎁",
};

const TAB_COLORS: Record<string, string> = {
  transport:  "#818cf8",
  itinerary:  "#34d399",
  expenses:   "#fbbf24",
  photos:     "#f472b6",
  notes:      "#38bdf8",
  souvenirs:  "#fb923c",
};

// Offset from folder center (px) – contained within the flex-1 section (folder at 60%)
const TAB_FLY_POSITIONS = [
  { x: -90, y: -38 },
  { x: -30, y: -52 },
  { x:  30, y: -52 },
  { x:  90, y: -38 },
  { x: -68, y:  -8 },
  { x:  68, y:  -8 },
];

const CARD_TILTS = [-5, 3, -3, 5, -4, 4];

function FolderSVG({ hiddenCount }: { hiddenCount: number }) {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" fill="none">
      <rect x="1" y="13" width="70" height="42" rx="6" fill="#312e81" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
      <path d="M1 13 C1 7.5 5 5.5 10 5.5 L26 5.5 C31 5.5 33 9.5 34 13 Z" fill="#4338ca" />
      <rect x="1" y="13" width="70" height="5.5" fill="rgba(255,255,255,0.07)" />
      {hiddenCount > 0 && (
        <g>
          <circle cx="59" cy="44" r="9.5" fill="#6366f1" opacity="0.9" />
          <text x="59" y="48.5" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">{hiddenCount}</text>
        </g>
      )}
    </svg>
  );
}

function TeamScene({ people, currencies, enabledTabs, avatarMap = {} }: {
  people: string[];
  currencies: string[];
  enabledTabs: string[];
  avatarMap?: Record<string, string>;
}) {
  const hiddenCount = ALL_TABS.length - enabledTabs.length;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center"
      style={{ transformStyle: "preserve-3d" }}>

      {/* Ambient gradient – far back */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ transform: "translateZ(-60px)" }}
        animate={{
          background: enabledTabs.length >= 4
            ? "radial-gradient(ellipse at 50% 65%, rgba(99,102,241,0.14) 0%, transparent 65%)"
            : "radial-gradient(ellipse at 50% 65%, rgba(99,102,241,0.07) 0%, transparent 65%)",
        }}
        transition={{ duration: 0.9 }}
      />

      {/* ── People row – front ── */}
      <div className="shrink-0 pt-3 flex flex-col items-center gap-1.5"
        style={{ transform: "translateZ(60px)" }}>
        <div className="flex items-end justify-center gap-2.5">
          <AnimatePresence mode="popLayout">
            {people.length === 0 ? (
              <motion.div
                key="solo"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex flex-col items-center gap-0.5"
              >
                <motion.div
                  className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden shadow-lg"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="text-white/30 text-md mb-2 leading-none select-none">{KAOMOJI[0].trim()}</span>
                </motion.div>
                <span className="text-zinc-500 text-[9px]">Solo traveler</span>
              </motion.div>
            ) : (
              people.map((name, i) => (
                <motion.div
                  key={name}
                  initial={{ y: 50, opacity: 0, scale: 0.4 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 40, opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <motion.div
                    className="w-10 h-10 rounded-full overflow-hidden shadow-md"
                    style={!avatarMap[name] ? { background: `linear-gradient(135deg,${AVATAR_COLORS[i % 8]},${AVATAR_COLORS[(i+3) % 8]})` } : undefined}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.2 + i * 0.28, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
                  >
                    {avatarMap[name] ? (
                      <img src={avatarMap[name]} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-between pt-0.5 pb-1.5">
                        <span className="text-white/30 text-[8px] leading-none select-none">{KAOMOJI[i % 8].trim()}</span>
                        <span className="text-white font-bold text-lg leading-none">{name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </motion.div>
                  <span className="text-zinc-500 text-[8px] w-10 text-center truncate">{name}</span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Currencies */}
        <div className="flex flex-wrap justify-center gap-1.5 max-w-[290px] px-3">
          <AnimatePresence>
            {currencies.map((cur, i) => (
              <motion.span
                key={cur}
                initial={{ y: 12, opacity: 0, scale: 0 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -10, opacity: 0, scale: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15, delay: i * 0.06 }}
                className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "rgba(251,191,36,.13)", border: "1px solid rgba(251,191,36,.3)", color: "#fbbf24" }}
              >
                {cur}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Folder + tab cards – mid-back ── */}
      <div className="relative h-36 w-full" style={{ transform: "translateZ(-20px)" }}>
        {/* Folder – centered horizontally, anchored near top of this section */}
        <div
          className="absolute pointer-events-none"
          style={{ left: "50%", top: "60%", transform: "translate(-50%, -50%)" }}
        >
          <FolderSVG hiddenCount={hiddenCount} />
        </div>

        {/* Tab cards fly from folder center */}
        {ALL_TABS.map((tab, i) => {
          const isEnabled = enabledTabs.includes(tab.key);
          const pos = TAB_FLY_POSITIONS[i];
          const color = TAB_COLORS[tab.key];
          return (
            <motion.div
              key={tab.key}
              className="absolute flex items-center gap-0.5 rounded-md text-[10px] font-semibold px-1.5 py-[3px] whitespace-nowrap pointer-events-none select-none"
              style={{
                left: "50%",
                top: "60%",
                background: `${color}18`,
                border: `1px solid ${color}44`,
                color,
              }}
              animate={isEnabled ? {
                x: pos.x - 26,
                y: pos.y - 11,
                scale: 1,
                opacity: 1,
                rotate: CARD_TILTS[i],
              } : {
                x: -26,
                y: -11,
                scale: 0.15,
                opacity: 0,
                rotate: 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: isEnabled ? i * 0.06 : 0,
              }}
            >
              <span>{TAB_SCENE_EMOJI[tab.key]}</span>
              {tab.label}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Success overlay ───────────────────────────────────────────────────────────
function SuccessOverlay({ tripName, onDone }: { tripName: string; onDone: () => void }) {
  useEffect(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 } });
      setTimeout(() => confetti({ particleCount: 90, spread: 130, origin: { y: 0.45 }, angle: 58 }), 320);
      setTimeout(() => confetti({ particleCount: 90, spread: 130, origin: { y: 0.45 }, angle: 122 }), 520);
    });
    const t = setTimeout(onDone, 2900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ background: "linear-gradient(145deg,#1e1b4b 0%,#09090b 55%,#0c1a2e 100%)" }}
    >
      {Array.from({ length: 30 }).map((_, i) => (
        <Star key={i} delay={i * 0.05} size={1 + (i % 3)} x={3 + i * 3.1} y={5 + (i * 43) % 92} />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-5 text-center px-8">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.65 }}
        >
          <LoginGlobe size={160} />
        </motion.div>

        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.95 }}
          className="text-6xl font-extrabold text-white tracking-tight"
          style={{ fontFamily: "var(--font-comfortaa)" }}
        >
          出發！
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
          className="text-zinc-400 text-lg"
        >
          {tripName || '你'} 的旅程已建立 ✨
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

  // 3D mouse parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-18, 18]), { stiffness: 140, damping: 18 });
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [18, -18]), { stiffness: 140, damping: 18 });
  const glowX  = useTransform(mouseX, [-0.5, 0.5], [20, 80]);
  const glowY  = useTransform(mouseY, [-0.5, 0.5], [20, 80]);
  const glowBg = useMotionTemplate`radial-gradient(circle at ${glowX}% ${glowY}%, rgba(139,92,246,0.22) 0%, rgba(99,102,241,0.08) 35%, transparent 65%)`;
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [success, setSuccess] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(true);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [destQuery, setDestQuery] = useState("");
  const [destOptions, setDestOptions] = useState<DestOption[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const destCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const destCodesRef = useRef<Record<string, string>>({});

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
      if (data.avatar_url) setAvatarMap({ [data.name]: data.avatar_url });
    });
  }, [form]);

  // Live scene values
  const tripName: string = Form.useWatch("name", form) ?? "";
  const selectedDests: string[] = Form.useWatch("destinations", form) ?? [];
  const selectedPeople: string[] = Form.useWatch("people", form) ?? [];
  const selectedCurrencies: string[] = Form.useWatch("currency", form) ?? [];
  const selectedEnabledTabs: string[] = Form.useWatch("enabledTabs", form) ?? ALL_TABS.map(t => t.key);

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
          results.forEach(r => { destCoordsRef.current[r.value] = { lat: r.lat, lng: r.lng }; });
          results.forEach(r => { if (r.countryCode) destCodesRef.current[r.value] = r.countryCode; });
        }
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
    if (now - lastScrollTime.current < 800) return;
    if (Math.abs(e.deltaY) < 20) return;

    const formEl = formScrollRef.current;
    if (formEl && formEl.contains(e.target as Node)) {
      if (e.deltaY > 0) {
        const atBottom = formEl.scrollTop + formEl.clientHeight >= formEl.scrollHeight - 4;
        if (!atBottom) return;
      } else {
        if (formEl.scrollTop > 0) return;
      }
    }

    if (e.deltaY > 0 && step < STEPS.length - 1) {
      lastScrollTime.current = now;
      handleNext();
    } else if (e.deltaY < 0 && step > 0) {
      lastScrollTime.current = now;
      handleBack();
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const values = form.getFieldsValue(true);
      const destNames: string[] = values.destinations ?? [];
      const destinations = destNames.filter(n => destCoordsRef.current[n]).map(n => ({ name: n, ...destCoordsRef.current[n] }));
      const countries = destNames.join("、");
      const country_codes = [...new Set(destNames.map(n => destCodesRef.current[n]).filter(Boolean))].join(",");

      const res = await fetchWithAuth("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          startDate: values.dateRange
            ? (values.dateRange as [typeof dayjs.prototype, typeof dayjs.prototype])[0]?.format("YYYY-MM-DD") ?? ""
            : values.startDate ? (values.startDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
          endDate: values.dateRange
            ? (values.dateRange as [typeof dayjs.prototype, typeof dayjs.prototype])[1]?.format("YYYY-MM-DD") ?? ""
            : values.endDate ? (values.endDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
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
    <MapScene key="s2" destinations={selectedDests} />,
    <TeamScene key="s3" people={selectedPeople} currencies={selectedCurrencies} enabledTabs={selectedEnabledTabs} avatarMap={avatarMap} />,
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
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
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
          style={{ height: isMobile ? 210 : undefined, perspective: "1200px" }}
          onMouseMove={!isMobile ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
            mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
          } : undefined}
          onMouseLeave={!isMobile ? () => { mouseX.set(0); mouseY.set(0); } : undefined}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, y: d * 60, scale: 0.96 }),
                center: { opacity: 1, y: 0, scale: 1 },
                exit: (d: number) => ({ opacity: 0, y: d * -60, scale: 0.96 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
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
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.28 }}
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
                            ? <span className="text-zinc-500 text-xs">請輸入至少 2 個字搜尋</span>
                            : <span className="text-zinc-500 text-xs">找不到相符地點</span>
                        }
                        placeholder="搜尋地區..."
                      />
                    </Form.Item>
                  )}

                  {step === 2 && (
                    <>
                      <Form.Item name="people" label="分帳成員" extra="輸入名字後按 Enter 加入" className="!mb-3">
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
                      <Form.Item name="notes" label="備註" className="!mb-3">
                        <QuillEditor placeholder="這趟旅程的心得或備忘..." />
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
                {saving ? "建立中..." : "出發！✈️"}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <SuccessOverlay
            tripName={tripName}
            onDone={() => { if (savedId) router.push(`/trips/${savedId}`); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
