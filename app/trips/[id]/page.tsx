"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Button, Typography, Input,
  Skeleton, Popconfirm, Timeline, Tooltip, App, Select, Modal,
} from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import EditTripModal from "@/app/components/EditTripModal";
import AddSegmentModal from "@/app/components/AddSegmentModal";
import EditSegmentModal from "@/app/components/EditSegmentModal";
import PhotoWall from "@/app/components/PhotoWall";
import ItineraryTab from "@/app/components/ItineraryTab";
import ExpensesTab from "@/app/components/ExpensesTab";
import NotesTab from "@/app/components/NotesTab";
import SouvenirsTab from "@/app/components/SouvenirsTab";
import LineBotTripModal from "@/app/components/LineBotTripModal";
import SegmentCard from "@/app/components/SegmentCard";
import TripHero from "@/app/components/TripHero";
import TripRecapCard from "@/app/components/TripRecapCard";
import MobileNav from "@/app/components/MobileNav";
import {
  PlaneIcon, PlusIcon, CalendarIcon, UsersIcon, GiftIcon,
  CoinIcon, PhotoIcon, ShareIcon, UserPlusIcon, EditIcon, TrashIcon, ChevronLeftIcon, NotepadIcon, MoreVerticalIcon, LineBotIcon,
} from "@/app/components/Icons";
import dayjs from "dayjs";

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

