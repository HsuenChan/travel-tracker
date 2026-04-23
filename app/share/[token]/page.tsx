"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Layout, Typography, Tag, Timeline, Spin, ConfigProvider, theme } from "antd";
import VehicleIconChip from "@/app/components/VehicleIconChip";
import { PlaneIcon, PhotoIcon, CalendarIcon, CreditCardIcon, NotepadIcon, LocationIcon, GiftIcon } from "@/app/components/Icons";
import { getCountryFlags } from "@/lib/countries";
import PhotoWall from "@/app/components/PhotoWall";
import ItineraryTab from "@/app/components/ItineraryTab";
import ExpensesTab from "@/app/components/ExpensesTab";
import NotesTab from "@/app/components/NotesTab";
import SouvenirsTab from "@/app/components/SouvenirsTab";
import { motion, AnimatePresence } from "framer-motion";

const TripMap = dynamic(() => import("@/app/components/TripMap"), { ssr: false });

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  countries: string;
  notes: string;
  photo_album_id: string;
  people: string[];
  currency: string;
  enabled_tabs?: string[] | null;
}

interface Segment {
  id: string;
  order: number;
  from_city: string;
  from_iata: string;
  to_city: string;
  to_iata: string;
  type: string;
  date: string;
  time: string;
  flight_no: string;
  aircraft: string;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [itinerary, setItinerary] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [note, setNote] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "itinerary");

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null; }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setTrip(data.trip);
          setSegments(data.segments);
          setItinerary(data.itinerary || []);
          setExpenses(data.expenses || []);
          setNote(data.note);

          // If no itinerary but has segments, default to transport
          if ((data.itinerary || []).length === 0 && data.segments.length > 0 && !searchParams.get("tab")) {
            setActiveTab("transport");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    router.push(`/share/${token}?tab=${key}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
        <Typography.Text className="text-zinc-500 text-base">找不到這筆旅程</Typography.Text>
        <Typography.Text className="text-zinc-700 text-[13px]">連結可能已失效</Typography.Text>
      </div>
    );
  }

  const duration =
    trip.start_date && trip.end_date
      ? Math.round(
        (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
      )
      : null;

  const countries = trip.countries
    ? trip.countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
    : [];

  const flags = getCountryFlags(trip.countries ?? "");

  const timelineItems = segments.map((seg) => ({
    key: seg.id,
    color: "blue",
    content: (
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-4 py-[14px] mb-1">
        <div className="flex items-center gap-2.5 mb-2">
          <VehicleIconChip type={seg.type} />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col items-start">
              <Typography.Text strong className="text-zinc-100 text-[15px] leading-[1.3]">{seg.from_city}</Typography.Text>
              {seg.from_iata && <span className="text-zinc-600 text-[11px] tracking-[0.05em]">{seg.from_iata}</span>}
            </div>
            <span className="text-zinc-700 text-base">→</span>
            <div className="flex flex-col items-start">
              <Typography.Text strong className="text-zinc-100 text-[15px] leading-[1.3]">{seg.to_city}</Typography.Text>
              {seg.to_iata && <span className="text-zinc-600 text-[11px] tracking-[0.05em]">{seg.to_iata}</span>}
            </div>
          </div>
        </div>
        <div className="pl-8 flex gap-1.5 flex-wrap">
          {seg.date && (
            <Tag color="geekblue" className="rounded-md">
              {seg.date}{seg.time && <span className="opacity-75"> {seg.time}</span>}
            </Tag>
          )}
          {seg.flight_no && <Tag color="purple" className="rounded-md">{seg.flight_no}</Tag>}
          {seg.aircraft && <Tag color="cyan" className="rounded-md">{seg.aircraft}</Tag>}
        </div>
      </div>
    ),
  }));

  const currencies = trip.currency ? trip.currency.split(",") : ["TWD"];
  const primaryCurrency = currencies[0];

  const tabs = [
    { key: "transport", label: "路線", icon: <PlaneIcon size={18} /> },
    { key: "itinerary", label: "行程", icon: <CalendarIcon size={18} /> },
    { key: "expenses", label: "費用", icon: <CreditCardIcon size={18} /> },
    { key: "photos", label: "照片", icon: <PhotoIcon size={18} /> },
    { key: "notes", label: "筆記", icon: <NotepadIcon size={18} /> },
    { key: "souvenirs", label: "伴手禮", icon: <GiftIcon size={18} /> },
  ]
    .filter(tab => {
      return !trip.enabled_tabs || trip.enabled_tabs.includes(tab.key);
    })
    .sort((a, b) => {
      if (!trip.enabled_tabs) return 0;
      return trip.enabled_tabs.indexOf(a.key) - trip.enabled_tabs.indexOf(b.key);
    });

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout className="min-h-screen bg-[#09090b] text-zinc-400" style={{ overflow: 'clip' }}>
        <Layout.Header
          style={{ background: 'transparent' }}
          className="flex items-center justify-between backdrop-blur-md px-3! md:px-6 h-14 border-none shadow-none shrink-0 pointer-events-auto sticky top-0 z-[100]"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 shrink-0 drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]">
              <img src="/icon.svg" alt="" className="w-full h-full" />
            </div>
            <Typography.Text className="font-extrabold text-[16px] md:text-lg tracking-wider" style={{ fontFamily: 'var(--font-comfortaa)', background: 'linear-gradient(90deg, #818cf8, #a78bfa, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Travel Tracker
            </Typography.Text>
          </div>
          <div className="flex items-center gap-2">
            <Tag color="blue" className="rounded-full! m-0! border-blue-500/30! bg-blue-500/10! text-blue-400! font-medium">唯讀模式</Tag>
          </div>
        </Layout.Header>

        <Layout.Content className="max-w-[800px] mx-auto py-6 px-4 pb-24 w-full">
          {/* Trip Summary Card */}
          <div className="relative overflow-hidden bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 mb-6">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <PlaneIcon size={120} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                {flags && <span className="text-2xl drop-shadow-md">{flags}</span>}
                {countries.map(c => (
                  <span
                    key={c}
                    className="rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5"
                    style={{
                      background: `#6366f112`,
                      border: `1px solid #6366f128`,
                      color: '#6366f1',
                      boxShadow: `0 0 15px #6366f115`,
                    }}
                  >
                    <LocationIcon size={11} />
                    {c}
                  </span>
                ))}
              </div>

              <Typography.Title level={2} className="text-white! m-0! mb-4! text-2xl! font-bold! tracking-tight">
                {trip.name}
              </Typography.Title>

              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1.5">
                  <CalendarIcon size={14} className="text-blue-400" />
                  <Typography.Text className="text-[13px] font-medium text-zinc-300">
                    {trip.start_date} → {trip.end_date}
                  </Typography.Text>
                  {duration !== null && (
                    <Typography.Text className="ml-1 text-zinc-500 text-xs border-l border-white/10 pl-2">
                      {duration} 天
                    </Typography.Text>
                  )}
                </div>
              </div>

              {trip.notes && (
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <div
                    className="notes-content"
                    dangerouslySetInnerHTML={{ __html: trip.notes }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Desktop Tabs (Segmented-like) */}
          <div className="hidden md:flex items-center justify-center mb-8 sticky top-[80px] z-50">
            <div className="flex bg-[#18181b]/80 border border-white/8 backdrop-blur-md rounded-full p-1.5 shadow-xl">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 px-5 h-9 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${activeTab === tab.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onAnimationComplete={() => { }}
            >
              {activeTab === "itinerary" && (
                <ItineraryTab
                  tripId={trip.id}
                  isActive={true}
                  destination={trip.countries}
                  readOnly={true}
                  initialItems={itinerary}
                />
              )}
              {activeTab === "transport" && (
                <div className="space-y-4">
                  <Typography.Text strong className="text-zinc-100 text-[15px] block mb-2 px-1">路線安排</Typography.Text>
                  {segments.length > 0 ? (
                    <Timeline items={timelineItems} />
                  ) : (
                    <div className="py-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center text-zinc-600 text-sm">
                      尚無交通安排
                    </div>
                  )}

                  <div className="mt-7">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <Typography.Text strong className="text-zinc-100 text-[15px]">旅程地圖</Typography.Text>
                    </div>
                    <TripMap tripId={trip.id} initialItems={itinerary} />
                  </div>
                </div>
              )}
              {activeTab === "expenses" && (
                <ExpensesTab
                  tripId={trip.id}
                  people={trip.people || []}
                  currency={primaryCurrency}
                  currencies={currencies}
                  readOnly={true}
                  initialExpenses={expenses}
                />
              )}
              {activeTab === "notes" && (
                <NotesTab
                  tripId={trip.id}
                  readOnly={true}
                  initialContent={note?.content}
                />
              )}
              {activeTab === "souvenirs" && (
                <SouvenirsTab
                  tripId={trip.id}
                  readOnly={true}
                />
              )}
              {activeTab === "photos" && (
                <div className="space-y-4">
                  <Typography.Text strong className="text-zinc-100 text-[15px] block mb-2 px-1">相簿</Typography.Text>
                  {trip.photo_album_id ? (
                    <PhotoWall albumUrl={trip.photo_album_id} />
                  ) : (
                    <div
                      className="flex flex-col items-center gap-4 py-20 rounded-3xl border border-white/5 bg-white/[0.02]"
                      style={{ background: 'radial-gradient(circle at 50% 50%, rgba(236,72,153,0.05) 0%, transparent 70%)' }}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                        <PhotoIcon size={32} stroke="#ec4899" strokeWidth={1.5} />
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-200 font-medium mb-1">尚未連結相簿</div>
                        <div className="text-zinc-500 text-xs px-10">此旅程目前還沒有提供 Google 相簿分享連結。</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </Layout.Content>

        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-400"
          style={{
            background: 'rgba(9,9,11,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        >
          <div className="flex justify-around items-center pt-2 px-1 max-w-sm mx-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-200 cursor-pointer"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={isActive ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' } : { color: '#52525b' }}
                  >
                    {tab.icon}
                  </div>
                  <span
                    className="text-[10px] font-medium transition-all duration-200"
                    style={{ color: isActive ? '#a78bfa' : '#52525b' }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </Layout>
    </ConfigProvider>
  );
}
