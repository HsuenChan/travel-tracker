"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Button, Typography,
  Skeleton, Popconfirm, Space, Tag, Timeline, message, Segmented, Modal, Dropdown, Tooltip,
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
const TripMap = dynamic(() => import("@/app/components/TripMap"), { ssr: false });
import VehicleIconChip from "@/app/components/VehicleIconChip";
import {
  PlaneIcon, PlusIcon, CalendarIcon, LocationIcon, UsersIcon,
  CreditCardIcon, PhotoIcon, ShareIcon, UserPlusIcon, EditIcon, TrashIcon, ChevronLeftIcon, NotepadIcon,
} from "@/app/components/Icons";

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
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState("transport");
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["transport"]));

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
        await navigator.clipboard.writeText(shareUrl);
        messageApi.success(`分享連結已複製: ${shareUrl}`);
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleInvite() {
    setInviting(true);
    try {
      const res = await fetchWithAuth(`/api/trips/${id}/invite`);
      if (res.ok) {
        const { inviteUrl } = await res.json();
        await navigator.clipboard.writeText(inviteUrl);
        messageApi.success(`邀請連結已複製: ${inviteUrl}`);
      }
    } finally {
      setInviting(false);
    }
  }

  const isOwner = !!(trip && userId && trip.user_id === userId);

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

  const people = trip.people ?? [];
  const currencies = trip.currency ? trip.currency.split(",") : ["TWD"];
  const primaryCurrency = currencies[0];

  const timelineItems = segments.map((seg) => ({
    key: seg.id,
    color: "blue",
    content: (
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-4 py-[14px] mb-1">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
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
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "edit", icon: <EditOutlined />, label: "編輯", onClick: () => setEditingSegment(seg) },
                { type: "divider" },
                {
                  key: "delete", icon: <DeleteOutlined />, label: "刪除", danger: true,
                  onClick: () => Modal.confirm({
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
        <Space wrap size={4} className="pl-8">
          {seg.date && (
            <Tag color="geekblue" className="rounded-md">
              {seg.date}{seg.time && <span className="opacity-75"> {seg.time}</span>}
            </Tag>
          )}
          {seg.flight_no && <Tag color="purple" className="rounded-md">{seg.flight_no}</Tag>}
          {seg.aircraft && <Tag color="cyan" className="rounded-md">{seg.aircraft}</Tag>}
        </Space>
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
        <div className="flex flex-col items-center gap-2.5 py-10 pb-8 bg-[#111113] border border-dashed border-[#27272a] rounded-xl">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/[0.07] flex items-center justify-center">
            <PlaneIcon size={22} stroke="#3f3f46" strokeWidth={1.5} />
          </div>
          <Typography.Text className="text-zinc-600 text-sm">還沒有交通記錄</Typography.Text>
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
      {contextHolder}
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
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleShare}
            disabled={sharing}
            title="分享旅程"
            className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 disabled:opacity-40 cursor-pointer"
          >
            {sharing ? <LoadingOutlined size={13} /> : <ShareIcon size={13} />}
            {!isMobile && "分享"}
          </button>

          {isOwner && (
            <button
              onClick={handleInvite}
              disabled={inviting}
              title="邀請夥伴共同編輯"
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 disabled:opacity-40 cursor-pointer"
            >
              {inviting ? <LoadingOutlined size={13} /> : <UserPlusIcon size={13} />}
              {!isMobile && "邀請"}
            </button>
          )}

          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
          >
            <EditIcon size={13} />
            {!isMobile && "編輯"}
          </button>

          {isOwner && (
            <Popconfirm title="確定要刪除這筆旅程嗎？" onConfirm={handleDelete} okText="刪除" cancelText="取消" okButtonProps={{ danger: true, loading: deleting }}>
              <button className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 cursor-pointer">
                <TrashIcon size={13} />
                {!isMobile && "刪除"}
              </button>
            </Popconfirm>
          )}
        </div>
      </header>

      <div
        className="max-w-[720px] mx-auto w-full"
        style={{ padding: isMobile ? "20px 12px 60px" : "32px 24px 80px" }}
      >
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] mb-8 overflow-hidden relative shadow-2xl"
          style={{ padding: isMobile ? "24px 20px" : "32px 32px" }}
        >
          {/* 背景裝飾光點 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b5cf6]/5 blur-3xl -mr-16 -mt-16"></div>

          <div className="relative">
            <Typography.Title
              level={isMobile ? 3 : 2}
              className="!text-zinc-100 !m-0 !mb-5 !leading-tight !font-black tracking-tight"
            >
              {trip.name}
            </Typography.Title>

            <div className="flex flex-wrap gap-2.5 items-center">
              {trip.start_date && trip.end_date && (
                <span className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#a78bfa] rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
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
                <span key={c} className="bg-teal-400/10 border border-teal-400/20 text-teal-300 rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5 shadow-[0_0_15px_rgba(45,212,191,0.1)]">
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
                  {members.map((m, i) => (
                    <Tooltip key={m.user_id} title={`${m.name}${m.is_owner ? " (owner)" : ""}`}>
                      <div className="relative cursor-default" style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
                        {m.avatar_url ? (
                          <img
                            src={m.avatar_url}
                            alt={m.name}
                            className="w-7 h-7 rounded-full border-2 border-zinc-900 object-cover"
                          />
                        ) : (
                          <div
                            className="w-7 h-7 rounded-full border-2 border-zinc-900 flex items-center justify-center text-white text-[11px] font-bold"
                            style={{ background: memberAvatarColor(m.user_id) }}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </Tooltip>
                  ))}
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
          <Segmented
            block
            className="cute-segmented mb-6"
            value={activeTab}
            onChange={(v) => {
              const val = v as string;
              setActiveTab(val);
              setVisitedTabs((prev) => new Set([...prev, val]));
            }}
            options={[
              { value: "transport", label: <span className="inline-flex items-center gap-[5px]"><PlaneIcon size={13} />路線</span> },
              { value: "itinerary", label: <span className="inline-flex items-center gap-[5px]"><CalendarIcon size={13} />行程</span> },
              { value: "notes", label: <span className="inline-flex items-center gap-[5px]"><NotepadIcon size={13} />筆記</span> },
              { value: "expenses", label: <span className="inline-flex items-center gap-[5px]"><CreditCardIcon size={13} />費用</span> },
              ...(trip.photo_album_id ? [{ value: "photos", label: <span className="inline-flex items-center gap-[5px]"><PhotoIcon size={13} />照片</span> }] : []),
            ]}
          />
          <div style={{ display: activeTab === "transport" ? "block" : "none" }}>
            {transportContent}
            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <Typography.Text strong className="text-zinc-100 text-[15px]">旅程地圖</Typography.Text>
              </div>
              <TripMap tripId={id} />
            </div>
          </div>
          {visitedTabs.has("itinerary") && (
            <div style={{ display: activeTab === "itinerary" ? "block" : "none" }}><ItineraryTab tripId={id} /></div>
          )}
          {visitedTabs.has("notes") && (
            <div style={{ display: activeTab === "notes" ? "block" : "none" }}><NotesTab tripId={id} /></div>
          )}
          {visitedTabs.has("expenses") && (
            <div style={{ display: activeTab === "expenses" ? "block" : "none" }}><ExpensesTab tripId={id} people={people} currency={primaryCurrency} currencies={currencies} /></div>
          )}
          {trip.photo_album_id && visitedTabs.has("photos") && (
            <div style={{ display: activeTab === "photos" ? "block" : "none" }}><PhotoWall albumUrl={trip.photo_album_id} /></div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditTripModal trip={trip} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); fetchTrip(); }} />
      )}
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
