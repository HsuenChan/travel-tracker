"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Button, Typography,
  Skeleton, Popconfirm, Space, Tag, Timeline, Segmented, Modal, Dropdown, Tooltip, App,
} from "antd";
import {
  DeleteOutlined, LoadingOutlined, EditOutlined, MoreOutlined,
} from "@ant-design/icons";
import EditTripModal from "@/app/components/EditTripModal";
import AddSegmentModal from "@/app/components/AddSegmentModal";
import EditSegmentModal from "@/app/components/EditSegmentModal";
import PhotoWall from "@/app/components/PhotoWall";
import ItineraryTab from "@/app/components/ItineraryTab";
import ExpensesTab from "@/app/components/ExpensesTab";
import NotesTab from "@/app/components/NotesTab";
import SouvenirsTab from "@/app/components/SouvenirsTab";
import LineBotTripModal from "@/app/components/LineBotTripModal";
const TripMap = dynamic(() => import("@/app/components/TripMap"), { ssr: false });
import VehicleIconChip from "@/app/components/VehicleIconChip";
import {
  PlaneIcon, PlusIcon, CalendarIcon, LocationIcon, UsersIcon, GiftIcon,
  CreditCardIcon, PhotoIcon, ShareIcon, UserPlusIcon, EditIcon, TrashIcon, ChevronLeftIcon, NotepadIcon, MoreVerticalIcon, LineBotIcon,
} from "@/app/components/Icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { AIRPORT_TIMEZONES } from "@/lib/airports";

dayjs.extend(utc);
dayjs.extend(timezone);

function toTaiwanTime(date: string, time: string, fromIata: string): string | null {
  const tz = AIRPORT_TIMEZONES[fromIata];
  if (!tz || tz === "Asia/Taipei") return null;
  try {
    return dayjs.tz(`${date} ${time}`, tz).tz("Asia/Taipei").format("HH:mm");
  } catch {
    return null;
  }
}

interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  countries: string;
  notes: string;
  photo_album_id: string;
  people: string[] | null;
  currency: string | null;
  enabled_tabs?: string[] | null;
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
  date: string;
  time: string;
  arrival_date: string | null;
  arrival_time: string | null;
  flight_no: string;
  aircraft: string;
}

