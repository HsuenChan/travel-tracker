"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Layout, Typography, Tag, Timeline, Spin, ConfigProvider, theme } from "antd";
import VehicleIconChip from "@/app/components/VehicleIconChip";
import { PlaneIcon, PhotoIcon, CalendarIcon, CreditCardIcon, FileTextIcon } from "@/app/components/Icons";
import { getCountryFlags } from "@/lib/countries";
import PhotoWall from "@/app/components/PhotoWall";
import ItineraryTab from "@/app/components/ItineraryTab";
import ExpensesTab from "@/app/components/ExpensesTab";
import NotesTab from "@/app/components/NotesTab";
import { motion, AnimatePresence } from "framer-motion";

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

  const tabs = [
    { key: "itinerary", label: "行程", icon: <CalendarIcon size={18} /> },
    { key: "transport", label: "交通", icon: <PlaneIcon size={18} /> },
    { key: "expenses", label: "費用", icon: <CreditCardIcon size={18} /> },
    { key: "notes", label: "筆記", icon: <FileTextIcon size={18} /> },
    ...(trip.photo_album_id ? [{ key: "photos", label: "照片", icon: <PhotoIcon size={18} /> }] : []),
  ];

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout className="min-h-screen bg-[#09090b] text-zinc-400" style={{ overflow: 'clip' }}>
        <Layout.Header className="flex items-center justify-between border-b border-white/[0.06] px-5 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-[100] h-16 leading-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <PlaneIcon size={16} stroke="#fff" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <Typography.Text className="text-white text-sm font-bold tracking-tight">Travel Tracker</Typography.Text>
              <Typography.Text className="text-zinc-500 text-[10px] font-medium tracking-wider uppercase">Shared View</Typography.Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag color="blue" className="!rounded-full !m-0 !border-blue-500/30 !bg-blue-500/10 !text-blue-400 font-medium">唯讀模式</Tag>
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
                  <span key={c} className="text-xs font-medium text-zinc-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{c}</span>
                ))}
              </div>
              
              <Typography.Title level={2} className="!text-white !m-0 !mb-4 !text-2xl !font-bold tracking-tight">
                {trip.name}
              </Typography.Title>
              
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1.5">
                  <CalendarIcon size={14} className="text-blue-400" />
                  <span className="text-[13px] font-medium text-zinc-300">
                    {trip.start_date} → {trip.end_date}
                  </span>
                  {duration !== null && (
                    <span className="ml-1 text-zinc-500 text-xs border-l border-white/10 pl-2">
                      {duration} 天
                    </span>
                  )}
                </div>
              </div>
              
              {trip.notes && (
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <Typography.Text className="text-zinc-500 text-[13px] leading-relaxed block whitespace-pre-wrap italic">
                    「 {trip.notes} 」
                  </Typography.Text>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Tabs (Segmented-like) */}
          <div className="hidden md:flex items-center justify-center mb-8 sticky top-[80px] z-50">
            <div className="flex bg-[#18181b]/80 border border-white/[0.08] backdrop-blur-md rounded-full p-1.5 shadow-xl">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 px-5 h-9 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
                    activeTab === tab.key
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
              transitionEnd={{ transform: "none" }}
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
                  <Typography.Text strong className="text-zinc-100 text-[15px] block mb-2 px-1">交通安排</Typography.Text>
                  {segments.length > 0 ? (
                    <Timeline items={timelineItems} />
                  ) : (
                    <div className="py-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center text-zinc-600 text-sm">
                      尚無交通安排
                    </div>
                  )}
                </div>
              )}
              {activeTab === "expenses" && (
                <ExpensesTab
                  tripId={trip.id}
                  people={trip.people || []}
                  currency={trip.currency || "TWD"}
                  currencies={["TWD", "USD", "EUR", "JPY", "KRW", "HKD", "SGD", "THB", "GBP", "AUD", "CNY", "MYR"]}
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
              {activeTab === "photos" && (
                <div className="space-y-4">
                  <Typography.Text strong className="text-zinc-100 text-[15px] block mb-2 px-1">相簿</Typography.Text>
                  <PhotoWall albumUrl={trip.photo_album_id} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </Layout.Content>

        {/* Mobile Navbar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[200] bg-[#09090b]/80 backdrop-blur-xl border-t border-white/[0.08] pt-2 pb-[safe-area-inset-bottom] h-[calc(70px+safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-full max-w-sm mx-auto px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group cursor-pointer ${
                  activeTab === tab.key ? "text-blue-400" : "text-zinc-500"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                  activeTab === tab.key ? "bg-blue-400/10" : "group-hover:bg-white/5"
                }`}>
                  {tab.icon}
                </div>
                <span className={`text-[10px] font-semibold transition-all duration-300 ${
                  activeTab === tab.key ? "opacity-100" : "opacity-60"
                }`}>
                  {tab.label}
                </span>
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="shared-nav-indicator"
                    className="absolute -top-2 w-1 h-1 bg-blue-400 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </Layout>
    </ConfigProvider>
  );
}
