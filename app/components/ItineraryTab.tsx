"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Modal, Form, DatePicker, TimePicker, Select, Typography, Input, InputNumber, Skeleton, Timeline, App, Upload, Image, Slider, Dropdown } from "antd";
import { EditOutlined, DeleteOutlined, LoadingOutlined, PictureOutlined, CloseOutlined } from "@ant-design/icons";
import { PlusIcon, CalendarIcon, LocationIcon, CoinIcon, CategoryBadge, SparkleIcon, HealthIcon, WeatherIcon, CatTransportIcon, CatHotelIcon, CatFoodIcon, CatAttractionIcon, CatShoppingIcon, CatActivityIcon, CatOtherIcon, MountainIcon, SheetIcon } from "@/app/components/Icons";
import RouteProfileModal, { type Waypoint as RouteWaypoint } from "@/app/components/RouteProfileModal";
import ElevationSparkline from "@/app/components/ElevationSparkline";
import { decideElevationDisplay } from "@/lib/elevationDisplay";
import { computeOutdoorTotals, type OutdoorTotals } from "@/lib/outdoorTotals";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import QuillEditor from "@/app/components/QuillEditor";
import QuickExpenseModal from "@/app/components/QuickExpenseModal";
import { parseCoverPos, withCoverPos } from "@/lib/coverPos";
import { compressImage } from "@/lib/compressImage";
import { GoogleAuthError, clearGoogleAccessToken, preloadGoogleAuth, requestGoogleAccessToken } from "@/lib/googleAuth";

const todayStr = dayjs().format("YYYY-MM-DD");
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
  distance_km: number | null;
  ascent_m: number | null;
  descent_m: number | null;
  /** null = 依海拔覆蓋率自動判斷；true/false = 使用者明確設定 */
  show_elevation: boolean | null;
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

interface LinkedExpense {
  id: string;
  itinerary_item_id: string | null;
  description: string;
  amount: number;
  currency: string;
  paid_by: string | null;
}

interface Props {
  tripId: string;
  isActive?: boolean;
  destination: string;
  readOnly?: boolean;
  initialItems?: ItineraryItem[];
  /** 分帳成員與幣別：行程內記帳用，唯讀分享頁只用來顯示金額 */
  people?: string[];
  currency?: string;
  currencies?: string[];
  initialExpenses?: LinkedExpense[];
  /** 唯讀分享頁用：以 itinerary item id 分組的途經點 */
  initialWaypoints?: Record<string, RouteWaypoint[]>;
  /** 戶外路段總計顯示在 hero，改動後要讓上層跟著更新 */
  onOutdoorTotalsChange?: (totals: OutdoorTotals | null) => void;
}

/** 同幣別合併，跨幣別並列（行程卡上不換匯，避免多打一支匯率 API） */
function formatExpenseTotals(list: LinkedExpense[]): string {
  const byCurrency: Record<string, number> = {};
  list.forEach((e) => {
    byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + Number(e.amount);
  });
  return Object.entries(byCurrency)
    .map(([cur, total]) => `${cur} ${Math.round(total).toLocaleString("en-US")}`)
    .join(" · ");
}

const CATEGORIES = [
  { value: "transport", label: "交通" },
  { value: "hotel", label: "住宿" },
  { value: "food", label: "餐飲" },
  { value: "attraction", label: "景點" },
  { value: "shopping", label: "購物" },
  { value: "activity", label: "活動" },
  { value: "outdoor", label: "戶外" },
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
  outdoor: { from: '#34d399', to: '#047857' },   // emerald — badge #34d399
  other: { from: '#a1a1aa', to: '#71717a' },   // zinc   — badge #a1a1aa
};

const CATEGORY_DOT_ICONS: Record<string, ReactNode> = {
  transport: <CatTransportIcon size={11} />,
  hotel: <CatHotelIcon size={11} />,
  food: <CatFoodIcon size={11} />,
  attraction: <CatAttractionIcon size={11} />,
  shopping: <CatShoppingIcon size={11} />,
  activity: <CatActivityIcon size={11} />,
  outdoor: <MountainIcon size={11} />,
  other: <CatOtherIcon size={11} />,
};

