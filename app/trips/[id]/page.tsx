"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Layout, Button, Typography,
  Skeleton, Popconfirm, Space, Tag, Timeline, message, Tabs,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined,
  PlusOutlined, FormOutlined, ShareAltOutlined, UserAddOutlined,
} from "@ant-design/icons";
import EditTripModal from "@/app/components/EditTripModal";
import AddSegmentModal from "@/app/components/AddSegmentModal";
import EditSegmentModal from "@/app/components/EditSegmentModal";
import PhotoWall from "@/app/components/PhotoWall";
import ItineraryTab from "@/app/components/ItineraryTab";
import ExpensesTab from "@/app/components/ExpensesTab";
import { toTransportKey, VEHICLE_ICON } from "@/lib/transport";

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
  const [sharing, setSharing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function fetchTrip() {
    const res = await fetch("/api/sheets");
    if (res.ok) {
      const data = await res.json();
      setTrip(data.trips.find((t: Trip) => t.id === id) ?? null);
    }
  }

  async function fetchSegments() {
    setSegmentsLoading(true);
    const res = await fetch(`/api/segments?tripId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setSegments(data.segments);
    }
    setSegmentsLoading(false);
  }

  useEffect(() => {
    Promise.all([
      fetchTrip(),
      fetchSegments(),
      fetch("/api/auth/status").then((r) => r.json()).then((d) => setUserId(d.userId)),
    ]).finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    await fetch("/api/sheets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.push("/");
  }

  async function handleDeleteSegment(segId: string) {
    await fetch("/api/segments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: segId }),
    });
    fetchSegments();
  }

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch(`/api/trips/${id}/share`);
      if (res.ok) {
        const { shareUrl } = await res.json();
        await navigator.clipboard.writeText(shareUrl);
        messageApi.success("分享連結已複製到剪貼簿");
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleInvite() {
    setInviting(true);
    try {
      const res = await fetch(`/api/trips/${id}/invite`);
      if (res.ok) {
        const { inviteUrl } = await res.json();
        await navigator.clipboard.writeText(inviteUrl);
        messageApi.success("邀請連結已複製，傳給旅伴登入後即可加入");
      }
    } finally {
      setInviting(false);
    }
  }

  const isOwner = !!(trip && userId && trip.user_id === userId);

  if (loading) {
    return (
      <Layout className="min-h-screen bg-[#09090b]">
        <Layout.Header className="flex items-center gap-10 border-b border-[#27272a] !px-4 bg-[rgba(9,9,11,0.85)] !h-14 !leading-[56px]">
          <Skeleton.Button active size="small" className="!w-4 !h-6" />
          <Skeleton.Input active size="small" className="!w-32 !h-6 rounded-md" />
        </Layout.Header>
        <Layout.Content className="max-w-[720px] mx-auto py-8 px-6 w-full">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl px-7 pt-7 pb-6 mb-7">
            <Skeleton active title={{ width: "55%", style: { marginBottom: 20, height: 28 } }} paragraph={{ rows: 1, width: "75%" }} />
          </div>
          <div className="mb-4 flex justify-between items-center">
            <Skeleton.Input active size="small" className="!w-[72px] rounded-md" />
            <Skeleton.Button active size="small" className="!w-20 rounded-md" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-4 py-[14px] mb-3">
              <Skeleton active avatar={{ size: 24, shape: "circle" }} title={{ width: "50%", style: { marginBottom: 8 } }} paragraph={{ rows: 1, width: "35%" }} />
            </div>
          ))}
        </Layout.Content>
      </Layout>
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
      <div className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-4 py-[14px] mb-1">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-[22px] shrink-0 leading-none">{VEHICLE_ICON[toTransportKey(seg.type)]}</span>
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
          <Space size={2} className="shrink-0">
            <Button type="text" size="small" icon={<FormOutlined />} onClick={() => setEditingSegment(seg)} />
            <Popconfirm
              title="確定刪除這段交通？"
              onConfirm={() => handleDeleteSegment(seg.id)}
              okText="刪除" cancelText="取消" okButtonProps={{ danger: true }}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
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
      <div className="mb-4 flex items-center justify-between">
        <Typography.Text strong className="text-zinc-100 text-[15px]">交通段落</Typography.Text>
        <Button icon={<PlusOutlined />} size="small" onClick={() => setShowAddSegment(true)}>新增段落</Button>
      </div>

      {segmentsLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-4 py-[14px]">
              <Skeleton active avatar={{ shape: "circle" }} title={{ width: "60%" }} paragraph={{ rows: 1, width: "30%" }} />
            </div>
          ))}
        </div>
      ) : segments.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-10 pb-8 bg-[#111113] border border-dashed border-[#27272a] rounded-xl">
          <span className="text-4xl">✈️</span>
          <Typography.Text className="text-zinc-600 text-sm">還沒有交通記錄</Typography.Text>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setShowAddSegment(true)} className="mt-1">
            新增第一段
          </Button>
        </div>
      ) : (
        <Timeline items={timelineItems} />
      )}
    </>
  );

  return (
    <Layout className="min-h-screen bg-[#09090b]">
      {contextHolder}
      <Layout.Header
        className="flex items-center gap-2 border-b border-[#27272a] bg-[rgba(9,9,11,0.85)] backdrop-blur-xl sticky top-0 z-[100] !h-14 !leading-[56px]"
        style={{ paddingLeft: isMobile ? 8 : 16, paddingRight: isMobile ? 8 : 16 }}
      >
        <Button icon={<ArrowLeftOutlined />} type="text" className="!text-zinc-400 shrink-0" onClick={() => router.push("/")} />
        <Typography.Text className="text-zinc-500 text-[13px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {trip.name}
        </Typography.Text>
        <Space size={4}>
          <Button icon={<ShareAltOutlined />} size="small" onClick={handleShare} loading={sharing} disabled={sharing} title="分享旅程">
            {!isMobile && "分享"}
          </Button>
          {isOwner && (
            <Button icon={<UserAddOutlined />} size="small" onClick={handleInvite} loading={inviting} disabled={inviting} title="邀請夥伴共同編輯">
              {!isMobile && "邀請"}
            </Button>
          )}
          <Button icon={<EditOutlined />} size="small" onClick={() => setShowEdit(true)}>
            {!isMobile && "編輯"}
          </Button>
          {isOwner && (
            <Popconfirm title="確定要刪除這筆旅程嗎？" onConfirm={handleDelete} okText="刪除" cancelText="取消" okButtonProps={{ danger: true, loading: deleting }}>
              <Button danger icon={<DeleteOutlined />} size="small">
                {!isMobile && "刪除"}
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Layout.Header>

      <Layout.Content
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
                  <span className="opacity-60 text-sm">🗓️</span> {trip.start_date} → {trip.end_date}
                </span>
              )}
              {duration !== null && (
                <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 rounded-full px-3.5 py-1 text-[13px] font-medium">
                   {duration} 天
                </span>
              )}
              {countries.map((c) => (
                <span key={c} className="bg-teal-400/10 border border-teal-400/20 text-teal-300 rounded-full px-3.5 py-1 text-[13px] font-medium shadow-[0_0_15px_rgba(45,212,191,0.1)]">
                  📍 {c}
                </span>
              ))}
              {people.length > 0 && (
                <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 rounded-full px-3.5 py-1 text-[13px] font-medium">
                  👥 {people.join("、")}
                </span>
              )}
              {currencies.map((curr) => (
                <span key={curr} className="bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-full px-3.5 py-1 text-[13px] font-medium">
                  💰 {curr}
                </span>
              ))}
            </div>

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

        <Tabs
          defaultActiveKey="transport"
          className="cute-tabs mb-7"
          items={[
            { key: "transport", label: "✈️ 交通", children: transportContent },
            { key: "itinerary", label: "🗓️ 行程", children: <ItineraryTab tripId={id} /> },
            {
              key: "expenses",
              label: "💸 費用",
              children: <ExpensesTab tripId={id} people={people} currency={primaryCurrency} />,
            },
            ...(trip.photo_album_id ? [{
              key: "photos",
              label: "📷 照片",
              children: <PhotoWall albumUrl={trip.photo_album_id} />,
            }] : []),
          ]}
        />
      </Layout.Content>

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
    </Layout>
  );
}
