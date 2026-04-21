"use client";

import { useState, useEffect, useRef } from "react";
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
} from "antd";
import AddTripModal from "./components/AddTripModal";
import { getCountryFlags } from "@/lib/countries";
import {
  PlaneIcon, PlusIcon, GlobeIcon, CalendarIcon, LocationIcon,
  MenuListIcon, LogoutIcon, CloseIcon, GoogleIcon,
} from "@/app/components/Icons";

const TripGlobe = dynamic(() => import("./components/TripGlobe"), { ssr: false });

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

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [sortKey, setSortKey] = useState<"added" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetchWithAuth("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) fetchAll();
        else setLoading(false);
      });
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

  async function fetchTrips() {
    const res = await fetchWithAuth("/api/sheets");
    if (res.ok) {
      const trips = (await res.json()).trips;
      setTrips(trips);
      localStorage.setItem("travel_trips", JSON.stringify(trips));
    }
  }

  if (authenticated === null) {
    return (
      <div className="min-h-[100dvh] bg-[#09090b] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="relative min-h-[100dvh] bg-[#09090b] overflow-hidden flex items-center justify-center">
        {/* Globe background */}
        <div className="absolute inset-0 opacity-55 pointer-events-none">
          <TripGlobe
            trips={[]}
            segments={[]}
            selectedTripId={null}
            onTripClick={() => { }}
            showAllTracks={false}
          />
        </div>

        {/* Glassmorphism login card */}
        <div className="relative z-10 bg-[#09090b]/55 border border-white/10 rounded-3xl py-12 px-[52px] flex flex-col items-center gap-4 max-w-[380px] w-[88%] shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 border border-violet-500/30 flex items-center justify-center shadow-[0_0_32px_rgba(139,92,246,0.2)] mb-1">
            <PlaneIcon size={26} stroke="#c4b5fd" strokeWidth={1.8} />
          </div>
          <Typography.Title level={2} className="!text-white !m-0 !tracking-[-0.5px]">
            Travel Tracker
          </Typography.Title>
          <Typography.Text className="text-zinc-400 text-sm text-center">
            記錄你走過的每一段旅程
          </Typography.Text>
          <div className="w-full h-px bg-white/10 my-2" />
          <a href="/api/auth/google" className="w-full">
            <Button
              size="large"
              className="w-full !bg-white !text-[#09090b] !border-white rounded-xl font-semibold h-12 text-[15px]"
            >
              <GoogleIcon /> 使用 Google 登入
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const uniqueCountries = Array.from(
    new Set(
      trips.flatMap((t) =>
        t.countries ? t.countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean) : []
      )
    )
  ).length;

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
      <Button type="primary" onClick={() => { setShowModal(true); setDrawerOpen(false); }}>
        新增第一筆旅程
      </Button>
    </div>
  ) : (
    <>
      {/* Stats summary */}
      <div className="pt-4 px-4 pb-3 border-b border-[#27272a]">
        <div className="flex gap-2 mb-3">
          {[
            { value: trips.length, label: "旅程" },
            { value: uniqueCountries, label: "國家" },
            { value: segments.length, label: "段落" },
          ].map(({ value, label }) => (
            <div key={label} className="flex-1 bg-white/[0.04] rounded-[14px] py-2.5 text-center border border-white/[0.07]">
              <div className="text-zinc-100 text-xl font-bold leading-none">{value}</div>
              <div className="text-zinc-600 text-[11px] mt-[3px]">{label}</div>
            </div>
          ))}
        </div>
        <Typography.Text className="text-zinc-700 text-[11px] block mb-2">
          {isMobile ? "長按進入詳情" : "雙擊進入詳情"}
        </Typography.Text>
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
                className={`flex-1 py-[6px] text-[11px] rounded-full cursor-pointer transition-all duration-200 font-bold border ${active
                  ? "bg-linear-to-r from-[#8b5cf6] to-[#d946ef] border-none text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
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
        {[...trips].sort((a, b) => {
          let cmp = 0;
          if (sortKey === "added") {
            cmp = (a.created_at || "").localeCompare(b.created_at || "");
          } else {
            cmp = (a.start_date || "").localeCompare(b.start_date || "");
          }
          return sortDir === "asc" ? cmp : -cmp;
        }).map((trip) => {
          const flags = getCountryFlags(trip.countries ?? "");
          const selected = selectedTripId === trip.id;
          return (
            <div
              key={trip.id}
              onClick={() => {
                setSelectedTripId((prev) => prev === trip.id ? null : trip.id);
                if (isMobile) setDrawerOpen(false);
              }}
              onDoubleClick={!isMobile ? () => router.push(`/trips/${trip.id}`) : undefined}
              onTouchStart={() => {
                longPressTimer.current = setTimeout(() => {
                  router.push(`/trips/${trip.id}`);
                }, 500);
              }}
              onTouchEnd={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              onTouchMove={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              className="cursor-pointer py-1.5 px-3"
            >
              <div className={`relative rounded-[24px] py-4 pr-4 transition-all duration-300 ease-in-out overflow-hidden border backdrop-blur-sm ${selected ? "bg-violet-500/10 border-[#8b5cf6]/40 pl-5 shadow-[0_0_24px_rgba(139,92,246,0.12),inset_0_0_0_1px_rgba(139,92,246,0.12)] scale-[1.01]" : "bg-white/[0.04] border-white/[0.07] pl-4 hover:bg-white/[0.07] hover:border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"}`}>
                {/* 選中時的紫色光條 */}
                {selected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#8b5cf6] shadow-[0_0_10px_#8b5cf6]" />
                )}
                <div className="flex items-start justify-between mb-2">
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
                    <Typography.Text strong className={`block text-[14px] leading-tight ${selected ? "text-white" : "text-zinc-200"}`}>
                      {trip.name}
                    </Typography.Text>
                  </div>
                </div>

                <div className="space-y-1">
                  {(trip.start_date || trip.end_date) && (
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <CalendarIcon size={12} className="opacity-60 shrink-0" />
                      <span>{trip.start_date}{trip.end_date && ` → ${trip.end_date}`}</span>
                    </div>
                  )}
                  {trip.countries && (
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <LocationIcon size={12} className="opacity-60 shrink-0" />
                      <span className="truncate">{trip.countries}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] w-full bg-[#09090b] relative overflow-hidden">
      {/* 1. Global Background Globe */}
      <div className="absolute inset-0 z-0">
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
          className="flex items-center justify-between backdrop-blur-md px-3 md:px-6 h-14 border-none shadow-none shrink-0 pointer-events-auto"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_2px_10px_rgba(139,92,246,0.4)] shrink-0">
              <PlaneIcon size={14} stroke="#fff" strokeWidth={2.2} />
            </div>
            <Typography.Text strong className="text-white text-[16px] md:text-lg font-black tracking-tight">
              Travel Tracker
            </Typography.Text>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAllTracks((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${isMobile ? "w-8 h-8 justify-center" : "px-3 h-8"
                } ${showAllTracks
                  ? "bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] text-white shadow-[0_4px_20px_rgba(139,92,246,0.35)]"
                  : "bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
            >
              <GlobeIcon size={13} />
              {!isMobile && (showAllTracks ? "隱藏航跡" : "全部航跡")}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] text-white shadow-[0_4px_20px_rgba(139,92,246,0.35)] transition-all duration-200 hover:shadow-[0_6px_28px_rgba(139,92,246,0.5)] hover:-translate-y-px ${isMobile ? "w-8 h-8 justify-center" : "px-3 h-8"
                }`}
            >
              <PlusIcon size={13} />
              {!isMobile && "新增旅程"}
            </button>
            <a href="/api/auth/logout">
              <button
                title="登出"
                className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 flex items-center justify-center transition-all duration-200"
              >
                <LogoutIcon size={14} />
              </button>
            </a>
          </div>
        </Layout.Header>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Mobile List Toggle Button */}
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="backdrop-blur-md inline-flex items-center gap-2 !rounded-full px-5 h-12 text-[#f4f4f5] text-[14px] font-semibold shadow-2xl pointer-events-auto fixed right-5 z-50"
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
            content: { borderRadius: '24px 24px 0 0' }
          }}
          closeIcon={<CloseIcon size={14} stroke="#a1a1aa" />}
        >
          {tripListContent}
        </Drawer>
      )}

      {showModal && (
        <AddTripModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchTrips(); }}
        />
      )}
    </div>

  );
}