/** 跨日行程最多展開幾天：end_date 誤填成隔年時，時間軸不該長出上百個空日期 */
const MAX_SPAN_DAYS = 30;

/** 一筆行程覆蓋的日期；超過上限只留頭尾兩天，total 仍是真實天數 */
function getSpan(item: ItineraryItem): { days: string[]; total: number } {
  const start = dayjs(item.date);
  if (!item.end_date || item.end_date <= item.date || !start.isValid()) {
    return { days: [item.date], total: 1 };
  }
  const end = dayjs(item.end_date);
  if (!end.isValid()) return { days: [item.date], total: 1 };
  const total = end.diff(start, "day") + 1;
  const days = total > MAX_SPAN_DAYS
    ? [item.date, item.end_date]
    : Array.from({ length: total }, (_, i) => start.add(i, "day").format("YYYY-MM-DD"));
  return { days, total };
}

/** 續日精簡條的狀態字：依類別換說法 */
const CONTINUE_LABEL: Record<string, string> = {
  hotel: "住宿中",
  transport: "移動中",
  activity: "進行中",
};

export default function ItineraryTab({
  tripId, isActive, destination, readOnly, initialItems,
  people = [], currency = "TWD", currencies = ["TWD"], initialExpenses, initialWaypoints,
  onOutdoorTotalsChange,
}: Props) {
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

  // 行程內記帳
  const [expenses, setExpenses] = useState<LinkedExpense[]>(initialExpenses ?? []);
  const [quickItem, setQuickItem] = useState<ItineraryItem | null>(null);
  const [routeItem, setRouteItem] = useState<ItineraryItem | null>(null);
  // 整趟旅程的途經點（以 item id 分組）。卡片的 sparkline 與路線彈窗共用同一份，
  // 所以只發一次請求，而且打開彈窗不需要再載入。
  const [waypointMap, setWaypointMap] = useState<Record<string, RouteWaypoint[]>>(initialWaypoints ?? {});
  // map 還沒載回來時不能把空陣列餵給彈窗 —— 那會讓有途經點的路線顯示成「還沒有途經點」。
  // 未載入就傳 undefined，彈窗自己去撈。
  const [waypointsLoaded, setWaypointsLoaded] = useState(!!initialWaypoints);
  const [quickSaving, setQuickSaving] = useState(false);

  // 匯出 Google Sheet
  const [exporting, setExporting] = useState(false);
  const loginEmailRef = useRef<string | null>(null);

  // AI 選單（AI 排程 + 行程檢查，兩者打的是同一支 AI API）
  const [aiMenuOpen, setAIMenuOpen] = useState(false);

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

  // 分享頁由上層直接餵資料；登入版有戶外行程時才去撈一次
  useEffect(() => {
    if (initialWaypoints) { setWaypointMap(initialWaypoints); setWaypointsLoaded(true); return; }
    if (readOnly) return;
    if (!items.some(i => i.category === "outdoor")) return;
    let cancelled = false;
    (async () => {
      const res = await fetchWithAuth(`/api/itinerary/waypoints?tripId=${tripId}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setWaypointMap(data.waypoints ?? {});
      setWaypointsLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, readOnly, initialWaypoints, items.some(i => i.category === "outdoor")]);

  // 戶外總計顯示在 hero：這裡的 items 是最新的（存完途經點也會即時反映），回報給上層
  useEffect(() => {
    onOutdoorTotalsChange?.(computeOutdoorTotals(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // 與費用分頁共用同一份快取，切過來通常能直接畫出金額
  async function fetchExpenses() {
    const cacheKey = `travel_expenses_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setExpenses(JSON.parse(cached)); } catch { }
    }
    try {
      const res = await fetchWithAuth(`/api/expenses?tripId=${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses ?? []);
        localStorage.setItem(cacheKey, JSON.stringify(data.expenses));
        localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
      }
    } catch { }
  }

  useEffect(() => {
    if (initialExpenses) {
      setExpenses(initialExpenses);
    } else if (isActive && !readOnly) {
      fetchExpenses();
    }
  }, [tripId, isActive, readOnly, initialExpenses]);

  const expensesByItem = useMemo(() => {
    const map: Record<string, LinkedExpense[]> = {};
    expenses.forEach((e) => {
      if (!e.itinerary_item_id) return;
      (map[e.itinerary_item_id] ??= []).push(e);
    });
    return map;
  }, [expenses]);

  async function handleQuickExpense(payload: Record<string, unknown>): Promise<boolean> {
    setQuickSaving(true);
    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        message.error("儲存失敗，請再試一次");
        return false;
      }
      await fetchExpenses();
      return true;
    } catch {
      message.error("儲存失敗，請檢查網路連線");
      return false;
    } finally {
      setQuickSaving(false);
    }
  }

  // 只依賴日期範圍字串，items 參照變動不會重打天氣 API
  const weatherRange = useMemo(() => {
    if (items.length === 0) return null;
    const starts = items.map((item) => item.date).sort();
    const ends = items
      .map((item) => (item.end_date && item.end_date > item.date ? item.end_date : item.date))
      .sort();
    const start = starts[0];
    const last = ends[ends.length - 1];
    // end_date 打錯（例如隔年）不該讓天氣 API 拉一整年的範圍
    const capped = dayjs(start).add(MAX_SPAN_DAYS * 2, "day").format("YYYY-MM-DD");
    return `${start}~${last > capped ? capped : last}`;
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
      // 只有戶外路段才填這三個；其他類型留空，卡片上就不會多出一列
      distance_km: values.category === "outdoor" ? (values.distanceKm ?? null) : null,
      ascent_m: values.category === "outdoor" ? (values.ascentM ?? null) : null,
      descent_m: values.category === "outdoor" ? (values.descentM ?? null) : null,
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
          // 途經點隨原本那筆一起被連帶刪掉了，復原不回來；至少把這三個數字帶回去
          distance_km: item.distance_km,
          ascent_m: item.ascent_m,
          descent_m: item.descent_m,
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
        distanceKm: editingItem.distance_km,
        ascentM: editingItem.ascent_m,
        descentM: editingItem.descent_m,
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
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
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

  // GIS 的 script 先載好，按下匯出時彈窗才算在點擊那個手勢裡、不會被瀏覽器擋掉
  useEffect(() => {
    if (readOnly || !isActive) return;
    preloadGoogleAuth().catch(() => { });
  }, [readOnly, isActive]);

  /**
   * 匯出成使用者自己 Google 帳號裡的試算表：當場向 Google 要一顆只能碰自建檔案的 token，
   * 交給後端組表格。行程資料由後端重讀，匯出的內容一定是已存檔的版本。
   */
  async function handleExportSheet() {
    if (exporting) return;
    setExporting(true);
    try {
      if (loginEmailRef.current === null) {
        try {
          const meRes = await fetchWithAuth("/api/me");
          if (meRes.ok) loginEmailRef.current = (await meRes.json()).email ?? "";
        } catch { }
      }
      const accessToken = await requestGoogleAccessToken(loginEmailRef.current || undefined);
      const res = await fetchWithAuth("/api/itinerary/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, accessToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "google_auth_required") {
          clearGoogleAccessToken();
          message.error("Google 授權已失效，請再按一次匯出重新授權");
        } else if (data.code === "sheets_api_disabled") {
          message.error("這個 Google 專案還沒啟用 Sheets API");
        } else if (data.code === "empty") {
          message.info("這趟還沒有行程可以匯出");
        } else {
          message.error("匯出失敗，請再試一次");
        }
        return;
      }
      window.open(data.url, "_blank", "noopener");
      message.success(
        <span>
          已匯出到你的 Google 雲端硬碟 ·{" "}
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline">開啟試算表</a>
        </span>,
        6
      );
    } catch (e) {
      if (e instanceof GoogleAuthError) {
        if (e.code === "cancelled") return;
        message.error(
          e.code === "popup_blocked" ? "Google 授權視窗被瀏覽器擋住了，請允許彈出視窗後再試"
            : e.code === "no_client_id" ? "這個站台還沒設定 Google 用戶端 ID，無法匯出"
              : "Google 授權失敗，請再試一次"
        );
      } else {
        message.error("匯出失敗，請檢查網路連線");
      }
    } finally {
      setExporting(false);
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

  /** 從續日精簡條跳回開始日的完整卡片，並短暫高亮 */
  function jumpToItem(id: string) {
    const el = document.getElementById(`itinerary-item-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("item-flash");
    window.setTimeout(() => el.classList.remove("item-flash"), 1400);
  }

  const spans = new Map(items.map((item) => [item.id, getSpan(item)] as const));
  // 開始日 → 完整卡片
  const startsOn = items.reduce<Record<string, ItineraryItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
  // 跨日行程的續日 → 精簡條（不含開始日，避免同一天出現兩次）
  const continuesOn = items.reduce<Record<string, ItineraryItem[]>>((acc, item) => {
    (spans.get(item.id)?.days ?? []).slice(1).forEach((d) => {
      if (!acc[d]) acc[d] = [];
      acc[d].push(item);
    });
    return acc;
  }, {});
  const dates = Array.from(new Set([...Object.keys(startsOn), ...Object.keys(continuesOn)])).sort();
  const timeToMinutes = (t: string | null) => {
    if (!t) return 9999;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  dates.forEach((date) => {
    startsOn[date]?.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    continuesOn[date]?.sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.time) - timeToMinutes(b.time));
  });

  const timelineItems = dates.flatMap((date) => {
    const isToday = date === todayStr;
    const isPast = date < todayStr;
    const dotColor = isToday ? "#a1a1aa" : isPast ? "#27272a" : "#52525b";

    const walked = date <= todayStr;
    const dateNode = {
      key: `date-${date}`,
      color: dotColor,
      className: walked ? "rail-done" : undefined,
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

    // 跨日行程在續日只給一條精簡狀態條：不重複整張卡，也不放編輯／記帳鈕
    const continuingNodes = (continuesOn[date] ?? []).map((item) => {
      const total = spans.get(item.id)?.total ?? 1;
      const dayIndex = dayjs(date).diff(dayjs(item.date), "day") + 1;
      const isLastDay = date === item.end_date;
      const stateLabel = CONTINUE_LABEL[item.category ?? "other"] ?? "持續中";
      const endLabel = item.category === "hotel" ? "退房" : "結束";
      return {
        key: `cont-${item.id}-${date}`,
        className: walked ? "rail-done" : undefined,
        icon: (
          <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-dashed border-white/[0.14] bg-[#131316] text-zinc-600">
            {CATEGORY_DOT_ICONS[item.category ?? "other"] ?? CATEGORY_DOT_ICONS.other}
          </span>
        ),
        content: (
          <button
            type="button"
            onClick={() => jumpToItem(item.id)}
            aria-label={`查看「${item.title}」，${stateLabel}第 ${dayIndex}/${total} 天`}
            className="group w-full flex items-center gap-2 min-w-0 text-left px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors cursor-pointer"
          >
            <span className="text-[12px] text-zinc-400 truncate min-w-0 group-hover:text-zinc-200 transition-colors">
              {item.title}
            </span>
            <span className="text-[11px] text-zinc-600 shrink-0 tabular-nums">
              {stateLabel} {dayIndex}/{total} 天
              {isLastDay && item.end_time ? ` · ${endLabel} ${item.end_time}` : ""}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-zinc-700 group-hover:text-zinc-500 transition-colors">›</span>
          </button>
        ),
      };
    });

    const itemNodes = (startsOn[date] ?? []).map((item, itemIndex) => {
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
            const linkedExpenses = expensesByItem[item.id] ?? [];
            const hasExpenses = linkedExpenses.length > 0;
            // 與時間／地點同一種份量：純文字＋icon，不用藥丸底
            const amountInner = (
              <>
                <CoinIcon size={11} strokeWidth={1.6} />
                <span className="font-money">
                  {hasExpenses ? formatExpenseTotals(linkedExpenses) : `${currency} 0`}
                </span>
                {hasExpenses && <span className="opacity-60">· {linkedExpenses.length}</span>}
              </>
            );
            const amountBase = "inline-flex items-center gap-1 -my-1 py-1 shrink-0";
            const amountTone = hasExpenses ? "text-teal-400/75" : "text-zinc-500";
            // 金額本身就是記帳入口：點下去開快速記帳表單
            const expenseChip = readOnly
              ? (hasExpenses ? <span className={`${amountBase} ${amountTone}`}>{amountInner}</span> : null)
              : (
                <button
                  type="button"
                  onClick={() => setQuickItem(item)}
                  aria-label={`記一筆費用到「${item.title}」`}
                  className={`${amountBase} ${amountTone} ${hasExpenses ? "hover:text-teal-300" : "hover:text-zinc-300"} transition-colors cursor-pointer`}
                >
                  {amountInner}
                </button>
              );
            // 戶外路段才有的入口：有數據就直接顯示里程／爬升，沒有也點得進去建途經點
            const routeWaypoints = waypointMap[item.id];
            // 與路線彈窗共用同一個判斷，兩邊不會出現一邊畫一邊不畫
            const sparkDecision = decideElevationDisplay(routeWaypoints, item.show_elevation);
            const routeSpark = item.category === "outdoor" && sparkDecision.show && routeWaypoints ? (
              <button
                type="button"
                onClick={() => setRouteItem(item)}
                aria-label={`查看「${item.title}」的路線高度圖`}
                className="w-full mt-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] hover:border-emerald-500/35 transition-colors cursor-pointer overflow-hidden"
              >
                <ElevationSparkline waypoints={routeWaypoints} />
              </button>
            ) : null;

            const routeChip = item.category === "outdoor" ? (
              <button
                type="button"
                onClick={() => setRouteItem(item)}
                aria-label={`查看「${item.title}」的路線高度圖`}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-300/90 hover:text-emerald-200 transition-colors cursor-pointer tabular-nums shrink-0"
              >
                <MountainIcon size={11} />
                {item.distance_km != null ? `${item.distance_km} km` : "路線"}
                {item.ascent_m != null ? ` · +${item.ascent_m} m` : ""}
              </button>
            ) : null;
      return {
        key: item.id,
        className: walked ? "rail-done" : undefined,
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
              id={`itinerary-item-${item.id}`}
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
              {(timeLabel || item.category || locationInner || routeChip || expenseChip) && (
                <div className="md:hidden flex items-center gap-2 flex-wrap mb-1 text-zinc-500 text-xs">
                  {timeLabel && <span className="text-zinc-500">{timeLabel}</span>}
                  {item.category && <CategoryBadge category={item.category} />}
                  {locationInner && <span className="flex items-center gap-0.5 min-w-0">{locationInner}</span>}
                  {routeChip}
                  {expenseChip}
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
              {(locationInner || routeChip || expenseChip) && (
                <div className="hidden md:flex text-zinc-500 text-xs mb-0.5 items-center gap-2 flex-wrap">
                  {locationInner && <span className="flex items-center gap-0.5 min-w-0">{locationInner}</span>}
                  {routeChip}
                  {expenseChip}
                </div>
              )}
              {routeSpark}
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

    return [dateNode, ...continuingNodes, ...itemNodes];
  });

  // 報告卡的「N 個建議」同一個算法：ok 不算問題
  const healthSuggestions = healthReport?.filter((i) => i.level !== "ok").length ?? 0;

  return (
    <>
      <div className="my-3 flex items-center justify-between gap-2">
        <Typography.Text strong className="text-zinc-100 text-[15px] shrink-0">每日行程</Typography.Text>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {!readOnly && (
            <>
              <Dropdown
                trigger={["click"]}
                open={aiMenuOpen}
                onOpenChange={setAIMenuOpen}
                popupRender={() => (
                  <div className="bg-[#18181b] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl min-w-[212px]">
                    <button
                      onClick={() => { setAIModalOpen(true); setAIStep("prefs"); setAIMenuOpen(false); }}
                      className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <SparkleIcon size={12} className="mt-0.5 shrink-0" stroke="#a78bfa" />
                      <span>
                        <span className="block text-zinc-200 text-[13px] font-medium">AI 排程</span>
                        <span className="block text-zinc-500 text-[11px] mt-0.5">依偏好排出整趟行程</span>
                      </span>
                    </button>
                    <div className="h-px bg-white/[0.06]" />
                    <button
                      onClick={() => { handleHealthCheck(); setAIMenuOpen(false); }}
                      disabled={healthLoading}
                      className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {healthLoading
                        ? <LoadingOutlined style={{ fontSize: 12, marginTop: 2 }} />
                        : <HealthIcon size={12} className="mt-0.5 shrink-0" />}
                      <span>
                        <span className="block text-zinc-200 text-[13px] font-medium">行程檢查</span>
                        <span className="block text-zinc-500 text-[11px] mt-0.5">
                          {healthLoading
                            ? "檢查中…"
                            : healthReport
                              ? `已檢查 · ${healthSuggestions} 個建議`
                              : "挑出時間衝突與空檔"}
                        </span>
                      </span>
                    </button>
                  </div>
                )}
              >
                {/* 檢查過就在按鈕上留一個點：收進選單後，工具列仍看得出這趟檢查過了 */}
                <button
                  aria-label="AI 功能"
                  aria-haspopup="menu"
                  className="relative inline-flex items-center gap-1 rounded-full text-[12px] font-medium h-7 px-2.5 transition-all duration-200 cursor-pointer"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}
                >
                  <SparkleIcon size={10} /> AI
                  {healthReport && !healthLoading && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{
                        background: healthSuggestions > 0 ? "#fbbf24" : "#4ade80",
                        boxShadow: "0 0 0 2px #09090b",
                      }}
                    />
                  )}
                </button>
              </Dropdown>
              <button
                onClick={handleExportSheet}
                disabled={exporting}
                title="把每日行程匯出成 Google 試算表"
                className="inline-flex items-center gap-1 rounded-full text-[12px] font-medium h-7 px-2.5 bg-white/[0.06] border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {exporting ? <LoadingOutlined style={{ fontSize: 10 }} /> : <SheetIcon size={11} />} 匯出
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
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.category !== cur.category}>
            {({ getFieldValue }) => getFieldValue("category") !== "outdoor" ? null : (
              <div className="flex flex-col gap-1.5 mb-6">
                <div className="flex gap-2">
                  <Form.Item name="distanceKm" label="里程 (km)" className="flex-1 !mb-0">
                    <InputNumber min={0} step={0.1} placeholder="8.5" />
                  </Form.Item>
                  <Form.Item name="ascentM" label="爬升 (m)" className="flex-1 !mb-0">
                    <InputNumber min={0} step={10} precision={0} placeholder="1010" />
                  </Form.Item>
                  <Form.Item name="descentM" label="下降 (m)" className="flex-1 !mb-0">
                    <InputNumber min={0} step={10} precision={0} placeholder="320" />
                  </Form.Item>
                </div>
                <span className="text-zinc-600 text-[11px]">填了途經點之後，這三個數字會改由途經點自動計算</span>
              </div>
            )}
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

      <QuickExpenseModal
        open={!!quickItem}
        tripId={tripId}
        item={quickItem && {
          id: quickItem.id,
          title: quickItem.title,
          date: quickItem.date,
          category: quickItem.category,
        }}
        people={people}
        currency={currency}
        currencies={currencies}
        saving={quickSaving}
        onClose={() => setQuickItem(null)}
        onSubmit={handleQuickExpense}
      />

      {routeItem && (() => {
        /*
          routeItem 只當「開了哪一筆」的指標，顯示用的值一律從 items 取最新的。
          直接讀 routeItem 會停在開啟那一刻的快照 —— 在彈窗內改 show_elevation 時，
          行程卡會更新但彈窗自己不會，因為它讀的是另一份資料。
        */
        const live = items.find((i) => i.id === routeItem.id) ?? routeItem;
        return (
          <RouteProfileModal
            itemId={live.id}
            itemTitle={live.title}
            open
            readOnly={readOnly}
            onClose={() => setRouteItem(null)}
            showElevation={live.show_elevation}
            onShowElevationChange={(value) => {
              setItems((prev) => prev.map((i) => i.id === live.id ? { ...i, show_elevation: value } : i));
            }}
            onSaved={(stats, saved) => {
              setItems((prev) => prev.map((i) => i.id === live.id ? { ...i, ...stats } : i));
              // 卡片的 sparkline 讀的是這份 map，存完要跟著更新
              setWaypointMap((prev) => ({ ...prev, [live.id]: saved }));
            }}
            // 父層已經有整趟的途經點，直接餵給彈窗：省一次載入，也讓分享頁不必打被 RLS 擋掉的 API
            initialWaypoints={waypointsLoaded ? (waypointMap[live.id] ?? []) : undefined}
          />
        );
      })()}
    </>
  );
}