// Binding between a split-bill member name (trips.people) and a Google account.
interface MemberLink {
  person_name: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [tripLoadError, setTripLoadError] = useState(false);
  const [segmentsLoadError, setSegmentsLoadError] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberLinks, setMemberLinks] = useState<MemberLink[]>([]);
  const [bindingPerson, setBindingPerson] = useState<string | null>(null);
  const [showBindingPanel, setShowBindingPanel] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [itineraryStats, setItineraryStats] = useState<{ items: number; locations: number } | null>(null);
  const [membersLoaded, setMembersLoaded] = useState(false);

  // Esc 關閉 bottom sheet
  useEffect(() => {
    if (!showMoreSheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowMoreSheet(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showMoreSheet]);

  const markAvatarFailed = (key: string) =>
    setFailedAvatars((prev) => new Set(prev).add(key));
  const { modal, message: messageApi } = App.useApp();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "transport");
  const hadTabParamRef = useRef(!!searchParams.get("tab"));
  const autoTabAppliedRef = useRef(false);

  // Modal open state derived from URL — avoids duplicate history entries
  const urlModal = searchParams.get("modal");
  const showEdit = urlModal === "editTrip";
  const showAddSegment = urlModal === "addSegment";
  const showLineBotModal = urlModal === "lineBot";
  const [tabDirection, setTabDirection] = useState(1);
  const ALL_TABS = ["transport", "itinerary", "expenses", "photos", "notes", "souvenirs"];

  // Update ref whenever trip loads so animation direction matches user's custom sort order
  const tabOrderRef = useRef(ALL_TABS);
  useEffect(() => {
    if (trip?.enabled_tabs) {
      tabOrderRef.current = trip.enabled_tabs;
    }
  }, [trip]);

  // 旅途中模式：旅程期間開啟且 URL 未指定分頁時，直接落在今日行程
  useEffect(() => {
    if (!trip || hadTabParamRef.current || autoTabAppliedRef.current) return;
    if (activeTab !== "transport") return;
    if (trip.enabled_tabs && !trip.enabled_tabs.includes("itinerary")) return;
    const today = dayjs().format("YYYY-MM-DD");
    if (trip.start_date && trip.end_date && today >= trip.start_date && today <= trip.end_date) {
      autoTabAppliedRef.current = true;
      setTabDirection(1);
      setActiveTab("itinerary");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  // 峰終回顧：旅程結束後第一次打開這頁時撒一次 confetti（之後只留回顧卡）
  const tripEnded = !!(trip?.end_date && dayjs().format("YYYY-MM-DD") > trip.end_date);
  useEffect(() => {
    if (!tripEnded) return;
    const seenKey = `travel_recap_seen_${id}`;
    if (localStorage.getItem(seenKey)) return;
    localStorage.setItem(seenKey, "1");
    const t = setTimeout(() => {
      import("canvas-confetti").then(({ default: confetti }) => {
        const colors = ["#8b5cf6", "#a855f7", "#6366f1", "#e4e4e7"];
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.35 }, colors, zIndex: 3000 });
        setTimeout(() => confetti({ particleCount: 45, spread: 110, startVelocity: 32, origin: { y: 0.3 }, colors, zIndex: 3000 }), 280);
      });
    }, 650);
    return () => clearTimeout(t);
  }, [tripEnded, id]);

  // Shared element transition: hero expands from card's screen position
  const heroRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const cardRectCache = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    // First run: read from sessionStorage and cache in ref so Strict Mode's second run can reuse it
    if (!cardRectCache.current) {
      const raw = sessionStorage.getItem(`trip_card_rect_${id}`);
      if (!raw) return;
      cardRectCache.current = JSON.parse(raw);
      sessionStorage.removeItem(`trip_card_rect_${id}`);
    }

    const cardRect = cardRectCache.current!;
    const heroRect = el.getBoundingClientRect();
    const deltaX = cardRect.left - heroRect.left;
    const deltaY = cardRect.top - heroRect.top;
    const scale = cardRect.width / heroRect.width;

    el.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
    el.style.transformOrigin = "0 0";
    el.style.transition = "none";
    el.getBoundingClientRect(); // force reflow so transition: none takes effect before rAF

    const rafId = requestAnimationFrame(() => {
      el.style.transition = "transform 0.52s cubic-bezier(0.2, 0, 0, 1)";
      el.style.transform = "translate(0px, 0px) scale(1)";
    });

    return () => {
      cancelAnimationFrame(rafId);
      el.style.transform = "";
      el.style.transition = "";
      el.style.transformOrigin = "";
      // cardRectCache is intentionally kept so the second Strict Mode run can replay the animation
    };
  }, []);

  // Sync tab state with URL on back/forward navigation
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "transport";
    if (tabFromUrl !== activeTab && tabOrderRef.current.includes(tabFromUrl)) {
      const order = tabOrderRef.current;
      setTabDirection(order.indexOf(tabFromUrl) > order.indexOf(activeTab) ? 1 : -1);
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Sync editingSegment when URL carries modal=editSegment
  useEffect(() => {
    if (urlModal === "editSegment") {
      const segId = searchParams.get("segmentId");
      const seg = segments.find(s => s.id === segId);
      if (seg) setEditingSegment(seg);
    } else {
      setEditingSegment(null);
    }
  }, [urlModal, searchParams, segments]);

  // Push a modal param into history so browser back closes it
  function pushModal(name: string, extra?: Record<string, string>) {
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", name);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    router.push(`/trips/${id}?${p.toString()}`);
  }

  // Remove modal param — replaces current entry so back skips the modal
  function clearModal() {
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.delete("modal");
    p.delete("segmentId");
    router.replace(`/trips/${id}?${p.toString()}`);
  }

  /** hero 卡還在視窗內就不捲動；捲過 hero 之後，切 tab 對齊到內容區塊頂端（扣掉 sticky header/tab bar） */
  function scrollToTabContent() {
    const hero = heroRef.current;
    if (hero) {
      const r = hero.getBoundingClientRect();
      if (r.bottom > 64 && r.top < window.innerHeight) return;
    }
    const target = tabContentRef.current;
    if (!target) return;
    const offset = isMobile ? 72 : 136;
    const y = window.scrollY + target.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
  }

  const handleTabChange = (val: string) => {
    if (val === activeTab) return;
    const order = tabOrderRef.current;
    setTabDirection(order.indexOf(val) > order.indexOf(activeTab) ? 1 : -1);
    setActiveTab(val);
    scrollToTabContent();

    // replace (not push) so browser back leaves the page instead of stepping through visited tabs
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set("tab", val);
    current.delete("modal");
    current.delete("segmentId");
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
    try {
      const res = await fetchWithAuth("/api/sheets");
      if (res.ok) {
        const data = await res.json();
        const found = data.trips.find((t: Trip) => t.id === id) ?? null;
        setTrip(found);
        if (found) localStorage.setItem(cacheKey, JSON.stringify(found));
        setTripLoadError(false);
      } else if (!cached) {
        setTripLoadError(true);
      }
    } catch {
      if (!cached) setTripLoadError(true);
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
    try {
      const res = await fetchWithAuth(`/api/segments?tripId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSegments(data.segments);
        localStorage.setItem(cacheKey, JSON.stringify(data.segments));
        setSegmentsLoadError(false);
      } else if (!cached) {
        setSegmentsLoadError(true);
      }
    } catch {
      if (!cached) setSegmentsLoadError(true);
    }
    setSegmentsLoading(false);
  }

  function loadAll() {
    setTripLoadError(false);
    setLoading(true);
    Promise.all([
      fetchTrip(),
      fetchSegments(),
      fetchMembers(),
      fetchMemberLinks(),
      fetchCover(),
      fetchWithAuth("/api/auth/status").then((r) => r.json()).then((d) => setUserId(d.userId)).catch(() => { }),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => {
    const tripCached = localStorage.getItem(`travel_trip_${id}`);
    if (tripCached) setLoading(false);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchCover() {
    try {
      const res = await fetchWithAuth(`/api/itinerary?tripId=${id}`);
      if (res.ok) {
        const data = await res.json();
        const items: { image_urls?: string[] | null; location?: string | null }[] = data.items ?? [];
        const withImg = items.find((i) => i.image_urls && i.image_urls.length > 0);
        setCoverUrl(withImg?.image_urls?.[0] ?? null);
        setItineraryStats({
          items: items.length,
          locations: new Set(items.map((i) => i.location?.trim()).filter(Boolean)).size,
        });
      }
    } catch { }
  }

  async function fetchMembers() {
    try {
      const res = await fetchWithAuth(`/api/trips/${id}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch { } finally {
      setMembersLoaded(true);
    }
  }

  async function fetchMemberLinks() {
    try {
      const res = await fetchWithAuth(`/api/trips/${id}/member-links`);
      if (res.ok) {
        const data = await res.json();
        setMemberLinks(data.links);
      }
    } catch { }
  }

  async function handleBindMember(personName: string, targetUserId: string | null) {
    setBindingPerson(personName);
    try {
      if (targetUserId === null) {
        await fetchWithAuth(`/api/trips/${id}/member-links?person_name=${encodeURIComponent(personName)}`, { method: "DELETE" });
      } else {
        await fetchWithAuth(`/api/trips/${id}/member-links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person_name: personName, user_id: targetUserId }),
        });
      }
      await fetchMemberLinks();
    } finally {
      setBindingPerson(null);
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

  /** 手機優先用系統分享面板；不支援或使用者取消時退回剪貼簿，失敗給出可手動複製的路徑 */
  async function deliverLink(url: string, title: string, successText: string) {
    if (isMobile && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return true;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return false;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      messageApi.success(successText);
      return true;
    } catch {
      modal.info({
        title: "無法自動複製",
        content: (
          <Input.TextArea readOnly value={url} autoSize onFocus={(e) => e.target.select()} />
        ),
        okText: "關閉",
      });
      return false;
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetchWithAuth(`/api/trips/${id}/share`);
      if (!res.ok) {
        messageApi.error("產生分享連結失敗，請再試一次");
        return;
      }
      const { shareUrl } = await res.json();
      const urlWithTab = `${shareUrl}${shareUrl.includes("?") ? "&" : "?"}tab=${activeTab}`;
      await deliverLink(urlWithTab, `${trip?.name ?? "旅程"} - Travel Tracker`, "已複製分享連結");
      setShowMoreSheet(false);
    } catch {
      messageApi.error("產生分享連結失敗，請檢查網路連線");
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
      if (!res.ok) {
        messageApi.error("產生邀請連結失敗，請再試一次");
        return;
      }
      const { inviteUrl } = await res.json();
      await deliverLink(inviteUrl, `邀請你加入「${trip?.name ?? "旅程"}」`, "已複製邀請連結");
      setShowMoreSheet(false);
    } catch {
      messageApi.error("產生邀請連結失敗，請檢查網路連線");
    } finally {
      setInviting(false);
    }
  }

  const isOwner = !!(trip && userId && trip.user_id === userId);
  const isMember = !isOwner && members.some(m => m.user_id === userId);

  function memberAvatarColor(uid: string) {
    // 深色寶石調：夠深讓白字可讀、彩度收斂貼合深紫品牌，仍保有成員間辨識度
    const palette = ["#7c3aed", "#4f46e5", "#a21caf", "#0f766e", "#1d4ed8", "#be185d", "#6d28d9"];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  if (!trip && !loading && tripLoadError) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4 px-6">
        <Typography.Text className="text-zinc-300 text-[15px] font-medium">旅程載入失敗</Typography.Text>
        <Typography.Text className="text-zinc-400 text-[13px]">資料還在，只是現在連不上。請檢查網路後重試。</Typography.Text>
        <div className="flex gap-2">
          <Button type="primary" onClick={loadAll}>重新載入</Button>
          <Button onClick={() => router.push("/")}>返回首頁</Button>
        </div>
      </div>
    );
  }

  if (!trip && !loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <Typography.Text className="text-zinc-400">找不到這筆旅程</Typography.Text>
        <Button onClick={() => router.push("/")}>返回首頁</Button>
      </div>
    );
  }

  const people = trip?.people ?? [];
  const currencies = trip?.currency ? trip.currency.split(",") : ["TWD"];
  const primaryCurrency = currencies[0];

  const timelineItems = segments.map((seg) => ({
    key: seg.id,
    color: "blue",
    content: (
      <SegmentCard
        seg={seg}
        onEdit={() => pushModal("editSegment", { segmentId: seg.id })}
        onDelete={() => modal.confirm({
          title: "確定刪除這段交通？",
          okText: "刪除", okType: "danger", cancelText: "取消",
          onOk: () => handleDeleteSegment(seg.id),
        })}
      />
    ),
  }));

  const transportContent = (
    <>
      <div className="my-3 flex items-center justify-between">
        <Typography.Text strong className="text-zinc-100 text-[15px]">交通段落</Typography.Text>
        <button
          onClick={() => pushModal("addSegment")}
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
      ) : segmentsLoadError && segments.length === 0 ? (
        <div className="text-center py-14 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="text-zinc-300 text-sm font-medium mb-1">交通記錄載入失敗</div>
          <div className="text-zinc-400 text-xs mb-4">請檢查網路連線後重試</div>
          <button
            onClick={() => fetchSegments()}
            className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-4 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            重新載入
          </button>
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
            onClick={() => pushModal("addSegment")}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <PlusIcon size={12} />
            新增第一段
          </button>
        </div>
      ) : (
        <Timeline className="segment-timeline" items={timelineItems} />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#09090b]">
      <header className="backdrop-blur-md bg-[#09090b]/70 flex items-center gap-2 px-3 md:px-5 h-16 sticky top-0 z-[100] border-b border-white/[0.06]">
        {/* Back */}
        <button
          onClick={() => router.push("/")}
          aria-label="返回首頁"
          className="relative w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer after:absolute after:-inset-1 after:content-['']"
        >
          <ChevronLeftIcon size={14} />
        </button>

        {/* Trip name */}
        <span className="flex-1 text-zinc-400 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">
          {trip?.name ?? ""}
        </span>

        {/* Action buttons */}
        {trip && (isMobile ? (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleShare}
              disabled={sharing}
              aria-label="複製分享連結"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 disabled:opacity-40 cursor-pointer"
            >
              {sharing ? <LoadingOutlined size={15} /> : <ShareIcon size={15} />}
            </button>
            <button
              onClick={() => setShowMoreSheet(true)}
              aria-label="更多動作"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            >
              <MoreVerticalIcon size={16} strokeWidth={2.5} />
            </button>
          </div>
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
              onClick={() => pushModal("lineBot")}
              title="LINE Bot 記帳"
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            >
              <LineBotIcon size={13} />
              LINE Bot
            </button>

            <button
              onClick={() => pushModal("editTrip")}
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
        ))}
      </header>

      <div
        className="md:max-w-[80%] mx-auto w-full"
        style={{ padding: isMobile ? "20px 12px 100px" : "32px 24px 80px", maxWidth: 1024, margin: "0 auto" }}
      >
        <TripHero
          ref={heroRef}
          name={trip?.name}
          startDate={trip?.start_date}
          endDate={trip?.end_date}
          countries={trip?.countries}
          notes={trip?.notes}
          coverUrl={coverUrl}
          pillsEnd={
            !membersLoaded ? (
              <span className="flex items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-7 h-7 rounded-full bg-white/10 animate-pulse"
                    style={{ marginLeft: i === 0 ? 0 : -8, border: "1px solid rgba(9,9,11,0.6)" }}
                  />
                ))}
              </span>
            ) : members.length > 0 ? (
              <span className="flex items-center">
                  {members.map((m, i) => {
                    const canRemove = isOwner && !m.is_owner;
                    const isRemoving = removingMemberId === m.user_id;
                    const avatar = m.avatar_url && !failedAvatars.has(m.user_id) ? (
                      <img
                        src={m.avatar_url}
                        alt={m.name}
                        onError={() => markAvatarFailed(m.user_id)}
                        className="w-7 h-7 rounded-full object-cover" style={{ border: "1px solid rgba(9,9,11,0.6)", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ background: memberAvatarColor(m.user_id), border: "1px solid rgba(9,9,11,0.6)", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
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
              </span>
            ) : null
          }
        />

        <Modal
          open={showBindingPanel}
          onCancel={() => setShowBindingPanel(false)}
          footer={null}
          title="分帳綁定"
          centered
        >
          {(isOwner || isMember) && people.length > 0 ? (
            <div className="flex flex-col gap-2 pt-1">
                  {people.map((p) => {
                    const link = memberLinks.find((l) => l.person_name === p);
                    const boundUserId = link?.user_id ?? null;
                    return (
                      <div
                        key={p}
                        className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-200 text-[13px] font-medium truncate">{p}</span>
                          {boundUserId ? (
                            <span className="flex items-center gap-1.5 text-zinc-500 text-[12px] min-w-0">
                              <span className="text-zinc-600">↔</span>
                              {link?.avatar_url && !failedAvatars.has(`link-${boundUserId}`) ? (
                                <img
                                  src={link.avatar_url}
                                  alt={link.name ?? ""}
                                  onError={() => markAvatarFailed(`link-${boundUserId}`)}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                  style={{ background: memberAvatarColor(boundUserId) }}
                                >
                                  {(link?.name ?? "?").charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate">{link?.name}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[12px]">未綁定</span>
                          )}
                        </div>
                        {isOwner && (
                          boundUserId ? (
                            <button
                              onClick={() => handleBindMember(p, null)}
                              disabled={bindingPerson === p}
                              className="text-zinc-600 hover:text-red-400 text-[12px] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                            >
                              {bindingPerson === p ? <LoadingOutlined style={{ fontSize: 12 }} /> : "解除"}
                            </button>
                          ) : (
                            <Select
                              size="small"
                              style={{ minWidth: 130 }}
                              placeholder="綁定帳號"
                              loading={bindingPerson === p}
                              onChange={(val) => handleBindMember(p, val ?? null)}
                              options={members.map((m) => ({ value: m.user_id, label: m.name }))}
                            />
                          )
                        )}
                      </div>
                    );
                  })}
            </div>
          ) : (
            <div className="text-zinc-500 text-[13px] py-4 text-center">先在旅程編輯加入分帳成員，再回來綁定</div>
          )}
        </Modal>

        {trip && tripEnded && (
          <TripRecapCard
            days={trip.start_date && trip.end_date
              ? Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000)
              : null}
            itemCount={itineraryStats?.items ?? 0}
            locationCount={itineraryStats?.locations ?? 0}
          />
        )}

        {trip && (
        <motion.div
          className="mb-7"
          initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0 }}
          animate={{ clipPath: "inset(0 0 0% 0)", opacity: 1, transitionEnd: { clipPath: "none" } }}
          transition={{ duration: 0.48, ease: [0.2, 0, 0, 1], delay: 0.15 }}
        >
          {!isMobile && (
            <div className="flex items-center justify-center mb-8 py-2 sticky top-16 z-[90] bg-[#09090b]/60 backdrop-blur-md">
              <div className="flex bg-[#18181b]/80 border border-white/8 backdrop-blur-md rounded-full p-1.5 shadow-xl">
                {[
                  { key: "transport", label: "路線", icon: <PlaneIcon size={18} /> },
                  { key: "itinerary", label: "行程", icon: <CalendarIcon size={18} /> },
                  { key: "expenses", label: "費用", icon: <CoinIcon size={18} /> },
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
          <div ref={tabContentRef} style={{ overflow: 'clip' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: tabDirection * 36 }}
                animate={{ opacity: 1, x: 0, transitionEnd: { transform: "none" } }}
                exit={{ opacity: 0, x: tabDirection * -24 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {activeTab === "transport" && transportContent}
                {activeTab === "itinerary" && (
                  <ItineraryTab
                    tripId={id}
                    isActive
                    destination={trip.countries}
                    people={people}
                    currency={primaryCurrency}
                    currencies={currencies}
                  />
                )}
                {activeTab === "notes" && <NotesTab tripId={id} />}
                {activeTab === "souvenirs" && <SouvenirsTab tripId={id} />}
                {activeTab === "expenses" && <ExpensesTab tripId={id} people={people} currency={primaryCurrency} currencies={currencies} tripEndDate={trip.end_date} />}
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
                        onClick={() => pushModal("editTrip")}
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
        </motion.div>
        )}
      </div>

      {isMobile && trip && (
        <MobileNav
          activeKey={activeTab}
          onChange={handleTabChange}
          tabs={[
            { key: "transport", icon: <PlaneIcon size={20} />, label: "路線" },
            { key: "itinerary", icon: <CalendarIcon size={20} />, label: "行程" },
            { key: "expenses", icon: <CoinIcon size={20} />, label: "費用" },
            { key: "photos", icon: <PhotoIcon size={20} />, label: "照片" },
            { key: "notes", icon: <NotepadIcon size={20} />, label: "筆記" },
            { key: "souvenirs", icon: <GiftIcon size={20} />, label: "伴手禮" },
          ]
            .filter(tab => !trip.enabled_tabs || trip.enabled_tabs.includes(tab.key))
            .sort((a, b) => {
              if (!trip.enabled_tabs) return 0;
              return trip.enabled_tabs.indexOf(a.key) - trip.enabled_tabs.indexOf(b.key);
            })}
        />
      )}

      {/* 快速記帳 FAB：旅程進行期間、手機拇指區的一鍵記帳 */}
      {isMobile && trip && (!trip.enabled_tabs || trip.enabled_tabs.includes("expenses")) && (() => {
        const today = dayjs().format("YYYY-MM-DD");
        const inTrip = trip.start_date && trip.end_date && today >= trip.start_date && today <= trip.end_date;
        if (!inTrip) return null;
        return (
          <button
            onClick={() => {
              const p = new URLSearchParams(Array.from(searchParams.entries()));
              p.set("tab", "expenses");
              p.set("modal", "addExpense");
              p.delete("expenseId");
              setActiveTab("expenses");
              router.push(`/trips/${id}?${p.toString()}`, { scroll: false });
            }}
            aria-label="快速記帳"
            className="fixed right-4 z-[300] w-12 h-12 rounded-full flex items-center justify-center text-zinc-300 bg-white/[0.08] border border-white/10 backdrop-blur-md cursor-pointer active:scale-95 transition-transform"
            style={{
              bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <CoinIcon size={18} />
          </button>
        );
      })()}

      {/* Mobile More Actions Bottom Sheet */}
      <div
        className="fixed inset-0 z-[400] transition-opacity duration-300 cursor-pointer"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: showMoreSheet ? 1 : 0,
          pointerEvents: showMoreSheet ? "auto" : "none",
        }}
        onClick={() => setShowMoreSheet(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="旅程動作"
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
          <div className="text-zinc-600 text-[11px] font-medium px-1 mb-3 mt-1 truncate">{trip?.name}</div>

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

            {/* 分帳綁定 */}
            {(isOwner || isMember) && people.length > 0 && (
              <button
                onClick={() => { setShowMoreSheet(false); setShowBindingPanel(true); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <UsersIcon size={16} stroke="#a78bfa" />
                </div>
                <div>
                  <div className="text-zinc-100 text-[14px] font-medium">分帳綁定</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">把分帳名單對應到成員帳號</div>
                </div>
              </button>
            )}

            {/* LINE Bot */}
            <button
              onClick={() => { setShowMoreSheet(false); pushModal("lineBot"); }}
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
              onClick={() => { setShowMoreSheet(false); pushModal("editTrip"); }}
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

      {showEdit && trip && (
        <EditTripModal trip={trip} onClose={clearModal} onSaved={() => { clearModal(); fetchTrip(); }} />
      )}
      <LineBotTripModal
        open={showLineBotModal}
        tripId={id}
        tripName={trip?.name ?? ""}
        onClose={clearModal}
      />
      {showAddSegment && (
        <AddSegmentModal
          tripId={id}
          nextOrder={segments.length + 1}
          onClose={clearModal}
          onSaved={() => { clearModal(); fetchSegments(); }}
        />
      )}
      {editingSegment && (
        <EditSegmentModal
          segment={editingSegment}
          onClose={clearModal}
          onSaved={() => { clearModal(); fetchSegments(); }}
        />
      )}
    </div>
  );
}
