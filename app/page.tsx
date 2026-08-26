"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Layout,
  Button,
  Typography,
  Spin,
  Drawer,
  Tag,
  Skeleton,
  Dropdown,
} from "antd";
import { getCountryFlags, getCountryCodes } from "@/lib/countries";
import { parseCoverPos } from "@/lib/coverPos";
import { UserOutlined, AimOutlined, LoadingOutlined } from "@ant-design/icons";
import {
  PlusIcon, GlobeIcon, CalendarIcon, LocationIcon,
  MenuListIcon, LogoutIcon, CloseIcon, GoogleIcon,
} from "@/app/components/Icons";

const TripGlobe = dynamic(() => import("./components/TripGlobe"), { ssr: false });
const LoginGlobe = dynamic(() => import("./components/LoginGlobe"), { ssr: false });
const GlobeLoader = dynamic(() => import("./components/GlobeLoader"), { ssr: false });

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  countries: string;
  notes: string;
  photo_album_id: string;
  created_at: string;
  destinations?: { name: string; lat: number; lng: number }[] | null;
  country_codes?: string | null;
  cover_url?: string | null;
}

interface Segment {
  id: string;
  trip_id: string;
  order: number;
  from_city: string;
  from_iata: string;
  to_city: string;
  to_iata: string;
  type: string;
}

function getDestinationAccent(countries: string): { from: string; to: string } {
  const c = (countries ?? "").toLowerCase();
  if (/日本|japan/.test(c)) return { from: '#f472b6', to: '#e11d48' };
  if (/韓國|korea/.test(c)) return { from: '#c084fc', to: '#7c3aed' };
  if (/泰國|thai/.test(c)) return { from: '#facc15', to: '#ca8a04' };
  if (/印尼|峇里|bali|indonesia/.test(c)) return { from: '#34d399', to: '#0d9488' };
  if (/越南|vietnam/.test(c)) return { from: '#4ade80', to: '#15803d' };
  if (/台灣|taiwan/.test(c)) return { from: '#f97316', to: '#dc2626' };
  if (/法國|france|paris/.test(c)) return { from: '#818cf8', to: '#4f46e5' };
  if (/義大利|italy/.test(c)) return { from: '#60a5fa', to: '#4338ca' };
  if (/西班牙|spain/.test(c)) return { from: '#fb923c', to: '#dc2626' };
  if (/英國|uk|england/.test(c)) return { from: '#60a5fa', to: '#1d4ed8' };
  if (/美國|usa|america/.test(c)) return { from: '#60a5fa', to: '#dc2626' };
  if (/澳洲|australia/.test(c)) return { from: '#fb923c', to: '#ca8a04' };
  return { from: '#6366f1', to: '#14b8a6' };
}

function useCountUp(target: number, active: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) { setCount(0); return; }
    if (target === 0) { setCount(0); return; }
    const startTime = performance.now();
    const duration = 800;
    function update(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(update);
      else setCount(target);
    }
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return count;
}

