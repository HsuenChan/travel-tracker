"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button, Modal, Form, DatePicker, Select, Dropdown, Typography, Input, Skeleton, Timeline, Tooltip } from "antd";
import { EditOutlined, DeleteOutlined, MoreOutlined } from "@ant-design/icons";
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

interface Props {
  tripId: string;
  isActive?: boolean;
  destination?: string;
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

export default function ItineraryTab({ tripId, isActive, destination }: Props) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherDay>>({});

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
    fetchItems();
  }, [tripId]);

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
      .catch(() => {});
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
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
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
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: [
                      { key: "edit", icon: <EditOutlined />, label: "編輯", onClick: () => openEdit(item) },
                      { type: "divider" },
                      {
                        key: "delete", icon: <DeleteOutlined />, label: "刪除", danger: true,
                        onClick: () => Modal.confirm({
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
              </div>
            </motion.div>
          ))}
        </div>
      ),
    };
  });

  return (
    <>
      <div className="my-3 flex items-center justify-between">
        <Typography.Text strong className="text-zinc-100 text-[15px]">每日行程</Typography.Text>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
        >
          <PlusIcon size={12} />
          新增行程
        </button>
      </div>

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
          className="flex flex-col items-center gap-3 py-12 pb-10 rounded-2xl border border-white/[0.06]"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.06) 0%, transparent 65%), rgba(9,9,11,0.6)' }}
        >
          <div
            className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.18)' }}
          >
            <CalendarIcon size={26} stroke="#a78bfa" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Typography.Text className="text-zinc-300 text-sm font-medium">還沒有行程安排</Typography.Text>
            <Typography.Text className="text-zinc-600 text-xs">把每一天規劃好，旅程會更從容。</Typography.Text>
          </div>
          <button
            onClick={openAdd}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <PlusIcon size={12} />
            新增第一個行程
          </button>
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
    </>
  );
}
