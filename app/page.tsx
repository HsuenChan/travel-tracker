"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Layout,
  Button,
  Typography,
  Spin,
  Drawer,
  Tag,
  Skeleton,
} from "antd";
import { UnorderedListOutlined, PlusOutlined, GlobalOutlined, LogoutOutlined } from "@ant-design/icons";
import AddTripModal from "./components/AddTripModal";
import { getCountryFlags } from "@/lib/countries";

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
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) fetchAll();
        else setLoading(false);
      });
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [tripsRes, segsRes] = await Promise.all([
      fetch("/api/sheets"),
      fetch("/api/segments"),
    ]);
    if (tripsRes.ok) setTrips((await tripsRes.json()).trips);
    if (segsRes.ok) setSegments((await segsRes.json()).segments);
    setLoading(false);
  }

  async function fetchTrips() {
    const res = await fetch("/api/sheets");
    if (res.ok) setTrips((await res.json()).trips);
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
        <div className="relative z-10 bg-[#09090b]/55 backdrop-blur-[24px] border border-white/10 rounded-3xl py-12 px-[52px] flex flex-col items-center gap-4 max-w-[380px] w-[88%] shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
          <div className="text-4xl mb-1">✈️</div>
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
        <div key={i} className="bg-[#1c1c1e] rounded-[10px] p-[14px] mb-2">
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: "60%" }} />
        </div>
      ))}
    </div>
  ) : trips.length === 0 ? (
    <div className="py-[60px] px-8 flex flex-col items-center gap-3">
      <div className="text-5xl">🗺️</div>
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
            <div key={label} className="flex-1 bg-[#1c1c1e] rounded-[10px] py-2.5 text-center border border-[#2c2c2e]">
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
                className={`flex-1 py-[6px] text-[11px] rounded-full cursor-pointer transition-all duration-200 font-bold border ${
                  active 
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
              <div className={`relative rounded-[24px] py-4 pr-4 transition-all duration-300 ease-in-out overflow-hidden border ${selected ? "bg-zinc-800/80 border-[#8b5cf6]/50 pl-5 shadow-[0_0_20px_rgba(139,92,246,0.15)] scale-[1.01]" : "bg-zinc-900/40 border-white/5 pl-4 hover:bg-zinc-800/40"}`}>
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
                      <span className="opacity-70">📅</span>
                      <span>{trip.start_date}{trip.end_date && ` → ${trip.end_date}`}</span>
                    </div>
                  )}
                  {trip.countries && (
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                      <span className="opacity-70">📍</span>
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
          className="flex items-center justify-between glass-premium px-3 md:px-6 h-16 border-none shadow-none shrink-0 pointer-events-auto"
        >
          <Typography.Text strong className="text-white text-[16px] md:text-lg font-black tracking-tight">
            ✈️ Travel Tracker
          </Typography.Text>
          <div className="flex gap-2.5">
            <Button
              icon={<GlobalOutlined />}
              onClick={() => setShowAllTracks((v) => !v)}
              size={isMobile ? "small" : "middle"}
              type={showAllTracks ? "primary" : "default"}
              className="!rounded-full border-white/10"
            >
              {isMobile ? "" : (showAllTracks ? "隱藏航跡" : "全部航跡")}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowModal(true)}
              size={isMobile ? "small" : "middle"}
              className="!rounded-full bg-linear-to-r from-[#8b5cf6] to-[#d946ef] border-none shadow-lg shadow-purple-500/20"
            >
              {isMobile ? "" : "新增旅程"}
            </Button>
            <a href="/api/auth/logout" className="flex">
              <Button
                icon={<LogoutOutlined />}
                size={isMobile ? "small" : "middle"}
                title="登出"
                className="!rounded-full border-white/10"
              />
            </a>
          </div>
        </Layout.Header>

        {/* Content Area */}
        <Layout className="flex-1 !bg-transparent overflow-hidden flex flex-row">
          <Layout.Content className="relative flex-1 !bg-transparent">
            {/* Mobile List Toggle Button */}
            {isMobile && (
              <Button
                icon={<UnorderedListOutlined />}
                onClick={() => setDrawerOpen(true)}
                className="glass-premium !text-[#f4f4f5] !rounded-full shadow-2xl leading-none px-6 h-12 border-white/10 pointer-events-auto"
                style={{
                  position: "absolute",
                  right: 20,
                  bottom: "calc(24px + env(safe-area-inset-bottom, 0px))"
                }}
              >
                旅程列表
              </Button>
            )}
          </Layout.Content>

          {/* Desktop Sidebar */}
          {!isMobile && (
            <Layout.Sider
              width={340}
              style={{ background: 'transparent' }}
              className="glass-heavy !m-4 !rounded-[2rem] overflow-hidden border-none shadow-2xl pointer-events-auto"
            >
              <div className="h-full overflow-auto custom-scrollbar">
                {tripListContent}
              </div>
            </Layout.Sider>
          )}
        </Layout>
      </Layout>

      {/* 3. Overlays (Modals and Drawers) */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="bottom"
          height="85vh"
          title={<span className="text-[#f4f4f5] font-bold">我的旅程</span>}
          className="glass-premium-drawer"
          styles={{
            header: { background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.05)" },
            body: { background: "transparent", padding: 0, overflowY: "auto" },
            mask: { backdropFilter: "blur(4px)" },
            content: { borderRadius: '24px 24px 0 0' }
          }}
          closeIcon={<span className="text-[#a1a1aa]">✕</span>}
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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" className="mr-1.5 align-middle">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