function TripCard({
  trip, selected, isNew, index, isMobile, onClick, onFocusGlobe, onRef,
}: {
  trip: Trip; selected: boolean; isNew: boolean; index: number; isMobile: boolean;
  onClick: () => void; onFocusGlobe: () => void;
  onRef?: (el: HTMLDivElement | null) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const accent = getDestinationAccent(trip.countries ?? "");
  const flags = getCountryFlags(trip.countries ?? "", trip.country_codes ?? "");

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * -7, y: (x - 0.5) * 7 });
    setGlowPos({ x: x * 100, y: y * 100 });
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 });
    setGlowPos({ x: 50, y: 50 });
  }

  const isHovering = tilt.x !== 0 || tilt.y !== 0;

  return (
    <motion.div
      key={trip.id}
      initial={isNew ? { opacity: 0, scale: 0.85, y: 24 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.18 } }}
      transition={isNew
        ? { type: "spring", stiffness: 280, damping: 18 }
        : { delay: index * 0.04, duration: 0.25, ease: "easeOut" }
      }
      className="cursor-pointer py-1.5 px-3"
      onClick={onClick}
    >
      <div
        ref={(el) => { cardRef.current = el; onRef?.(el); }}
        onMouseMove={isMobile ? undefined : handleMouseMove}
        onMouseLeave={isMobile ? undefined : handleMouseLeave}
        className={`relative rounded-[24px] py-4 pr-4 overflow-hidden border backdrop-blur-sm ${selected
          ? "bg-violet-500/10 border-[#8b5cf6]/40 pl-5 shadow-[0_0_24px_rgba(139,92,246,0.12),inset_0_0_0_1px_rgba(139,92,246,0.12)]"
          : "bg-white/[0.04] border-white/[0.07] pl-4 hover:bg-white/[0.07] hover:border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          }`}
        style={{
          transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)${selected ? " scale(1.01)" : ""}`,
          transition: isHovering ? "transform 0.1s ease" : "transform 0.5s ease, background-color 0.3s, border-color 0.3s",
          willChange: "transform",
        }}
      >
        {/* 封面照片背景 */}
        {trip.cover_url && (
          <>
            <img
              src={parseCoverPos(trip.cover_url).clean}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "saturate(0.85) brightness(0.9)" }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(120deg, rgba(9,9,11,0.62) 0%, rgba(9,9,11,0.82) 60%, rgba(9,9,11,0.95) 100%)" }}
            />
          </>
        )}
        {/* Mouse-tracking glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${accent.from}1a 0%, transparent 65%)`,
            opacity: isHovering ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
        {/* Accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300"
          style={{
            background: `linear-gradient(to bottom, ${accent.from}, ${accent.to})`,
            opacity: selected ? 1 : 0,
            boxShadow: selected ? `0 0 10px ${accent.from}` : "none",
          }}
        />
        <div className="relative flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            {(flags || trip.start_date) && (
              <div className="flex items-center justify-between mb-1">
                <div className="text-xl tracking-widest filter drop-shadow-sm">{flags}</div>
                {trip.start_date && (
                  <Tag className="!rounded-full border-none bg-zinc-800 text-zinc-500 text-[10px] px-2" color="default">
                    {trip.start_date.substring(0, 4)}
                  </Tag>
                )}
              </div>
            )}
            <Typography.Text strong className={`font-display block text-[14px] leading-tight ${selected ? "text-white" : "text-zinc-200"}`}>
              {trip.name}
            </Typography.Text>
          </div>
          <button
            aria-label="在地球上聚焦這趟旅程"
            title="在地球上聚焦"
            onClick={(e) => { e.stopPropagation(); onFocusGlobe(); }}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-1.5 border transition-colors cursor-pointer ${selected
              ? "text-violet-300 border-violet-500/40 bg-violet-500/15"
              : "text-zinc-500 border-white/[0.08] bg-white/[0.04] hover:text-zinc-200 hover:bg-white/[0.1]"
              }`}
          >
            <AimOutlined style={{ fontSize: 13 }} />
          </button>
        </div>
        <div className="relative space-y-1">
          {(trip.start_date || trip.end_date) && (
            <div className={`flex items-center gap-1.5 text-[11px] ${trip.cover_url ? "text-zinc-300" : "text-zinc-500"}`}>
              <CalendarIcon size={12} className="opacity-60 shrink-0" />
              <span>{trip.start_date}{trip.end_date && ` → ${trip.end_date}`}</span>
            </div>
          )}
          {trip.countries && (
            <div className={`flex items-center gap-1.5 text-[11px] ${trip.cover_url ? "text-zinc-300" : "text-zinc-500"}`}>
              <LocationIcon size={12} className="opacity-60 shrink-0" />
              <span className="truncate">{trip.countries}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  // 開場過場動畫只保留給 PWA（加入主畫面後的 standalone 模式）
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    setIsPWA(standalone);
  }, []);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(true);
  const [sortKey, setSortKey] = useState<"added" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [newTripId, setNewTripId] = useState<string | null>(null);
  const prevTripIdsRef = useRef(new Set<string>());
  const cardElsRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function checkAuth() {
    setAuthError(false);
    fetchWithAuth("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) fetchAll();
        else setLoading(false);
      })
      .catch(() => setAuthError(true));
  }

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    const cachedTrips = localStorage.getItem("travel_trips");
    const cachedSegs = localStorage.getItem("travel_segments");
    if (cachedTrips) setTrips(JSON.parse(cachedTrips));
    if (cachedSegs) setSegments(JSON.parse(cachedSegs));
    if (cachedTrips) setLoading(false);
    const [tripsRes, segsRes] = await Promise.all([
      fetchWithAuth("/api/sheets"),
      fetchWithAuth("/api/segments"),
    ]);
    if (tripsRes.ok) {
      const trips = (await tripsRes.json()).trips;
      setTrips(trips);
      localStorage.setItem("travel_trips", JSON.stringify(trips));
    }
    if (segsRes.ok) {
      const segments = (await segsRes.json()).segments;
      setSegments(segments);
      localStorage.setItem("travel_segments", JSON.stringify(segments));
    }
    setLoading(false);
  }

  function navigateToTrip(tripId: string) {
    const el = cardElsRef.current.get(tripId);
    if (el) {
      const rect = el.getBoundingClientRect();
      sessionStorage.setItem(`trip_card_rect_${tripId}`, JSON.stringify({
        left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      }));
    }
    router.push(`/trips/${tripId}`);
  }

  // Detect newly added trip for spring animation
  useEffect(() => {
    const prevIds = prevTripIdsRef.current;
    if (prevIds.size > 0) {
      const found = trips.find(t => !prevIds.has(t.id));
      if (found) {
        setNewTripId(found.id);
        const timer = setTimeout(() => setNewTripId(null), 1500);
        return () => clearTimeout(timer);
      }
    }
    prevTripIdsRef.current = new Set(trips.map(t => t.id));
  }, [trips]);

  // 跟卡片國旗同一套解析：數 unique ISO 國碼，Nominatim 地址片段（縣市、郵遞區號）不會被誤算成國家
  const uniqueCountries = new Set(
    trips.flatMap((t) => getCountryCodes(t.countries ?? "", t.country_codes ?? ""))
  ).size;
  const totalTravelDays = trips.reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum;
    const d = Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000);
    return sum + Math.max(0, d);
  }, 0);

  // 旅遊足跡的年份跨度（例：2024 到 2026）
  const tripYears = trips.flatMap((t) =>
    [t.start_date, t.end_date].filter(Boolean).map((d) => Number((d as string).slice(0, 4)))
  );
  const minYear = tripYears.length ? Math.min(...tripYears) : null;
  const maxYear = tripYears.length ? Math.max(...tripYears) : null;

  const statsActive = isMobile ? drawerOpen : !loading;
  const tripsCount = useCountUp(trips.length, statsActive);
  const countriesCount = useCountUp(uniqueCountries, statsActive);
  const daysCount = useCountUp(totalTravelDays, statsActive);

  // Login page mouse parallax (hooks must be top-level, applied only in !authenticated JSX)
  const loginMouseX = useMotionValue(0);
  const loginMouseY = useMotionValue(0);
  const globeX = useSpring(useTransform(loginMouseX, [-0.5, 0.5], [14, -14]), { stiffness: 55, damping: 20 });
  const globeY = useSpring(useTransform(loginMouseY, [-0.5, 0.5], [10, -10]), { stiffness: 55, damping: 20 });
  const cardX = useSpring(useTransform(loginMouseX, [-0.5, 0.5], [-20, 20]), { stiffness: 80, damping: 18 });
  const cardY = useSpring(useTransform(loginMouseY, [-0.5, 0.5], [-14, 14]), { stiffness: 80, damping: 18 });
  const cardRotX = useSpring(useTransform(loginMouseY, [-0.5, 0.5], [5, -5]), { stiffness: 80, damping: 18 });
  const cardRotY = useSpring(useTransform(loginMouseX, [-0.5, 0.5], [-5, 5]), { stiffness: 80, damping: 18 });

  if (authenticated === null && authError) {
    return (
      <div className="min-h-[100dvh] bg-[#09090b] flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-zinc-300 text-[15px] font-medium">連線失敗</div>
        <div className="text-zinc-500 text-[13px] text-center">無法確認登入狀態，請檢查網路後重試。</div>
        <button
          onClick={checkAuth}
          className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-9 px-5 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
        >
          重新連線
        </button>
      </div>
    );
  }

  if (authenticated === null && !isPWA) {
    return (
      <div className="min-h-[100dvh] bg-[#09090b] flex items-center justify-center">
        <LoadingOutlined className="!text-zinc-600" style={{ fontSize: 22 }} />
      </div>
    );
  }

  if (authenticated === null) {
    return (
      <div className="relative min-h-[100dvh] bg-[#09090b] overflow-hidden">
        {/* 3D Globe — fades in after icon lands */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <GlobeLoader />
        </motion.div>

        {/* Card — lower portion of screen */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center z-10 pointer-events-none px-4 pb-[22%]">
          <div className="max-w-[380px] w-full relative">
            {/* Card background fades in */}
            <motion.div
              className="bg-[#09090b]/40 backdrop-blur-md border border-white/10 rounded-[32px] py-8 px-10 flex flex-col items-center gap-4 shadow-[0_24px_64px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              {/* Placeholder that reserves space for the animated icon */}
              <div className="w-12 h-12 mb-1" />
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
              >
                <Typography.Text
                  className="font-extrabold text-2xl tracking-wider text-center"
                  style={{
                    fontFamily: 'var(--font-comfortaa)',
                    background: 'linear-gradient(90deg, #818cf8, #a78bfa, #2dd4bf)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Travel Tracker
                </Typography.Text>
                <Typography.Text className="text-zinc-500 text-[13px] text-center font-medium">
                  記錄你走過的每一段旅程
                </Typography.Text>
              </motion.div>
            </motion.div>

            {/* Icon — starts large at screen center, animates down into card */}
            <motion.div
              className="absolute flex items-center justify-center w-12 h-12"
              style={{ top: 32, left: "calc(50% - 24px)" }}
              initial={{ scale: 3.5, y: "-12vh" }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
            >
              <img src="/icon.svg" alt="" className="w-12 h-12 drop-shadow-[0_0_20px_rgba(139,92,246,0.3)]" />
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div
        className="relative min-h-[100dvh] bg-[#09090b] overflow-hidden flex flex-col"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          loginMouseX.set((e.clientX - rect.left) / rect.width - 0.5);
          loginMouseY.set((e.clientY - rect.top) / rect.height - 0.5);
        }}
        onMouseLeave={() => { loginMouseX.set(0); loginMouseY.set(0); }}
      >
        {/* Globe section */}
        <div className="flex-1 relative flex items-center justify-center">
          <motion.div className="opacity-80 pointer-events-none scale-110 md:scale-125" style={{ x: globeX, y: globeY }}>
            <LoginGlobe />
          </motion.div>
        </div>

        {/* Login section at bottom */}
        <div className="relative z-10 pb-[20vh] flex flex-col items-center px-4 -mt-[30vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            style={{ x: cardX, y: cardY, rotateX: cardRotX, rotateY: cardRotY, transformPerspective: 1200 }}
            className="bg-[#09090b]/10 backdrop-blur-md border border-white/10 rounded-[32px] py-8 px-10 flex flex-col items-center gap-4 max-w-[380px] w-full shadow-[0_24px_64px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
          >
            <div className="w-12 h-12 flex items-center justify-center mb-1">
              <img src="/icon.svg" alt="" className="w-12 h-12 drop-shadow-[0_0_20px_rgba(139,92,246,0.3)]" />
            </div>
            <Typography.Text
              className="font-extrabold text-2xl tracking-wider text-center"
              style={{
                fontFamily: 'var(--font-comfortaa)',
                background: 'linear-gradient(90deg, #818cf8, #a78bfa, #2dd4bf)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Travel Tracker
            </Typography.Text>
            <Typography.Text className="text-zinc-500 text-[13px] text-center font-medium">
              記錄你走過的每一段旅程
            </Typography.Text>
            <div className="w-full h-px bg-white/5 my-1" />
            <a href="/api/auth/google" className="w-full group">
              <Button
                size="large"
                className="w-full border-none! rounded-xl font-bold h-12 text-[15px] text-white! transition-all duration-300"
                style={{
                  background: 'linear-gradient(to right, #6366f1, #8b5cf6, #14b8a6)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'; e.currentTarget.style.transform = ''; }}
              >
                <div className="flex items-center justify-center gap-2">
                  <GoogleIcon />
                  <span>使用 Google 帳號登入</span>
                </div>
              </Button>
            </a>
          </motion.div>
        </div>
      </div>
    );
  }

  const tripListContent = loading ? (
    <div className="pt-3 px-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/[0.04] rounded-[18px] p-[14px] mb-2">
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: "60%" }} />
        </div>
      ))}
    </div>
  ) : trips.length === 0 ? (
    <div className="py-[60px] px-8 flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/[0.07] flex items-center justify-center">
        <GlobeIcon size={28} stroke="#3f3f46" strokeWidth={1.5} />
      </div>
      <Typography.Text className="text-zinc-500 text-sm">還沒有旅程記錄</Typography.Text>
      <Button type="primary" onClick={() => { setDrawerOpen(false); router.push("/trips/new"); }}>
        新增第一筆旅程
      </Button>
    </div>
  ) : (
    <>
      {/* Stats summary：說故事語氣的旅遊足跡 */}
      <div className="pt-4 px-4 pb-3 border-b border-[#27272a]">
        {trips.length > 0 && (
          <p className="text-zinc-400 text-[13px] leading-relaxed mb-2.5 px-0.5">
            {minYear !== null && (
              minYear === maxYear
                ? <>在 <span className="font-money text-zinc-300">{minYear}</span> 這一年，</>
                : <>從 <span className="font-money text-zinc-300">{minYear}</span> 到 <span className="font-money text-zinc-300">{maxYear}</span>，</>
            )}
            你一共走過了：
          </p>
        )}
        <div className="flex gap-2 mb-3">
          {[
            { value: tripsCount, label: "趟旅程" },
            { value: countriesCount, label: "個國家" },
            { value: daysCount, label: "天的旅途" },
          ].map(({ value, label }) => (
            <div key={label} className="flex-1 bg-white/[0.04] rounded-[14px] py-2.5 text-center border border-white/[0.07]">
              <div className="font-money text-zinc-100 text-xl font-bold leading-none">{value}</div>
              <div className="text-zinc-600 text-[11px] mt-[3px]">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-[6px]">
          {(["added", "date"] as const).map((key) => {
            const active = sortKey === key;
            const label = key === "added" ? "新增時間" : "行程日期";
            const arrow = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
            return (
              <button
                key={key}
                onClick={() => {
                  if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
                  else { setSortKey(key); setSortDir("desc"); }
                }}
                className={`flex-1 py-[6px] text-[11px] rounded-full cursor-pointer transition-all duration-200 font-medium border ${active
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-400"
                  }`}
              >
                {label}{arrow}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <AnimatePresence>
          {[...trips].sort((a, b) => {
            let cmp = 0;
            if (sortKey === "added") {
              cmp = (a.created_at || "").localeCompare(b.created_at || "");
            } else {
              cmp = (a.start_date || "").localeCompare(b.start_date || "");
            }
            return sortDir === "asc" ? cmp : -cmp;
          }).map((trip, index) => (
            <TripCard
              key={trip.id}
              trip={trip}
              selected={selectedTripId === trip.id}
              isNew={trip.id === newTripId}
              index={index}
              isMobile={isMobile}
              onClick={() => navigateToTrip(trip.id)}
              onFocusGlobe={() => {
                setSelectedTripId((prev) => prev === trip.id ? null : trip.id);
                if (isMobile) setDrawerOpen(false);
              }}
              onRef={(el) => cardElsRef.current.set(trip.id, el)}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] w-full bg-[#09090b] relative overflow-hidden">
      {/* 1. Global Background Globe */}
      <div className="absolute inset-0 z-0 md:-translate-x-[170px]">
        <TripGlobe
          trips={trips}
          segments={segments}
          selectedTripId={selectedTripId}
          onTripClick={(id) => setSelectedTripId((prev) => prev === id ? null : id)}
          showAllTracks={showAllTracks}
        />
      </div>

      {/* 2. Main UI Layer */}
      <Layout className="relative z-10 h-full w-full !bg-transparent flex flex-col pointer-events-none">
        {/* Header - Glassmorphism */}
        <Layout.Header
          style={{ background: 'transparent' }}
          className="flex items-center justify-between backdrop-blur-md !px-3 md:px-6 h-14 border-none shadow-none shrink-0 pointer-events-auto"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 shrink-0 drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]">
              <img src="/icon.svg" alt="" className="w-full h-full" />
            </div>
            <Typography.Text className="font-extrabold text-[16px] md:text-lg tracking-wider" style={{ fontFamily: 'var(--font-comfortaa)', background: 'linear-gradient(90deg, #818cf8, #a78bfa, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Travel Tracker
            </Typography.Text>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAllTracks((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer ${isMobile ? "w-8 h-8 justify-center" : "px-3 h-8"
                } ${showAllTracks
                  ? "bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#14b8a6] text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)]"
                  : "bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
            >
              <GlobeIcon size={13} />
              {!isMobile && (showAllTracks ? "隱藏航跡" : "全部航跡")}
            </button>
            <button
              onClick={() => router.push("/trips/new")}
              className={`inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#14b8a6] text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] transition-all duration-200 hover:shadow-[0_6px_28px_rgba(99,102,241,0.55)] hover:-translate-y-px cursor-pointer ${isMobile ? "w-8 h-8 justify-center" : "px-3 h-8"
                }`}
            >
              <PlusIcon size={13} />
              {!isMobile && "新增旅程"}
            </button>
            <Dropdown
              trigger={["click"]}
              open={dropdownOpen}
              onOpenChange={setDropdownOpen}
              popupRender={() => (
                <div className="bg-[#18181b] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl min-w-[160px]">
                  <a href="/api/auth/logout" className="block">
                    <button className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-white/[0.06] transition-colors text-left cursor-pointer">
                      <LogoutIcon size={13} />
                      登出
                    </button>
                  </a>
                </div>
              )}
            >
              <button className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 flex items-center justify-center transition-all duration-200 cursor-pointer">
                <UserOutlined style={{ fontSize: 14 }} />
              </button>
            </Dropdown>
          </div>
        </Layout.Header>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Mobile List Toggle Button */}
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="backdrop-blur-md inline-flex items-center gap-2 !rounded-full px-5 h-12 text-[#f4f4f5] text-[14px] font-semibold shadow-2xl pointer-events-auto fixed right-5 z-50 cursor-pointer"
              style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
            >
              <MenuListIcon size={15} />
              旅程列表
            </button>
          )}

          {/* Desktop Sidebar */}
          {!isMobile && (
            <div
              className="glass-heavy absolute right-4 top-4 bottom-4 rounded-[24px] overflow-hidden pointer-events-auto flex flex-col"
              style={{ width: 340 }}
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {tripListContent}
              </div>
            </div>
          )}
        </div>
      </Layout>

      {/* 3. Overlays (Modals and Drawers) */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="bottom"
          title={<span className="text-[#f4f4f5] font-bold">我的旅程</span>}
          className="backdrop-blur-md"
          styles={{
            wrapper: { height: "85vh" },
            header: { background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.05)" },
            body: { background: "transparent", padding: 0, overflowY: "auto" },
            mask: { backdropFilter: "blur(4px)" },
            section: { borderRadius: '24px 24px 0 0' }
          }}
          closeIcon={<CloseIcon size={14} stroke="#a1a1aa" />}
        >
          {tripListContent}
        </Drawer>
      )}

    </div>

  );
}
