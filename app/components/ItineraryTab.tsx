"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Modal, Form, DatePicker, TimePicker, Select, Typography, Input, Skeleton, Timeline, App, Upload, Image, Slider } from "antd";
import { EditOutlined, DeleteOutlined, LoadingOutlined, PictureOutlined, CloseOutlined } from "@ant-design/icons";
import { PlusIcon, CalendarIcon, LocationIcon, CategoryBadge, SparkleIcon, HealthIcon, WeatherIcon, CatTransportIcon, CatHotelIcon, CatFoodIcon, CatAttractionIcon, CatShoppingIcon, CatActivityIcon, CatOtherIcon } from "@/app/components/Icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import QuillEditor from "@/app/components/QuillEditor";

const todayStr = dayjs().format("YYYY-MM-DD");
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** Cover focal position is stored as a `#pos=NN` (0-100, vertical %) suffix on the image URL */
function parseCoverPos(url: string): { clean: string; pos: number } {
  const m = url.match(/#pos=(\d+)$/);
  return m ? { clean: url.replace(/#pos=\d+$/, ""), pos: Number(m[1]) } : { clean: url, pos: 50 };
}

function withCoverPos(url: string, pos: number): string {
  const clean = url.replace(/#pos=\d+$/, "");
  return pos === 50 ? clean : `${clean}#pos=${pos}`;
}

/** Ensure all <a> tags in Quill HTML open in a new tab */
function processLinks(html: string): string {
  return html.replace(/<a\b([^>]*?)>/gi, (_match, attrs: string) => {
    const hasTarget = /target=/i.test(attrs);
    const hasRel = /rel=/i.test(attrs);
    let a = attrs;
    if (!hasTarget) a += ' target="_blank"';
    if (!hasRel) a += ' rel="noopener noreferrer"';
    return `<a${a}>`;
  });
}

interface ItineraryItem {
  id: string;
  trip_id: string;
  date: string;
  sort_order: number;
  title: string;
  category: string | null;
  time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  image_urls: string[] | null;
}

interface WeatherDay {
  code: number;
  maxTemp: number;
  minTemp: number;
}

interface HealthIssue {
  level: "error" | "warning" | "ok";
  title: string;
  detail: string;
}

interface PreviewItem {
  _id: string;
  date: string;
  time: string;
  end_time: string | null;
  title: string;
  category: string;
  location: string | null;
  notes: string | null;
  removed: boolean;
}

const AI_INTERESTS = [
  { value: "food", label: "美食" },
  { value: "attraction", label: "文化景點" },
  { value: "nature", label: "自然" },
  { value: "shopping", label: "購物" },
  { value: "experience", label: "體驗" },
];

const TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 6;
  return { value: `${String(h).padStart(2, "0")}:00`, label: `${String(h).padStart(2, "0")}:00` };
});

interface Props {
  tripId: string;
  isActive?: boolean;
  destination: string;
  readOnly?: boolean;
  initialItems?: ItineraryItem[];
}

const CATEGORIES = [
  { value: "transport", label: "交通" },
  { value: "hotel", label: "住宿" },
  { value: "food", label: "餐飲" },
  { value: "attraction", label: "景點" },
  { value: "shopping", label: "購物" },
  { value: "activity", label: "活動" },
  { value: "other", label: "其他" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const CATEGORY_ACCENT: Record<string, { from: string; to: string }> = {
  transport: { from: '#60a5fa', to: '#3b82f6' },   // blue   — badge #60a5fa
  hotel: { from: '#a78bfa', to: '#7c3aed' },   // violet — badge #a78bfa
  food: { from: '#fbbf24', to: '#d97706' },   // amber  — badge #fbbf24
  attraction: { from: '#34d399', to: '#059669' },   // emerald — badge #34d399
  shopping: { from: '#f472b6', to: '#db2777' },   // pink   — badge #f472b6
  activity: { from: '#fb923c', to: '#ea580c' },   // orange — badge #fb923c
  other: { from: '#a1a1aa', to: '#71717a' },   // zinc   — badge #a1a1aa
};

const CATEGORY_DOT_ICONS: Record<string, ReactNode> = {
  transport: <CatTransportIcon size={11} />,
  hotel: <CatHotelIcon size={11} />,
  food: <CatFoodIcon size={11} />,
  attraction: <CatAttractionIcon size={11} />,
  shopping: <CatShoppingIcon size={11} />,
  activity: <CatActivityIcon size={11} />,
  other: <CatOtherIcon size={11} />,
};

export default function ItineraryTab({ tripId, isActive, destination, readOnly, initialItems }: Props) {
  const [items, setItems] = useState<ItineraryItem[]>(initialItems || []);
  const [form] = Form.useForm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Modal state derived from URL (only when not read-only)
  const urlModal = searchParams.get("modal");
  const urlItemId = searchParams.get("itemId");
  const urlDate = searchParams.get("date");
  const [forceClosed, setForceClosed] = useState(false);
  const pushedModalRef = useRef(false);
  const showModal = !readOnly && !forceClosed && (urlModal === "addItinerary" || urlModal === "editItinerary");
  const editingItem = useMemo<ItineraryItem | null>(() => {
    if (urlModal !== "editItinerary" || !urlItemId) return null;
    return items.find(i => i.id === urlItemId) ?? null;
  }, [urlModal, urlItemId, items]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherDay>>({});
  const { modal, message } = App.useApp();

  // Health check
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthIssue[] | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);

  // AI schedule
  const [aiModalOpen, setAIModalOpen] = useState(false);
  const [aiStep, setAIStep] = useState<"prefs" | "preview">("prefs");
  const [aiPace, setAIPace] = useState<"relaxed" | "normal" | "intensive">("normal");
  const [aiInterests, setAIInterests] = useState<string[]>(["food", "attraction"]);
  const [aiStartTime, setAIStartTime] = useState("09:00");
  const [aiEndTime, setAIEndTime] = useState("21:00");
  const [aiMustVisit, setAIMustVisit] = useState<string[]>([]);
  const [aiTransport, setAITransport] = useState<"public" | "self" | "mixed">("public");
  const [aiCarRental, setAICarRental] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [aiGenerating, setAIGenerating] = useState(false);
  const [aiPreview, setAIPreview] = useState<PreviewItem[]>([]);
  const [aiConfirming, setAIConfirming] = useState(false);

  async function fetchItems(force = true) {
    const cacheKey = `travel_itinerary_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setItems(JSON.parse(cached));
      setLoading(false);
    }
    // 60 秒內的快取視為新鮮：切分頁重新掛載時不重打 API
    if (!force && cached && Date.now() - Number(localStorage.getItem(`${cacheKey}:ts`) || 0) < 60_000) {
      setLoading(false);
      return;
    }
    if (!cached) setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/itinerary?tripId=${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        localStorage.setItem(cacheKey, JSON.stringify(data.items));
        localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
        setLoadError(false);
      } else if (!cached) {
        setLoadError(true);
      }
    } catch {
      if (!cached) setLoadError(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setLoading(false);
    } else if (isActive) {
      fetchItems(false);
    }
  }, [tripId, isActive, initialItems]);

  // 只依賴日期範圍字串，items 參照變動不會重打天氣 API
  const weatherRange = useMemo(() => {
    if (items.length === 0) return null;
    const allDates = items.map((item) => item.date).sort();
    return `${allDates[0]}~${allDates[allDates.length - 1]}`;
  }, [items]);

  useEffect(() => {
    if (!destination || !weatherRange) return;
    const city = destination.split(/[,，、]/)[0].trim();
    const [startDate, endDate] = weatherRange.split("~");
    fetch(`/api/weather?city=${encodeURIComponent(city)}&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.weather) return;
        const map: Record<string, WeatherDay> = {};
        data.weather.forEach((w: WeatherDay & { date: string }) => {
          map[w.date] = { code: w.code, maxTemp: w.maxTemp, minTemp: w.minTemp };
        });
        setWeatherMap(map);
      })
      .catch(() => { });
  }, [destination, weatherRange]);

  useEffect(() => {
    if (!isActive || loading) return;
    const todayEl = document.getElementById(`itinerary-date-${todayStr}`);
    if (todayEl) {
      setTimeout(() => todayEl.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [isActive, loading]);

  async function handleSave(values: Record<string, unknown>) {
    if (uploadingCount > 0) {
      message.warning("圖片上傳中，請稍候再儲存");
      return;
    }
    setSaving(true);

    const dateVal = values.date as Dayjs | null;
    const endDateVal = values.endDate as Dayjs | null | undefined;
    const timeStartVal = values.timeStart as Dayjs | null | undefined;
    const timeEndVal = values.timeEnd as Dayjs | null | undefined;

    const payload = {
      tripId,
      date: dateVal ? dateVal.format("YYYY-MM-DD") : "",
      time: timeStartVal ? timeStartVal.format("HH:mm") : null,
      end_date: endDateVal ? endDateVal.format("YYYY-MM-DD") : null,
      end_time: timeEndVal ? timeEndVal.format("HH:mm") : null,
      title: values.title,
      category: values.category ?? null,
      location: values.location ?? null,
      notes: (values.notes && values.notes !== "<p><br></p>") ? values.notes as string : null,
      image_urls: imageUrls,
    };

    try {
      const res = editingItem
        ? await fetchWithAuth("/api/itinerary", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingItem.id, ...payload }),
          })
        : await fetchWithAuth("/api/itinerary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        message.error("儲存失敗，請再試一次");
        return;
      }
      message.success(editingItem ? "已更新行程" : "已新增行程");
      closeModal();
      fetchItems();
    } catch {
      message.error("儲存失敗，請檢查網路連線");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const deleted = items.find((i) => i.id === id);
    try {
      const res = await fetchWithAuth("/api/itinerary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        message.error("刪除失敗，請再試一次");
        return;
      }
      fetchItems();
      if (deleted) {
        const key = `undo-itinerary-${id}`;
        message.success({
          key,
          duration: 5,
          content: (
            <span>
              已刪除「{deleted.title}」
              <button
                type="button"
                onClick={() => { message.destroy(key); restoreItem(deleted); }}
                className="ml-2 text-violet-500 font-medium underline cursor-pointer"
              >
                復原
              </button>
            </span>
          ),
        });
      } else {
        message.success("已刪除行程");
      }
    } catch {
      message.error("刪除失敗，請檢查網路連線");
    }
  }

  async function restoreItem(item: ItineraryItem) {
    try {
      const res = await fetchWithAuth("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          date: item.date,
          time: item.time,
          end_date: item.end_date,
          end_time: item.end_time,
          title: item.title,
          category: item.category,
          location: item.location,
          notes: item.notes,
          image_urls: item.image_urls ?? [],
        }),
      });
      if (!res.ok) throw new Error();
      message.success("已復原");
      fetchItems();
    } catch {
      message.error("復原失敗，請再試一次");
    }
  }

  // Populate form when URL-driven modal opens
  useEffect(() => {
    if (readOnly) return;
    if (urlModal === "addItinerary" || urlModal === "editItinerary") setForceClosed(false);
    if (urlModal === "editItinerary" && editingItem) {
      form.setFieldsValue({
        date: editingItem.date ? dayjs(editingItem.date) : null,
        endDate: editingItem.end_date && editingItem.end_date !== editingItem.date ? dayjs(editingItem.end_date) : null,
        timeStart: editingItem.time ? dayjs(editingItem.time, "HH:mm") : null,
        timeEnd: editingItem.end_time ? dayjs(editingItem.end_time, "HH:mm") : null,
        title: editingItem.title,
        category: editingItem.category,
        location: editingItem.location,
        notes: editingItem.notes,
      });
      setImageUrls(editingItem.image_urls ?? []);
    } else if (urlModal === "addItinerary") {
      form.resetFields();
      if (urlDate) {
        form.setFieldsValue({ date: dayjs(urlDate) });
      }
      setImageUrls([]);
    }
  }, [urlModal, editingItem?.id, urlDate]);

  function openEdit(item: ItineraryItem) {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "editItinerary");
    p.set("itemId", item.id);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function openAdd(date?: string) {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "addItinerary");
    p.delete("itemId");
    if (date) p.set("date", date); else p.delete("date");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function closeModal() {
    if (readOnly) return;
    setForceClosed(true);
    if (pushedModalRef.current) {
      pushedModalRef.current = false;
      router.back();
      return;
    }
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.delete("modal");
    p.delete("itemId");
    p.delete("date");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  async function handleImageUpload(file: File) {
    setUploadingCount((c) => c + 1);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tripId", tripId);
      const res = await fetchWithAuth("/api/itinerary/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setImageUrls((prev) => [...prev, data.url]);
      } else {
        message.error("圖片上傳失敗，請再試一次");
      }
    } catch {
      message.error("圖片上傳失敗，請再試一次");
    } finally {
      setUploadingCount((c) => c - 1);
    }
  }

  async function handleHealthCheck() {
    if (healthReport) { setHealthOpen((v) => !v); return; }
    setHealthLoading(true);
    setHealthOpen(true);
    try {
      const res = await fetchWithAuth(`/api/trips/${tripId}/itinerary/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "health_check" }),
      });
      if (res.ok) {
        const data = await res.json();
        setHealthReport(data.issues ?? []);
      } else {
        message.error("健康檢查失敗，請再試一次");
        setHealthOpen(false);
      }
    } catch {
      message.error("健康檢查失敗，請檢查網路連線");
      setHealthOpen(false);
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleAIGenerate() {
    setAIGenerating(true);
    try {
      const res = await fetchWithAuth(`/api/trips/${tripId}/itinerary/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          pace: aiPace,
          interests: aiInterests,
          startTime: aiStartTime,
          endTime: aiEndTime,
          mustVisit: aiMustVisit,
          transport: aiTransport,
          carRentalStart: aiCarRental[0]?.format("YYYY-MM-DD") ?? null,
          carRentalEnd: aiCarRental[1]?.format("YYYY-MM-DD") ?? null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAIPreview(data.items ?? []);
        setAIStep("preview");
      } else {
        message.error("AI 排程生成失敗，請再試一次");
      }
    } catch {
      message.error("AI 排程生成失敗，請檢查網路連線");
    } finally {
      setAIGenerating(false);
    }
  }

  async function handleAIConfirm() {
    const toInsert = aiPreview.filter((item) => !item.removed);
    setAIConfirming(true);
    try {
      const results = await Promise.all(
        toInsert.map((item) =>
          fetchWithAuth("/api/itinerary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tripId,
              date: item.date,
              time: item.time,
              end_time: item.end_time,
              title: item.title,
              category: item.category,
              location: item.location,
              notes: item.notes,
            }),
          }).then((r) => r.ok).catch(() => false),
        ),
      );
      const failed = results.filter((ok) => !ok).length;
      if (failed > 0) {
        message.warning(`已寫入 ${results.length - failed} 筆，${failed} 筆失敗 — 請檢查後補上`);
      }
      setAIModalOpen(false);
      setAIPreview([]);
      setAIStep("prefs");
      fetchItems();
    } finally {
      setAIConfirming(false);
    }
  }

  function toggleAIRemove(id: string) {
    setAIPreview((prev) => prev.map((item) => item._id === id ? { ...item, removed: !item.removed } : item));
  }

  const grouped = items.reduce<Record<string, ItineraryItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();
  const timeToMinutes = (t: string | null) => {
    if (!t) return 9999;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  dates.forEach((date) => {
    grouped[date].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  });

  const timelineItems = dates.flatMap((date) => {
    const isToday = date === todayStr;
    const isPast = date < todayStr;
    const dotColor = isToday ? "#a1a1aa" : isPast ? "#27272a" : "#52525b";

    const dateNode = {
      key: `date-${date}`,
      color: dotColor,
      content: (
        <div id={`itinerary-date-${date}`} className="scroll-mt-20 md:scroll-mt-36">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap sticky top-16 md:top-32 z-40 py-2 bg-[#09090b]/60 backdrop-blur-md">
            <Typography.Text
              title="跳到下一天"
              onClick={() => {
                const next = dates[(dates.indexOf(date) + 1) % dates.length];
                document.getElementById(`itinerary-date-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`font-display text-[13px] font-semibold cursor-pointer hover:opacity-75 transition-opacity select-none ${isToday ? "text-violet-400" : isPast ? "text-zinc-600" : "text-zinc-400"
                }`}
            >
              {date} <span className="opacity-50 text-xs ml-0.5">(週{WEEKDAYS[dayjs(date).day()]})</span>
            </Typography.Text>
            {isToday && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
                今日
              </span>
            )}
            {weatherMap[date] && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: isPast ? "#52525b" : "#a1a1aa",
                }}
              >
                <WeatherIcon code={weatherMap[date].code} size={12} /> {weatherMap[date].maxTemp}° / {weatherMap[date].minTemp}°
              </span>
            )}
            {!readOnly && (
              <button
                aria-label={`在 ${date} 新增行程`}
                onClick={() => openAdd(date)}
                className="relative w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.12] hover:text-zinc-200 transition-colors cursor-pointer after:absolute after:-inset-2.5 after:content-['']"
              >
                <PlusIcon size={10} />
              </button>
            )}
          </div>
        </div>
      ),
    };

    const itemNodes = grouped[date].map((item, itemIndex) => {
            const hasImage = !!(item.image_urls && item.image_urls.length > 0);
            const timeLabel = (item.time || item.end_time) ? (
              <span className="text-xs shrink-0 tabular-nums">
                {item.time ?? ""}
                {(item.end_time || (item.end_date && item.end_date !== item.date)) && (
                  <span className="opacity-70">
                    {" → "}
                    {item.end_date && item.end_date !== item.date ? `${item.end_date} ` : ""}
                    {item.end_time ?? ""}
                  </span>
                )}
              </span>
            ) : null;
            const locationInner = item.location ? (
              <>
                <a
                  href={
                    item.location.startsWith("http")
                      ? item.location
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="在 Google Maps 開啟地點"
                  className="w-6 h-6 -my-1 -ml-1.5 -mr-1 rounded-full flex items-center justify-center shrink-0 !text-violet-400/75 hover:!text-violet-300 hover:bg-violet-500/10 transition-colors"
                >
                  <LocationIcon size={12} />
                </a>
                {item.location.startsWith("http") ? (
                  <a
                    href={item.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="!text-violet-400/75 hover:!text-violet-300 hover:!underline underline-offset-2 transition-colors"
                  >
                    查看地圖
                  </a>
                ) : (
                  <span className="truncate">{item.location}</span>
                )}
              </>
            ) : null;
            const actionButtons = !readOnly ? (
              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                <button
                  aria-label="編輯行程"
                  onClick={() => openEdit(item)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  <EditOutlined style={{ fontSize: 13 }} />
                </button>
                <button
                  aria-label="刪除行程"
                  onClick={() => modal.confirm({
                    title: `確定刪除「${item.title}」？`,
                    okText: "刪除", okType: "danger", cancelText: "取消",
                    onOk: () => handleDelete(item.id),
                  })}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <DeleteOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
            ) : null;
      return {
        key: item.id,
        icon: (
          <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-white/[0.12] bg-[#131316] text-zinc-400">
            {CATEGORY_DOT_ICONS[item.category ?? "other"] ?? CATEGORY_DOT_ICONS.other}
          </span>
        ),
        content: (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.28, ease: "easeOut", delay: itemIndex * 0.05 }}
              className="relative bg-white/[0.03] border border-white/[0.07] rounded-[18px] overflow-hidden"
              style={!hasImage && item.category ? { background: `radial-gradient(ellipse at 18% 0%, ${(CATEGORY_ACCENT[item.category] ?? CATEGORY_ACCENT.other).from}14 0%, transparent 65%), rgba(255,255,255,0.03)` } : undefined}
            >
              <div className="block md:flex">
              {item.image_urls && item.image_urls.length > 0 && (() => {
                const cover = parseCoverPos(item.image_urls[0]);
                return (
                  <div className="relative w-full h-32 md:w-64 md:h-auto md:min-h-[128px] md:shrink-0">
                    <Image.PreviewGroup items={item.image_urls.map((u) => parseCoverPos(u).clean)}>
                      <Image
                        src={cover.clean}
                        alt={item.title}
                        rootClassName="!absolute !inset-0 !block"
                        className="!w-full !h-full object-cover"
                        style={{
                          objectPosition: `center ${cover.pos}%`,
                          filter: "saturate(0.82) brightness(0.92) contrast(1.05)",
                        }}
                        preview={{ mask: null }}
                      />
                    </Image.PreviewGroup>
                    <div className="absolute inset-0 bg-[#17141f]/25 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#121214] pointer-events-none md:hidden" />
                    <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent to-[#121214] pointer-events-none hidden md:block" />
                    {item.image_urls.length > 1 && (
                      <span className="absolute bottom-2 right-2 text-[11px] leading-4 px-1.5 py-0.5 rounded-md bg-black/60 text-zinc-200 pointer-events-none">
                        +{item.image_urls.length - 1}
                      </span>
                    )}
                    {/* 手機：標題疊在下緣漸層上 */}
                    <div className="md:hidden absolute left-3.5 right-12 bottom-1 pointer-events-none">
                      <Typography.Text strong className="!text-zinc-50 text-[15px] leading-snug">{item.title}</Typography.Text>
                    </div>
                    {/* 手機：操作鈕疊在圖片右上（與伴手禮卡一致） */}
                    {!readOnly && (
                      <div className="md:hidden absolute top-2 right-2 flex gap-1 bg-black/30 backdrop-blur-[2px] rounded-full p-0.5">
                        <button
                          aria-label="編輯行程"
                          onClick={() => openEdit(item)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:bg-black/25 transition-colors cursor-pointer"
                        >
                          <EditOutlined style={{ fontSize: 13 }} />
                        </button>
                        <button
                          aria-label="刪除行程"
                          onClick={() => modal.confirm({
                            title: `確定刪除「${item.title}」？`,
                            okText: "刪除", okType: "danger", cancelText: "取消",
                            onOk: () => handleDelete(item.id),
                          })}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-red-400 hover:bg-black/25 transition-colors cursor-pointer"
                        >
                          <DeleteOutlined style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className={`flex-1 min-w-0 ${hasImage ? "pt-1 md:pt-0" : "pt-3"} px-3.5 pb-3 md:flex md:flex-col md:justify-center md:py-3`}>
              {!hasImage && (
                <div className="md:hidden flex justify-between items-start mb-1">
                  <Typography.Text strong className="!text-zinc-50 text-[15px] leading-snug flex-1 min-w-0">{item.title}</Typography.Text>
                  {actionButtons && <div className="-mt-1">{actionButtons}</div>}
                </div>
              )}
              {(timeLabel || item.category || locationInner) && (
                <div className="md:hidden flex items-center gap-2 flex-wrap mb-1 text-zinc-500 text-xs">
                  {timeLabel && <span className="text-zinc-500">{timeLabel}</span>}
                  {item.category && <CategoryBadge category={item.category} />}
                  {locationInner && <span className="flex items-center gap-0.5 min-w-0">{locationInner}</span>}
                </div>
              )}
              <div className="hidden md:flex justify-between items-start">
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap mb-1">
                  {timeLabel && <span className="text-zinc-500">{timeLabel}</span>}
                  <Typography.Text strong className="text-zinc-100 text-sm">{item.title}</Typography.Text>
                  {item.category && <CategoryBadge category={item.category} />}
                </div>
                {actionButtons}
              </div>
              {locationInner && (
                <div className="hidden md:flex text-zinc-500 text-xs mb-0.5 items-center gap-0.5">
                  {locationInner}
                </div>
              )}
              {item.notes && (
                <div
                  className="notes-content text-zinc-500 text-xs mt-1"
                  dangerouslySetInnerHTML={{ __html: processLinks(item.notes) }}
                />
              )}
              </div>
              </div>
            </motion.div>
        ),
      };
    });

    return [dateNode, ...itemNodes];
  });

  return (
    <>
      <div className="my-3 flex items-center justify-between gap-2">
        <Typography.Text strong className="text-zinc-100 text-[15px] shrink-0">每日行程</Typography.Text>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {!readOnly && (
            <>
              <button
                onClick={() => { setAIModalOpen(true); setAIStep("prefs"); }}
                className="inline-flex items-center gap-1 rounded-full text-[12px] font-medium h-7 px-2.5 transition-all duration-200 cursor-pointer"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}
              >
                <SparkleIcon size={10} /> AI 排程
              </button>
              <button
                onClick={handleHealthCheck}
                disabled={healthLoading}
                className="inline-flex items-center gap-1 rounded-full text-[12px] font-medium h-7 px-2.5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                style={healthReport
                  ? { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#71717a" }}
              >
                {healthLoading ? <LoadingOutlined style={{ fontSize: 10 }} /> : <HealthIcon size={11} />} 行程檢查
              </button>
              <button
                onClick={() => openAdd()}
                className="inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium h-7 px-2.5 bg-white/[0.06] border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
              >
                <PlusIcon size={11} />
                新增
              </button>
            </>
          )}
        </div>
      </div>

      {/* Health report card */}
      {healthOpen && (
        <div className="mb-4 rounded-[18px] overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <HealthIcon size={14} className="text-zinc-300" />
              <span className="text-zinc-200 text-[13px] font-semibold">行程健康報告</span>
              {!healthLoading && healthReport && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.2)", color: "#fbbf24" }}>
                  {healthReport.filter((i) => i.level !== "ok").length} 個建議
                </span>
              )}
            </div>
            <button onClick={() => setHealthOpen(false)} className="text-zinc-600 text-xs hover:text-zinc-400 cursor-pointer">收起</button>
          </div>
          <div className="px-4 py-3 space-y-3">
            {healthLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            ) : (healthReport ?? []).map((issue, i) => (
              <div key={i} className="flex gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${issue.level === "error" ? "bg-red-400" : issue.level === "warning" ? "bg-amber-400" : "bg-emerald-400"}`}
                  aria-label={issue.level === "error" ? "嚴重" : issue.level === "warning" ? "建議" : "正常"}
                />
                <div>
                  <span className="text-zinc-200 text-[12px] font-medium">{issue.title}</span>
                  <p className="text-zinc-500 text-[11px] mt-0.5 leading-relaxed">{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-4 w-36 rounded-full bg-white/[0.06] mb-1" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] overflow-hidden">
              {i !== 1 ? (
                <div className="block md:flex">
                  <div className="w-full h-32 md:w-64 md:h-auto md:min-h-[128px] md:shrink-0 bg-white/[0.05]" />
                  <div className="flex-1 min-w-0 p-4 space-y-2.5">
                    <div className="h-3.5 w-40 max-w-full rounded-full bg-white/[0.06]" />
                    <div className="h-3 w-28 max-w-full rounded-full bg-white/[0.05]" />
                    <div className="h-3 w-3/5 rounded-full bg-white/[0.04]" />
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-2.5">
                  <div className="h-4 w-48 max-w-full rounded-full bg-white/[0.06]" />
                  <div className="h-3 w-32 max-w-full rounded-full bg-white/[0.05]" />
                  <div className="h-3 w-2/3 rounded-full bg-white/[0.04]" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : loadError && dates.length === 0 ? (
        <div className="text-center py-14 rounded-3xl border border-white/5 bg-white/[0.02]">
          <div className="text-zinc-300 text-sm font-medium mb-1">行程載入失敗</div>
          <div className="text-zinc-500 text-xs mb-4">請檢查網路連線後重試</div>
          <button
            onClick={() => fetchItems()}
            className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-4 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            重新載入
          </button>
        </div>
      ) : dates.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-16 px-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
            <CalendarIcon size={32} stroke="#8b5cf6" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-zinc-200 font-medium mb-1">還沒有行程安排</div>
            <div className="text-zinc-500 text-xs max-w-[240px] mx-auto">
              把每一天規劃好，旅程會更從容。
            </div>
          </div>
          {!readOnly && (
            <div className="flex gap-2 w-full max-w-[300px]">
              <button
                onClick={() => openAdd()}
                className="flex-1 h-10 rounded-2xl bg-white/[0.06] border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/10 transition-all cursor-pointer"
              >
                手動新增
              </button>
              <button
                onClick={() => setAIModalOpen(true)}
                className="flex-1 h-10 rounded-2xl bg-violet-600 border border-violet-500 text-white text-sm font-medium hover:bg-violet-500 transition-all shadow-[0_4px_12px_rgba(139,92,246,0.3)] cursor-pointer"
              >
                AI 助手生成
              </button>
            </div>
          )}
        </div>
      ) : (
        <Timeline className="itinerary-timeline" items={timelineItems} />
      )}

      <Modal
        title={editingItem ? "編輯行程" : "新增行程"}
        open={showModal}
        onCancel={closeModal}
        afterClose={() => { form.resetFields(); setImageUrls([]); }}
        footer={null}
        width={520}
        centered={true}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4" disabled={saving}>
          <div className="flex gap-2">
            <Form.Item name="date" label="日期" rules={[{ required: true, message: "請選擇日期" }]} className="flex-1">
              <DatePicker className="w-full" placeholder="選擇日期" />
            </Form.Item>
            <Form.Item name="endDate" label="結束日期（跨日選填）" className="flex-1">
              <DatePicker className="w-full" placeholder="跨日才需要" />
            </Form.Item>
          </div>
          <div className="flex gap-2">
            <Form.Item name="timeStart" label="開始時間（選填）" className="flex-1">
              <TimePicker className="w-full" format="HH:mm" minuteStep={5} placeholder="選填" needConfirm={false} />
            </Form.Item>
            <Form.Item name="timeEnd" label="結束時間（選填）" className="flex-1">
              <TimePicker className="w-full" format="HH:mm" minuteStep={5} placeholder="選填" needConfirm={false} />
            </Form.Item>
          </div>
          <Form.Item name="title" label="行程名稱" rules={[{ required: true, message: "請輸入行程名稱" }]}>
            <Input placeholder="例如：淺草寺參觀" />
          </Form.Item>
          <Form.Item name="category" label="類型">
            <Select placeholder="選擇類型" allowClear options={CATEGORIES} />
          </Form.Item>
          <Form.Item name="location" label="地點">
            <Input placeholder="地點名稱，或貼上 Google Maps 連結" />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <QuillEditor placeholder="行程備註..." />
          </Form.Item>
          <Form.Item label="圖片（點縮圖設為封面）">
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, idx) => (
                <div key={url} className="relative w-20 h-20">
                  <button
                    type="button"
                    title={idx === 0 ? "目前封面" : "設為封面"}
                    aria-label={idx === 0 ? "目前封面" : "設為封面"}
                    onClick={() => { if (idx !== 0) setImageUrls((prev) => [url, ...prev.filter((u) => u !== url)]); }}
                    className={`w-full h-full rounded-xl overflow-hidden border cursor-pointer ${idx === 0 ? "border-violet-500/60" : "border-white/[0.08] hover:border-white/30"} transition-colors`}
                  >
                    <img src={parseCoverPos(url).clean} alt="行程圖片" className="w-full h-full object-cover" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] leading-4 px-1 rounded bg-violet-500/80 text-white pointer-events-none">
                      封面
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="移除圖片"
                    onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 border border-white/[0.15] text-zinc-300 flex items-center justify-center hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    <CloseOutlined style={{ fontSize: 10 }} />
                  </button>
                </div>
              ))}
              <Upload
                accept="image/*"
                multiple
                showUploadList={false}
                beforeUpload={(file) => { handleImageUpload(file); return false; }}
              >
                <button
                  type="button"
                  className="w-20 h-20 rounded-xl border border-dashed border-white/[0.15] text-zinc-500 flex flex-col items-center justify-center gap-1 hover:border-white/30 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {uploadingCount > 0 ? <LoadingOutlined /> : <PictureOutlined />}
                  <span className="text-[11px]">{uploadingCount > 0 ? "上傳中" : "上傳"}</span>
                </button>
              </Upload>
            </div>
            {imageUrls.length > 0 && (() => {
              const cover = parseCoverPos(imageUrls[0]);
              return (
                <div className="mt-3">
                  <div className="w-full h-24 rounded-xl overflow-hidden border border-white/[0.08]">
                    <img
                      src={cover.clean}
                      alt="封面預覽"
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `center ${cover.pos}%` }}
                    />
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    value={cover.pos}
                    onChange={(v: number) => setImageUrls((prev) => [withCoverPos(prev[0], v), ...prev.slice(1)])}
                    tooltip={{ open: false }}
                  />
                  <div className="text-[11px] text-zinc-500 -mt-1">封面顯示位置：往左露出圖片上緣、往右露出下緣</div>
                </div>
              );
            })()}
          </Form.Item>
          <Form.Item className="!mb-0 !mt-2">
            <Button type="primary" htmlType="submit" block loading={saving}>
              {editingItem ? "儲存變更" : "新增行程"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Schedule Modal */}
      <Modal
        open={aiModalOpen}
        onCancel={() => { setAIModalOpen(false); setAIStep("prefs"); setAIPreview([]); }}
        title={aiStep === "prefs" ? "AI 幫我排行程" : "AI 行程預覽"}
        footer={null}
        width={500}
        centered={true}
      >
        {aiStep === "prefs" && (
          <div className="mt-4 space-y-5">
            {/* Pace */}
            <div>
              <div className="text-zinc-400 text-[12px] font-medium mb-2">旅遊節奏</div>
              <div className="flex gap-2">
                {(["relaxed", "normal", "intensive"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAIPace(p)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium border transition-all cursor-pointer"
                    style={aiPace === p
                      ? { background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.35)", color: "#a78bfa", fontWeight: 600 }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "#71717a" }}
                  >
                    {p === "relaxed" ? "輕鬆" : p === "normal" ? "普通" : "密集"}
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <div className="text-zinc-400 text-[12px] font-medium mb-2">
                偏好興趣 <span className="text-zinc-600 font-normal">（可多選）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_INTERESTS.map(({ value, label }) => {
                  const active = aiInterests.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => setAIInterests((prev) => active ? prev.filter((i) => i !== value) : [...prev, value])}
                      className="px-3 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer"
                      style={active
                        ? { background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.35)", color: "#a78bfa" }
                        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.09)", color: "#71717a" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time range */}
            <div>
              <div className="text-zinc-400 text-[12px] font-medium mb-2">每日時間範圍</div>
              <div className="flex items-center gap-2">
                <Select
                  value={aiStartTime}
                  onChange={setAIStartTime}
                  options={TIME_OPTIONS}
                  className="flex-1"
                  size="small"
                />
                <span className="text-zinc-600 text-xs">→</span>
                <Select
                  value={aiEndTime}
                  onChange={setAIEndTime}
                  options={TIME_OPTIONS}
                  className="flex-1"
                  size="small"
                />
              </div>
            </div>

            {/* Must-visit places */}
            <div>
              <div className="text-zinc-400 text-[12px] font-medium mb-2">
                想去的地方 <span className="text-zinc-600 font-normal">（選填）</span>
              </div>
              <Select
                mode="tags"
                value={aiMustVisit}
                onChange={setAIMustVisit}
                placeholder="輸入地點後按 Enter…"
                className="w-full"
                size="small"
                tokenSeparators={[","]}
                open={false}
              />
              <div className="text-zinc-600 text-[11px] mt-1">AI 會依地理位置自動安排最佳順序</div>
            </div>

            {/* Transport */}
            <div>
              <div className="text-zinc-400 text-[12px] font-medium mb-2">交通方式</div>
              <div className="flex gap-2">
                {([
                  { value: "public", label: "大眾運輸" },
                  { value: "self",   label: "自駕" },
                  { value: "mixed",  label: "混合" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setAITransport(value)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium border transition-all cursor-pointer"
                    style={aiTransport === value
                      ? { background: "rgba(20,184,166,0.12)", borderColor: "rgba(20,184,166,0.35)", color: "#5eead4", fontWeight: 600 }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "#71717a" }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Car rental period — shown for self/mixed */}
              {(aiTransport === "self" || aiTransport === "mixed") && (
                <div className="mt-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-teal-400">租車期間</span>
                    <span className="text-[10px] text-zinc-600">選填・不填則由 AI 建議</span>
                  </div>
                  <DatePicker.RangePicker
                    value={aiCarRental}
                    onChange={(dates) => setAICarRental(dates ? [dates[0], dates[1]] : [null, null])}
                    size="small"
                    className="w-full"
                    placeholder={["開始日期", "結束日期"]}
                    allowEmpty={[true, true]}
                  />
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <span className="text-zinc-400 text-[11px] leading-relaxed">
                  你已有 {items.length} 個行程項目，AI 會自動避開衝突時段。
                </span>
              </div>
            )}

            <button
              onClick={handleAIGenerate}
              disabled={aiGenerating}
              className="w-full py-3 rounded-[14px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.8),rgba(99,102,241,0.8))", color: "#fff", boxShadow: "0 4px 20px rgba(139,92,246,0.25)" }}
            >
              {aiGenerating ? <LoadingOutlined /> : <SparkleIcon size={12} />}
              {aiGenerating ? "AI 生成中..." : "生成行程預覽"}
            </button>
          </div>
        )}

        {aiStep === "preview" && (() => {
          const previewByDate = aiPreview.reduce<Record<string, PreviewItem[]>>((acc, item) => {
            if (!acc[item.date]) acc[item.date] = [];
            acc[item.date].push(item);
            return acc;
          }, {});
          const activeDates = Object.keys(previewByDate).sort();
          const activeCount = aiPreview.filter((i) => !i.removed).length;

          return (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-500 text-[11px]">點 ✕ 移除不想要的項目</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                  {activeCount} / {aiPreview.length} 項
                </span>
              </div>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {activeDates.map((date) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-zinc-500 text-[12px] font-semibold">
                        {date} <span className="opacity-50 text-[11px]">(週{WEEKDAYS[dayjs(date).day()]})</span>
                      </span>
                      {weatherMap[date] && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#71717a" }}>
                          <WeatherIcon code={weatherMap[date].code} size={11} /> {weatherMap[date].maxTemp}°/{weatherMap[date].minTemp}°
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {previewByDate[date].map((item) => {
                        const accent = CATEGORY_ACCENT[item.category] ?? CATEGORY_ACCENT.other;
                        return (
                          <div
                            key={item._id}
                            className="relative rounded-[12px] overflow-hidden pl-3 pr-2 py-2 transition-all"
                            style={{
                              background: item.removed ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${item.removed ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)"}`,
                              opacity: item.removed ? 0.45 : 1,
                            }}
                          >
                            {!item.removed && (
                              <div className="absolute left-0 inset-y-0 w-[3px]"
                                style={{ background: `linear-gradient(to bottom, ${accent.from}, ${accent.to})` }} />
                            )}
                            <div className="flex items-center gap-2 pl-1">
                              <span className={`text-[11px] tabular-nums w-10 shrink-0 ${item.removed ? "text-zinc-600 line-through" : "text-zinc-500"}`}>
                                {item.time}
                              </span>
                              <span className={`text-[12px] font-medium flex-1 min-w-0 truncate ${item.removed ? "text-zinc-600 line-through" : "text-zinc-200"}`}>
                                {item.title}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${item.removed ? "opacity-30" : ""}`}
                                style={{ background: `${accent.from}18`, color: accent.from, border: `1px solid ${accent.from}30` }}>
                                {CATEGORY_MAP[item.category] ?? item.category}
                              </span>
                              <button
                                onClick={() => toggleAIRemove(item._id)}
                                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer"
                                style={{ fontSize: 10, color: item.removed ? "#52525b" : "#52525b" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = item.removed ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = item.removed ? "#a1a1aa" : "#f87171"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#52525b"; }}
                              >
                                {item.removed ? "↩" : "✕"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <button
                  onClick={() => { setAIStep("prefs"); setAIPreview([]); }}
                  className="flex-1 py-2.5 rounded-[12px] text-[13px] font-medium border text-zinc-400 cursor-pointer hover:text-zinc-200 transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.09)" }}
                >
                  重新生成
                </button>
                <button
                  onClick={handleAIConfirm}
                  disabled={aiConfirming || activeCount === 0}
                  className="flex-[2] py-2.5 px-4 rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-all"
                  style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.85),rgba(99,102,241,0.85))", color: "#fff", boxShadow: "0 4px 16px rgba(139,92,246,0.2)" }}
                >
                  {aiConfirming ? <LoadingOutlined /> : "✓"}
                  {aiConfirming ? "加入中..." : `加入行程（${activeCount} 項）`}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