interface Member {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_owner: boolean;
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

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddSegment, setShowAddSegment] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sharing, setSharing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showLineBotModal, setShowLineBotModal] = useState(false);
  const { modal, message: messageApi } = App.useApp();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "transport");
  const [tabDirection, setTabDirection] = useState(1);
  const ALL_TABS = ["transport", "itinerary", "expenses", "photos", "notes", "souvenirs"];

  // Update ref whenever trip loads so animation direction matches user's custom sort order
  const tabOrderRef = useRef(ALL_TABS);
  useEffect(() => {
    if (trip?.enabled_tabs) {
      tabOrderRef.current = trip.enabled_tabs;
    }
  }, [trip]);

  // Sync state with URL changes (handle back/forward browser navigation)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "transport";
    if (tabFromUrl !== activeTab && tabOrderRef.current.includes(tabFromUrl)) {
      const order = tabOrderRef.current;
      setTabDirection(order.indexOf(tabFromUrl) > order.indexOf(activeTab) ? 1 : -1);
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    if (val === activeTab) return;
    const order = tabOrderRef.current;
    setTabDirection(order.indexOf(val) > order.indexOf(activeTab) ? 1 : -1);
    setActiveTab(val);

    // Update URL param
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set("tab", val);
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.replace(`/trips/${id}${query}`, { scroll: false });
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function fetchTrip() {
    const cacheKey = `travel_trip_${id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) setTrip(JSON.parse(cached));
    const res = await fetchWithAuth("/api/sheets");
    if (res.ok) {
      const data = await res.json();
      const found = data.trips.find((t: Trip) => t.id === id) ?? null;
      setTrip(found);
      if (found) localStorage.setItem(cacheKey, JSON.stringify(found));
    }
  }

  async function fetchSegments() {
    const cacheKey = `travel_segments_${id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setSegments(JSON.parse(cached));
      setSegmentsLoading(false);
    } else {
      setSegmentsLoading(true);
    }
    const res = await fetchWithAuth(`/api/segments?tripId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setSegments(data.segments);
      localStorage.setItem(cacheKey, JSON.stringify(data.segments));
    }
    setSegmentsLoading(false);
  }

  useEffect(() => {
    const tripCached = localStorage.getItem(`travel_trip_${id}`);
    if (tripCached) setLoading(false);
    Promise.all([
      fetchTrip(),
      fetchSegments(),
      fetchMembers(),
      fetchWithAuth("/api/auth/status").then((r) => r.json()).then((d) => setUserId(d.userId)),
    ]).finally(() => setLoading(false));
  }, [id]);

  async function fetchMembers() {
    const res = await fetchWithAuth(`/api/trips/${id}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await fetchWithAuth("/api/sheets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.push("/");
  }

  async function handleDeleteSegment(segId: string) {
    await fetchWithAuth("/api/segments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: segId }),
    });
    fetchSegments();
  }

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetchWithAuth(`/api/trips/${id}/share`);
      if (res.ok) {
        const { shareUrl } = await res.json();
        const urlWithTab = `${shareUrl}?tab=${activeTab}`;
        await navigator.clipboard.writeText(urlWithTab);
        messageApi.success(`分享連結已複製: ${urlWithTab}`);
        setShowMoreSheet(false);
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    await fetchWithAuth(`/api/trips/${id}/leave`, { method: "DELETE" });
    router.push("/");
  }

  async function handleRemoveMember(targetUserId: string) {
    setRemovingMemberId(targetUserId);
    await fetchWithAuth(`/api/trips/${id}/members?userId=${targetUserId}`, { method: "DELETE" });
    await fetchMembers();
    setRemovingMemberId(null);
  }

  async function handleInvite() {
    setInviting(true);
    try {
      const res = await fetchWithAuth(`/api/trips/${id}/invite`);
      if (res.ok) {
        const { inviteUrl } = await res.json();
        await navigator.clipboard.writeText(inviteUrl);
        messageApi.success(`邀請連結已複製: ${inviteUrl}`);
        setShowMoreSheet(false);
      }
    } finally {
      setInviting(false);
    }
  }

  const isOwner = !!(trip && userId && trip.user_id === userId);
  const isMember = !isOwner && members.some(m => m.user_id === userId);

  function memberAvatarColor(uid: string) {
    const palette = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <header className="backdrop-blur-md flex items-center gap-3 px-3 md:px-5 h-14 sticky top-0 z-[100] border-b border-white/[0.06]">
          <Skeleton.Button active size="small" className="!w-8 !h-8 !rounded-full" />
          <Skeleton.Input active size="small" className="!w-32 !h-5 !rounded-full" />
        </header>
        <div className="max-w-[720px] mx-auto py-8 px-6 w-full">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl px-7 pt-7 pb-6 mb-7">
            <Skeleton active title={{ width: "55%", style: { marginBottom: 20, height: 28 } }} paragraph={{ rows: 1, width: "75%" }} />
          </div>
          <div className="mb-4 flex justify-between items-center">
            <Skeleton.Input active size="small" className="!w-[72px] rounded-md" />
            <Skeleton.Button active size="small" className="!w-20 rounded-md" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-4 py-[14px] mb-3">
              <Skeleton active avatar={{ size: 24, shape: "circle" }} title={{ width: "50%", style: { marginBottom: 8 } }} paragraph={{ rows: 1, width: "35%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const duration =
    trip?.start_date && trip?.end_date
      ? Math.round(
        (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
      )
      : null;

  if (!trip) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <Typography.Text className="text-zinc-500">找不到這筆旅程</Typography.Text>
        <Button onClick={() => router.push("/")}>返回首頁</Button>
      </div>
    );
  }

  const countries = trip.countries
    ? trip.countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
    : [];

  const accent = getDestinationAccent(trip.countries ?? "");
  const people = trip.people ?? [];
  const currencies = trip.currency ? trip.currency.split(",") : ["TWD"];
  const primaryCurrency = currencies[0];

  const timelineItems = segments.map((seg) => ({
    key: seg.id,
    color: "blue",
    content: (
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-4 py-[14px] mb-1">
        {/* Row 1: icon + meta pills + menu */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <VehicleIconChip type={seg.type} />
            {seg.flight_no && (
              <span className="text-[12px] text-zinc-500 bg-white/[0.04] border border-white/[0.07] rounded-md px-2 py-0.5">{seg.flight_no}</span>
            )}
            {seg.aircraft && (
              <span className="text-[12px] text-zinc-500 bg-white/[0.04] border border-white/[0.07] rounded-md px-2 py-0.5">{seg.aircraft}</span>
            )}
          </div>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "edit", icon: <EditOutlined />, label: "編輯", onClick: () => setEditingSegment(seg) },
                { type: "divider" },
                {
                  key: "delete", icon: <DeleteOutlined />, label: "刪除", danger: true,
                  onClick: () => modal.confirm({
                    title: "確定刪除這段交通？",
                    okText: "刪除", okType: "danger", cancelText: "取消",
                    onOk: () => handleDeleteSegment(seg.id),
                  }),
                },
              ],
            }}
          >
            <button className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300 transition-colors cursor-pointer shrink-0">
              <MoreOutlined />
            </button>
          </Dropdown>
        </div>

        {/* Row 2: 出發 / 抵達 labels */}
        <div className="flex justify-between mb-1">
          <div className="text-[10px] text-blue-400 font-medium">出發</div>
          <div className="text-[10px] text-violet-400 font-medium">抵達</div>
        </div>

        {/* Row 3: cities + dashed connecting line (IATA inline) */}
        <div className="flex items-center mb-2">
          <div className="flex-shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[17px] font-bold text-zinc-100 leading-tight">{seg.from_city}</span>
              {seg.from_iata && <span className="text-[11px] text-zinc-600 tracking-wider">{seg.from_iata}</span>}
            </div>
          </div>
          <div className="flex-1 flex items-center px-2">
            <div className="flex-1 border-t border-dashed border-white/10" />
            <span className="px-1.5 text-zinc-700 text-[12px]">{seg.type === "飛機" ? "✈" : "→"}</span>
            <div className="flex-1 border-t border-dashed border-white/10" />
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="flex items-baseline gap-1.5 justify-end">
              {seg.to_iata && <span className="text-[11px] text-zinc-600 tracking-wider">{seg.to_iata}</span>}
              <span className="text-[17px] font-bold text-zinc-100 leading-tight">{seg.to_city}</span>
            </div>
          </div>
        </div>

        {/* Row 4: times (taiwan time inline) */}
        <div className="flex justify-between items-start">
          <div>
            {seg.time ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {seg.date && <span className="text-[12px] text-zinc-500">{dayjs(seg.date).format("M/D")}</span>}
                <span className="text-[20px] font-bold text-zinc-200 leading-tight">{seg.time}</span>
                {seg.from_iata && (() => {
                  const twTime = toTaiwanTime(seg.date, seg.time, seg.from_iata);
                  return twTime ? <span className="text-[11px] text-zinc-600">台灣 {twTime}</span> : null;
                })()}
              </div>
            ) : (
              <div className="text-[20px] font-light text-zinc-700 leading-tight">—</div>
            )}
          </div>
          <div className="text-right">
            {seg.arrival_time ? (
              <div className="flex items-baseline gap-1.5 justify-end flex-wrap">
                {seg.to_iata && (() => {
                  const twTime = toTaiwanTime(seg.arrival_date || seg.date, seg.arrival_time, seg.to_iata);
                  return twTime ? <span className="text-[11px] text-zinc-600">台灣 {twTime}</span> : null;
                })()}
                <span className="text-[20px] font-bold text-zinc-200 leading-tight">{seg.arrival_time}</span>
                {(seg.arrival_date || seg.date) && (
                  <span className="text-[12px] text-zinc-500">
                    {seg.arrival_date ? dayjs(seg.arrival_date).format("M/D") : dayjs(seg.date).format("M/D")}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-[20px] font-light text-zinc-700 leading-tight">—</div>
            )}
          </div>
        </div>
      </div>
    ),
  }));

  const transportContent = (
    <>
      <div className="my-3 flex items-center justify-between">
        <Typography.Text strong className="text-zinc-100 text-[15px]">交通段落</Typography.Text>
        <button
          onClick={() => setShowAddSegment(true)}
          className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
        >
          <PlusIcon size={12} />
          新增段落
        </button>
      </div>

      {segmentsLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-4 py-[14px]">
              <Skeleton active avatar={{ shape: "circle" }} title={{ width: "60%" }} paragraph={{ rows: 1, width: "30%" }} />
            </div>
          ))}
        </div>
      ) : segments.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-12 pb-10 rounded-2xl border border-white/[0.06]"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.06) 0%, transparent 65%), rgba(9,9,11,0.6)' }}
        >
          <div
            className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.18)' }}
          >
            <PlaneIcon size={26} stroke="#3b82f6" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Typography.Text className="text-zinc-300 text-sm font-medium">還沒有交通記錄</Typography.Text>
            <Typography.Text className="text-zinc-600 text-xs">記錄每一段旅程，不錯過任何細節。</Typography.Text>
          </div>
          <button
            onClick={() => setShowAddSegment(true)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <PlusIcon size={12} />
            新增第一段
          </button>
        </div>
      ) : (
        <Timeline items={timelineItems} />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#09090b]">
      <header className="backdrop-blur-md flex backdrop-blur-md items-center gap-2 px-3 md:px-5 h-16 sticky top-0 z-[100] border-b border-white/[0.06]">
        {/* Back */}
        <button
          onClick={() => router.push("/")}
          className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 flex items-center justify-center transition-all duration-200 shrink-0"
        >
          <ChevronLeftIcon size={14} />
        </button>

        {/* Trip name */}
        <span className="flex-1 text-zinc-400 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">
          {trip.name}
        </span>

        {/* Action buttons */}
        {isMobile ? (
          <button
            onClick={() => setShowMoreSheet(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
          >
            <MoreVerticalIcon size={16} strokeWidth={2.5} />
          </button>
        ) : (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleShare}
              disabled={sharing}
              title="分享旅程"
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 disabled:opacity-40 cursor-pointer"
            >
              {sharing ? <LoadingOutlined size={13} /> : <ShareIcon size={13} />}
              分享
            </button>

            {isOwner && (
              <button
                onClick={handleInvite}
                disabled={inviting}
                title="邀請夥伴共同編輯"
                className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 disabled:opacity-40 cursor-pointer"
              >
                {inviting ? <LoadingOutlined size={13} /> : <UserPlusIcon size={13} />}
                邀請
              </button>
            )}

            <button
              onClick={() => setShowLineBotModal(true)}
              title="LINE Bot 記帳"
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            >
              <LineBotIcon size={13} />
              LINE Bot
            </button>

            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            >
              <EditIcon size={13} />
              編輯
            </button>

            {isOwner && (
              <Popconfirm title="確定要刪除這筆旅程嗎？" onConfirm={handleDelete} okText="刪除" cancelText="取消" okButtonProps={{ danger: true, loading: deleting }}>
                <button className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 cursor-pointer">
                  <TrashIcon size={13} />
                  刪除
                </button>
              </Popconfirm>
            )}

            {isMember && (
              <Popconfirm title="確定要離開此旅程嗎？" onConfirm={handleLeave} okText="離開" cancelText="取消" okButtonProps={{ danger: true, loading: leaving }}>
                <button className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 cursor-pointer">
                  <TrashIcon size={13} />
                  離開旅程
                </button>
              </Popconfirm>
            )}
          </div>
        )}
      </header>

      <div
        className="md:max-w-[80%] mx-auto w-full"
        style={{ padding: isMobile ? "20px 12px 100px" : "32px 24px 80px" }}
      >
        <div
          className="rounded-4xl md:mb-8 mb-4 overflow-hidden relative shadow-2xl border border-white/6"
          style={{
            padding: isMobile ? "24px 20px" : "32px 32px",
            background: `linear-gradient(145deg, ${accent.from}17 0%, rgba(139,92,246,0.05) 60%, rgba(9,9,11,0.98) 100%)`,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 85% 0%, ${accent.from}22 0%, transparent 55%)` }}
          />

          <div className="relative">
            <Typography.Title
              level={isMobile ? 3 : 2}
              className="!text-zinc-100 !m-0 !mb-5 !leading-tight !font-black tracking-tight"
            >
              {trip.name}
            </Typography.Title>

            <div className="flex flex-wrap gap-2.5 items-center">
              {trip.start_date && trip.end_date && (
                <span
                  className="rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5"
                  style={{
                    background: `${accent.from}17`,
                    border: `1px solid ${accent.from}33`,
                    color: accent.from,
                    boxShadow: `0 0 15px ${accent.from}1a`,
                  }}
                >
                  <CalendarIcon size={11} />
                  {trip.start_date} → {trip.end_date}
                </span>
              )}
              {duration !== null && (
                <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 rounded-full px-3.5 py-1 text-[13px] font-medium">
                  {duration} 天
                </span>
              )}
              {countries.map((c) => (
                <span
                  key={c}
                  className="rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5"
                  style={{
                    background: `${accent.from}12`,
                    border: `1px solid ${accent.from}28`,
                    color: accent.from,
                    boxShadow: `0 0 15px ${accent.from}15`,
                  }}
                >
                  <LocationIcon size={11} />
                  {c}
                </span>
              ))}
              {people.length > 0 && (
                <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5">
                  <UsersIcon size={11} />
                  {people.join("、")}
                </span>
              )}
            </div>

            {members.length > 0 && (
              <div className="flex items-center gap-2.5 mt-4">
                <div className="flex items-center">
                  {members.map((m, i) => {
                    const canRemove = isOwner && !m.is_owner;
                    const isRemoving = removingMemberId === m.user_id;
                    const avatar = m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.name} className="w-7 h-7 rounded-full border-2 border-zinc-900 object-cover" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full border-2 border-zinc-900 flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ background: memberAvatarColor(m.user_id) }}
                      >
                        {isRemoving ? <LoadingOutlined style={{ fontSize: 11 }} /> : m.name.charAt(0).toUpperCase()}
                      </div>
                    );
                    return canRemove ? (
                      <Popconfirm
                        key={m.user_id}
                        title={`移除「${m.name}」？`}
                        description="該成員將無法再存取此行程"
                        okText="移除"
                        cancelText="取消"
                        okButtonProps={{ danger: true, loading: isRemoving }}
                        onConfirm={() => handleRemoveMember(m.user_id)}
                      >
                        <Tooltip title={m.name}>
                          <div className="relative cursor-pointer hover:opacity-75 transition-opacity" style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
                            {avatar}
                          </div>
                        </Tooltip>
                      </Popconfirm>
                    ) : (
                      <Tooltip key={m.user_id} title={`${m.name}${m.is_owner ? " (owner)" : ""}`}>
                        <div className="relative cursor-default" style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
                          {avatar}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
                <span className="text-zinc-600 text-[12px]">共同編輯</span>
              </div>
            )}

            {trip.notes && (
              <div className="bg-white/5 rounded-2xl p-5 mt-6 text-zinc-300 text-[14px] leading-relaxed border border-white/5 shadow-inner overflow-hidden">
                <div
                  className="notes-content"
                  dangerouslySetInnerHTML={{ __html: trip.notes }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mb-7">
          {!isMobile && (
            <div className="flex items-center justify-center mb-8 sticky top-[80px] z-50">
              <div className="flex bg-[#18181b]/80 border border-white/8 backdrop-blur-md rounded-full p-1.5 shadow-xl">
                {[
                  { key: "transport", label: "路線", icon: <PlaneIcon size={18} /> },
                  { key: "itinerary", label: "行程", icon: <CalendarIcon size={18} /> },
                  { key: "expenses", label: "費用", icon: <CreditCardIcon size={18} /> },
                  { key: "photos", label: "照片", icon: <PhotoIcon size={18} /> },
                  { key: "notes", label: "筆記", icon: <NotepadIcon size={18} /> },
                  { key: "souvenirs", label: "伴手禮", icon: <GiftIcon size={18} /> },
                ]
                  .filter(tab => !trip.enabled_tabs || trip.enabled_tabs.includes(tab.key))
                  .sort((a, b) => {
                    if (!trip.enabled_tabs) return 0;
                    return trip.enabled_tabs.indexOf(a.key) - trip.enabled_tabs.indexOf(b.key);
                  })
                  .map((tab) => (
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
          )}
          <div style={{ overflow: 'clip' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: tabDirection * 36 }}
                animate={{ opacity: 1, x: 0, transitionEnd: { transform: "none" } }}
                exit={{ opacity: 0, x: tabDirection * -24 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {activeTab === "transport" && (
                  <>
                    {transportContent}
                    <div className="mt-7">
                      <div className="mb-3 flex items-center justify-between">
                        <Typography.Text strong className="text-zinc-100 text-[15px]">旅程地圖</Typography.Text>
                      </div>
                      <TripMap tripId={id} />
                    </div>
                  </>
                )}
                {activeTab === "itinerary" && <ItineraryTab tripId={id} isActive destination={trip.countries} />}
                {activeTab === "notes" && <NotesTab tripId={id} />}
                {activeTab === "souvenirs" && <SouvenirsTab tripId={id} />}
                {activeTab === "expenses" && <ExpensesTab tripId={id} people={people} currency={primaryCurrency} currencies={currencies} />}
                {activeTab === "photos" && (
                  trip.photo_album_id ? (
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
                        <div className="text-zinc-500 text-xs px-10">編輯旅程並貼上 Google 相簿分享連結，<br />即可在此直接瀏覽精彩回憶。</div>
                      </div>
                      <button
                        onClick={() => setShowEdit(true)}
                        className="mt-2 inline-flex items-center gap-2 px-4 h-9 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300 text-sm hover:bg-white/10 transition-all cursor-pointer"
                      >
                        <EditIcon size={14} />
                        立即設定
                      </button>
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-[400]"
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
          <div className="flex justify-around items-center pt-2 px-1">
            {[
              { value: "transport", icon: <PlaneIcon size={20} />, label: "路線" },
              { value: "itinerary", icon: <CalendarIcon size={20} />, label: "行程" },
              { value: "expenses", icon: <CreditCardIcon size={20} />, label: "費用" },
              { value: "photos", icon: <PhotoIcon size={20} />, label: "照片" },
              { value: "notes", icon: <NotepadIcon size={20} />, label: "筆記" },
              { value: "souvenirs", icon: <GiftIcon size={20} />, label: "伴手禮" },
            ]
              .filter(tab => !trip.enabled_tabs || trip.enabled_tabs.includes(tab.value))
              .sort((a, b) => {
                if (!trip.enabled_tabs) return 0;
                return trip.enabled_tabs.indexOf(a.value) - trip.enabled_tabs.indexOf(b.value);
              })
              .map(({ value, icon, label }) => {
                const isActive = activeTab === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      handleTabChange(value);
                      if (value !== 'itinerary') {
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }
                    }}
                    className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-200 cursor-pointer"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                      style={isActive ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' } : { color: '#52525b' }}
                    >
                      {icon}
                    </div>
                    <span
                      className="text-[10px] font-medium transition-all duration-200"
                      style={{ color: isActive ? '#a78bfa' : '#52525b' }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
          </div>
        </nav>
      )}

      {/* Mobile More Actions Bottom Sheet */}
      <div
        className="fixed inset-0 z-[210] transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: showMoreSheet ? 1 : 0,
          pointerEvents: showMoreSheet ? "auto" : "none",
        }}
        onClick={() => setShowMoreSheet(false)}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-401 rounded-t-[24px] transition-transform duration-300 ease-out"
        style={{
          background: "#1c1c1f",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 -16px 40px rgba(0,0,0,0.5)",
          transform: showMoreSheet ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div className="px-4 pt-1 pb-2">
          <div className="text-zinc-600 text-[11px] font-medium px-1 mb-3 mt-1 truncate">{trip.name}</div>

          <div className="space-y-0.5">
            {/* Share */}
            <button
              onClick={() => { handleShare(); }}
              disabled={sharing}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-40 text-left"
            >
              <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.15)" }}>
                {sharing ? <LoadingOutlined style={{ color: "#818cf8", fontSize: 16 }} /> : <ShareIcon size={16} stroke="#818cf8" />}
              </div>
              <div>
                <div className="text-zinc-100 text-[14px] font-medium">分享旅程</div>
                <div className="text-zinc-500 text-[11px] mt-0.5">複製公開連結</div>
              </div>
            </button>

            {/* Invite (owner only) */}
            {isOwner && (
              <button
                onClick={() => { handleInvite(); }}
                disabled={inviting}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-40 text-left"
              >
                <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(20,184,166,0.15)" }}>
                  {inviting ? <LoadingOutlined style={{ color: "#2dd4bf", fontSize: 16 }} /> : <UserPlusIcon size={16} stroke="#2dd4bf" />}
                </div>
                <div>
                  <div className="text-zinc-100 text-[14px] font-medium">邀請夥伴</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">複製邀請連結共同編輯</div>
                </div>
              </button>
            )}

            {/* LINE Bot */}
            <button
              onClick={() => { setShowMoreSheet(false); setShowLineBotModal(true); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(6,199,85,0.12)" }}>
                <LineBotIcon size={16} stroke="#06C755" />
              </div>
              <div>
                <div className="text-zinc-100 text-[14px] font-medium">LINE Bot 記帳</div>
                <div className="text-zinc-500 text-[11px] mt-0.5">連結此行程到 LINE 群組</div>
              </div>
            </button>

            {/* Edit */}
            <button
              onClick={() => { setShowMoreSheet(false); setShowEdit(true); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}>
                <EditIcon size={16} stroke="#a1a1aa" />
              </div>
              <div>
                <div className="text-zinc-100 text-[14px] font-medium">編輯旅程</div>
                <div className="text-zinc-500 text-[11px] mt-0.5">修改名稱、日期、目的地</div>
              </div>
            </button>

            {isOwner && (
              <>
                <div className="mx-1 my-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                <button
                  onClick={() => {
                    setShowMoreSheet(false);
                    modal.confirm({
                      title: "確定要刪除這筆旅程嗎？",
                      okText: "刪除", okType: "danger", cancelText: "取消",
                      okButtonProps: { danger: true, loading: deleting },
                      onOk: handleDelete,
                    });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-red-500/[0.08] active:bg-red-500/[0.12] transition-colors cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                    <TrashIcon size={16} stroke="#f87171" />
                  </div>
                  <div>
                    <div className="text-red-400 text-[14px] font-medium">刪除旅程</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "rgba(239,68,68,0.5)" }}>此操作無法復原</div>
                  </div>
                </button>
              </>
            )}

            {isMember && (
              <>
                <div className="mx-1 my-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                <button
                  onClick={() => {
                    setShowMoreSheet(false);
                    modal.confirm({
                      title: "確定要離開此旅程嗎？",
                      okText: "離開", okType: "danger", cancelText: "取消",
                      okButtonProps: { danger: true, loading: leaving },
                      onOk: handleLeave,
                    });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-red-500/[0.08] active:bg-red-500/[0.12] transition-colors cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                    <TrashIcon size={16} stroke="#f87171" />
                  </div>
                  <div>
                    <div className="text-red-400 text-[14px] font-medium">離開旅程</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "rgba(239,68,68,0.5)" }}>離開後需重新接受邀請</div>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <EditTripModal trip={trip} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); fetchTrip(); }} />
      )}
      <LineBotTripModal
        open={showLineBotModal}
        tripId={id}
        tripName={trip.name}
        onClose={() => setShowLineBotModal(false)}
      />
      {showAddSegment && (
        <AddSegmentModal
          tripId={id}
          nextOrder={segments.length + 1}
          onClose={() => setShowAddSegment(false)}
          onSaved={() => { setShowAddSegment(false); fetchSegments(); }}
        />
      )}
      {editingSegment && (
        <EditSegmentModal
          segment={editingSegment}
          onClose={() => setEditingSegment(null)}
          onSaved={() => { setEditingSegment(null); fetchSegments(); }}
        />
      )}
    </div>
  );
}
