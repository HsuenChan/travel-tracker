"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Layout, Typography, Tag, Timeline, Spin, ConfigProvider, theme } from "antd";
import SegmentCard from "@/app/components/SegmentCard";
import TripHero from "@/app/components/TripHero";
import MobileNav from "@/app/components/MobileNav";
import { PlaneIcon, PhotoIcon, CalendarIcon, CoinIcon, NotepadIcon, GiftIcon, BackpackIcon } from "@/app/components/Icons";
import PhotoWall from "@/app/components/PhotoWall";
import ItineraryTab from "@/app/components/ItineraryTab";
import ExpensesTab from "@/app/components/ExpensesTab";
import NotesTab from "@/app/components/NotesTab";
import SouvenirsTab from "@/app/components/SouvenirsTab";
import GearTab from "@/app/components/GearTab";
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

export default function SharePageClient() {
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
      .then(async (data) => {
        if (!data) { setLoading(false); return; }

        // If the viewer is a trip member, redirect to the full edit view
        try {
          const authRes = await fetch("/api/auth/status");
          if (authRes.ok) {
            const { userId } = await authRes.json();
            if (userId) {
              const membersRes = await fetch(`/api/trips/${data.trip.id}/members`);
              if (membersRes.ok) {
                const { members } = await membersRes.json();
                if (members.some((m: { user_id: string }) => m.user_id === userId)) {
                  const tab = searchParams.get("tab");
                  router.replace(`/trips/${data.trip.id}${tab ? `?tab=${tab}` : ""}`);
                  return;
                }
              }
            }
          }
        } catch {
          // fall through and show read-only share page
        }

        setTrip(data.trip);
        setSegments(data.segments);
        setItinerary(data.itinerary || []);
        setExpenses(data.expenses || []);
        setNote(data.note);

        if ((data.itinerary || []).length === 0 && data.segments.length > 0 && !searchParams.get("tab")) {
          setActiveTab("transport");
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const timelineItems = segments.map((seg) => ({
    key: seg.id,
    color: "blue",
    content: <SegmentCard seg={seg} />,
  }));

  const currencies = trip.currency ? trip.currency.split(",") : ["TWD"];
  const primaryCurrency = currencies[0];

  const tabs = [
    { key: "transport", label: "路線", icon: <PlaneIcon size={18} /> },
    { key: "itinerary", label: "行程", icon: <CalendarIcon size={18} /> },
    { key: "expenses", label: "費用", icon: <CoinIcon size={18} /> },
    { key: "photos", label: "照片", icon: <PhotoIcon size={18} /> },
    { key: "notes", label: "筆記", icon: <NotepadIcon size={18} /> },
    { key: "souvenirs", label: "伴手禮", icon: <GiftIcon size={18} /> },
    { key: "gear", label: "裝備", icon: <BackpackIcon size={18} /> },
  ]
    .filter(tab => {
      return !trip.enabled_tabs || trip.enabled_tabs.includes(tab.key);
    })
    .sort((a, b) => {
      if (!trip.enabled_tabs) return 0;
      return trip.enabled_tabs.indexOf(a.key) - trip.enabled_tabs.indexOf(b.key);
    });

  // URL 或預設的分頁沒被啟用時，內容區不該整片空白：夾到第一個可見分頁
  const visibleTab = tabs.some((t) => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? activeTab);

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
          <TripHero
            coverUrl={(itinerary.find((i: { image_urls?: string[] | null }) => i.image_urls && i.image_urls.length > 0)?.image_urls?.[0]) ?? null}
            name={trip.name}
            startDate={trip.start_date}
            endDate={trip.end_date}
            countries={trip.countries}
            notes={trip.notes}
          />

          {/* Desktop Tabs (Segmented-like) */}
          <div className="hidden md:flex items-center justify-center mb-8 py-2 sticky top-14 z-[90] bg-[#09090b]/60 backdrop-blur-md">
            <div className="flex bg-[#18181b]/80 border border-white/8 backdrop-blur-md rounded-full p-1.5 shadow-xl">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 px-5 h-9 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${visibleTab === tab.key
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
              key={visibleTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onAnimationComplete={() => { }}
            >
              {visibleTab === "itinerary" && (
                <ItineraryTab
                  tripId={trip.id}
                  isActive={true}
                  destination={trip.countries}
                  readOnly={true}
                  initialItems={itinerary}
                  people={trip.people || []}
                  currency={primaryCurrency}
                  currencies={currencies}
                  initialExpenses={expenses}
                />
              )}
              {visibleTab === "transport" && (
                <div className="space-y-4">
                  <Typography.Text strong className="text-zinc-100 text-[15px] block mb-2 px-1">路線安排</Typography.Text>
                  {segments.length > 0 ? (
                    <Timeline className="segment-timeline" items={timelineItems} />
                  ) : (
                    <div className="py-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center text-zinc-600 text-sm">
                      尚無交通安排
                    </div>
                  )}
                </div>
              )}
              {visibleTab === "expenses" && (
                <ExpensesTab
                  tripId={trip.id}
                  people={trip.people || []}
                  currency={primaryCurrency}
                  currencies={currencies}
                  readOnly={true}
                  initialExpenses={expenses}
                  tripEndDate={trip.end_date}
                />
              )}
              {visibleTab === "notes" && (
                <NotesTab
                  tripId={trip.id}
                  readOnly={true}
                  initialContent={note?.content}
                />
              )}
              {visibleTab === "souvenirs" && (
                <SouvenirsTab
                  tripId={trip.id}
                  readOnly={true}
                />
              )}
              {visibleTab === "gear" && (
                <GearTab
                  tripId={trip.id}
                  people={trip.people || []}
                  readOnly={true}
                />
              )}
              {visibleTab === "photos" && (
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

        <MobileNav
          className="md:hidden"
          activeKey={visibleTab}
          onChange={handleTabChange}
          tabs={tabs}
        />

      </Layout>
    </ConfigProvider>
  );
}
