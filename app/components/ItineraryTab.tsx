"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button, Modal, Form, DatePicker, Select, Dropdown, Typography, Input, Skeleton, Timeline, Tooltip, App } from "antd";
import { EditOutlined, DeleteOutlined, MoreOutlined, LoadingOutlined } from "@ant-design/icons";
import { PlusIcon, CalendarIcon, LocationIcon, CategoryBadge } from "@/app/components/Icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import QuillEditor from "@/app/components/QuillEditor";

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
}

interface WeatherDay {
  code: number;
  maxTemp: number;
  minTemp: number;
}

function wmoEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
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
  { value: "food", label: "🍜 美食" },
  { value: "attraction", label: "🏛 文化景點" },
  { value: "nature", label: "🌿 自然" },
  { value: "shopping", label: "🛍 購物" },
  { value: "experience", label: "🎌 體驗" },
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

export default function ItineraryTab({ tripId, isActive, destination, readOnly, initialItems }: Props) {
  const [items, setItems] = useState<ItineraryItem[]>(initialItems || []);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const [aiGenerating, setAIGenerating] = useState(false);
  const [aiPreview, setAIPreview] = useState<PreviewItem[]>([]);
  const [aiConfirming, setAIConfirming] = useState(false);

  async function fetchItems() {
    const cacheKey = `travel_itinerary_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setItems(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }
    const res = await fetchWithAuth(`/api/itinerary?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      localStorage.setItem(cacheKey, JSON.stringify(data.items));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setLoading(false);
    } else if (isActive) {
      fetchItems();
    }
  }, [tripId, isActive, initialItems]);

  useEffect(() => {
    if (!destination || items.length === 0) return;
    const city = destination.split(/[,，、]/)[0].trim();
    const allDates = items.map((item) => item.date).sort();
    const startDate = allDates[0];
    const endDate = allDates[allDates.length - 1];
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
  }, [destination, items]);

  useEffect(() => {
    if (!isActive || loading) return;
    const todayEl = document.getElementById(`itinerary-date-${todayStr}`);
    if (todayEl) {
      setTimeout(() => todayEl.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [isActive, loading]);

  async function handleSave(values: Record<string, unknown>) {
    setSaving(true);

    const dateRange = values.dateRange as [Dayjs, Dayjs] | null;
    const startDt = dateRange?.[0] ?? null;
    const endDt = dateRange?.[1] ?? null;

    const payload = {
      tripId,
      date: startDt ? startDt.format("YYYY-MM-DD") : "",
      time: startDt ? startDt.format("HH:mm") : null,
      end_date: endDt ? endDt.format("YYYY-MM-DD") : null,
      end_time: endDt ? endDt.format("HH:mm") : null,
      title: values.title,
      category: values.category ?? null,
      location: values.location ?? null,
      notes: (values.notes && values.notes !== "<p><br></p>") ? values.notes as string : null,
    };

    if (editingItem) {
      await fetchWithAuth("/api/itinerary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingItem.id, ...payload }),
      });
    } else {
      await fetchWithAuth("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    closeModal();
    fetchItems();
  }

  async function handleDelete(id: string) {
    await fetchWithAuth("/api/itinerary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchItems();
  }

  function openEdit(item: ItineraryItem) {
    setEditingItem(item);

    const startDate = item.date ? item.date : null;
    const startTime = item.time ?? "00:00";
    const endDate = item.end_date ?? item.date;
    const endTime = item.end_time ?? item.time ?? "00:00";

    const startDt = startDate ? dayjs(`${startDate} ${startTime}`) : null;
    const endDt = endDate ? dayjs(`${endDate} ${endTime}`) : null;

    form.setFieldsValue({
      dateRange: startDt && endDt ? [startDt, endDt] : null,
      title: item.title,
      category: item.category,
      location: item.location,
      notes: item.notes,
    });
    setShowModal(true);
  }

  function openAdd() {
    setEditingItem(null);
    form.resetFields();
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingItem(null);
    form.resetFields();
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
      }
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
        body: JSON.stringify({ action: "generate", pace: aiPace, interests: aiInterests, startTime: aiStartTime, endTime: aiEndTime }),
      });
      if (res.ok) {
        const data = await res.json();
        setAIPreview(data.items ?? []);
        setAIStep("preview");
      }
    } finally {
      setAIGenerating(false);
    }
  }

  async function handleAIConfirm() {
    const toInsert = aiPreview.filter((item) => !item.removed);
    setAIConfirming(true);
    try {
      await Promise.all(
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
          }),
        ),
      );
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

  const timelineItems = dates.map((date) => {
    const isToday = date === todayStr;
    const isPast = date < todayStr;
    const dotColor = isToday ? "#a1a1aa" : isPast ? "#27272a" : "#52525b";

    return {
      key: date,
      color: dotColor,
      content: (
        <div id={`itinerary-date-${date}`} className="mb-5 scroll-mt-4">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap sticky top-[64px] z-20 py-2 backdrop-blur-md">
            <Typography.Text
              className={`text-[13px] font-semibold ${isToday ? "text-violet-400" : isPast ? "text-zinc-600" : "text-zinc-400"
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
                {wmoEmoji(weatherMap[date].code)} {weatherMap[date].maxTemp}° / {weatherMap[date].minTemp}°
              </span>
            )}
          </div>
          {grouped[date].map((item, itemIndex) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.28, ease: "easeOut", delay: itemIndex * 0.05 }}
              className="relative bg-white/[0.03] border border-white/[0.07] rounded-[18px] overflow-hidden mb-2"
              style={{ padding: '12px 14px 12px 18px' }}
            >
              {item.category && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: `linear-gradient(to bottom, ${(CATEGORY_ACCENT[item.category] ?? CATEGORY_ACCENT.other).from}, ${(CATEGORY_ACCENT[item.category] ?? CATEGORY_ACCENT.other).to})` }}
                />
              )}
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {(item.time || item.end_time) && (
                      <span className="text-zinc-500 text-xs shrink-0 tabular-nums">
                        {item.time ?? ""}
                        {(item.end_time || (item.end_date && item.end_date !== item.date)) && (
                          <span className="text-zinc-600">
                            {" → "}
                            {item.end_date && item.end_date !== item.date ? `${item.end_date} ` : ""}
                            {item.end_time ?? ""}
                          </span>
                        )}
                      </span>
                    )}
                    <Typography.Text strong className="text-zinc-100 text-sm">{item.title}</Typography.Text>
                    {item.category && <CategoryBadge category={item.category} />}
                  </div>
                  {item.location && (
                    <div className="text-zinc-500 text-xs mb-0.5 flex items-center gap-1">
                      <LocationIcon size={10} />
                      <Tooltip
                        title={
                          item.location.startsWith("http")
                            ? "在 Google Maps 開啟"
                            : `在 Google Maps 搜尋「${item.location}」`
                        }
                        placement="topLeft"
                        mouseEnterDelay={0.4}
                      >
                        <a
                          href={
                            item.location.startsWith("http")
                              ? item.location
                              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="location-link"
                        >
                          {item.location.startsWith("http") ? "查看地圖" : item.location}
                        </a>
                      </Tooltip>
                    </div>
                  )}
                  {item.notes && (
                    <div
                      className="notes-content text-zinc-500 text-xs mt-1"
                      dangerouslySetInnerHTML={{ __html: processLinks(item.notes) }}
                    />
                  )}
                </div>
                {!readOnly && (
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        { key: "edit", icon: <EditOutlined />, label: "編輯", onClick: () => openEdit(item) },
                        { type: "divider" },
                        {
                          key: "delete", icon: <DeleteOutlined />, label: "刪除", danger: true,
                          onClick: () => modal.confirm({
                            title: "確定刪除這個行程？",
                            okText: "刪除", okType: "danger", cancelText: "取消",
                            onOk: () => handleDelete(item.id),
                          }),
                        },
                      ],
                    }}
                  >
                    <button className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300 transition-colors cursor-pointer shrink-0 ml-1">
                      <MoreOutlined />
                    </button>
                  </Dropdown>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ),
    };
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
                <span style={{ fontSize: 9 }}>✦</span> AI 排程
              </button>
              <button
                onClick={handleHealthCheck}
                disabled={healthLoading}
                className="inline-flex items-center gap-1 rounded-full text-[12px] font-medium h-7 px-2.5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                style={healthReport
                  ? { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#71717a" }}
              >
                {healthLoading ? <LoadingOutlined style={{ fontSize: 10 }} /> : <span>⚕</span>} 健康
              </button>
              <button
                onClick={openAdd}
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
        <div className="mb-4 rounded-[16px] overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">⚕</span>
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
                <span className="text-[13px] shrink-0 mt-0.5">
                  {issue.level === "error" ? "🔴" : issue.level === "warning" ? "🟡" : "🟢"}
                </span>
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
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-[14px] py-4">
              <Skeleton active paragraph={{ rows: 1, width: "60%" }} title={{ width: "30%" }} />
            </div>
          ))}
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
                onClick={openAdd}
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
        <Timeline items={timelineItems} />
      )}

      <Modal
        title={editingItem ? "編輯行程" : "新增行程"}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={520}
        centered={true}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          <Form.Item
            name="dateRange"
            label="開始 → 結束時間"
            rules={[{ required: true, message: "請選擇時間範圍" }]}
          >
            <DatePicker.RangePicker
              className="w-full"
              showTime={{ format: "HH:mm" }}
              format="YYYY-MM-DD HH:mm"
              placeholder={["開始日期 & 時間", "結束日期 & 時間"]}
              minuteStep={5}
            />
          </Form.Item>
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
        title={aiStep === "prefs" ? "✦ AI 幫我排行程" : "✦ AI 行程預覽"}
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

            {items.length > 0 && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <span className="text-sm mt-0.5 shrink-0">ℹ️</span>
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
              {aiGenerating ? <LoadingOutlined /> : <span>✦</span>}
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
                          {wmoEmoji(weatherMap[date].code)} {weatherMap[date].maxTemp}°/{weatherMap[date].minTemp}°
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
