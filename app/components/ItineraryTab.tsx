"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Form, DatePicker, Select, Popconfirm, Space, Typography, Tag, Input, Skeleton } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

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

interface Props {
  tripId: string;
}

const CATEGORIES = [
  { value: "transport", label: "🚗 交通" },
  { value: "hotel", label: "🏨 住宿" },
  { value: "food", label: "🍜 餐飲" },
  { value: "attraction", label: "🎡 景點" },
  { value: "shopping", label: "🛍️ 購物" },
  { value: "activity", label: "🏄 活動" },
  { value: "other", label: "📌 其他" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

/** 格式化行程時間範圍顯示 */
function formatTimeRange(item: ItineraryItem): string | null {
  const start = [item.date, item.time].filter(Boolean).join(" ");
  const endDate = item.end_date && item.end_date !== item.date ? item.end_date : null;
  const end = [endDate, item.end_time].filter(Boolean).join(" ");
  if (!start && !end) return null;
  if (!end) return item.time ?? item.date;
  return `${item.time ?? ""}${item.time ? " " : ""}→ ${end}`;
}

export default function ItineraryTab({ tripId }: Props) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchItems() {
    setLoading(true);
    const res = await fetch(`/api/itinerary?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, [tripId]);

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
      notes: values.notes ?? null,
    };

    if (editingItem) {
      await fetch("/api/itinerary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingItem.id, ...payload }),
      });
    } else {
      await fetch("/api/itinerary", {
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
    await fetch("/api/itinerary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchItems();
  }

  function openEdit(item: ItineraryItem) {
    setEditingItem(item);

    // 組合 start / end 為 RangePicker 的值
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

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Typography.Text strong className="text-zinc-100 text-[15px]">每日行程</Typography.Text>
        <Button icon={<PlusOutlined />} size="small" onClick={openAdd}>新增行程</Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-[14px] py-4">
              <Skeleton active paragraph={{ rows: 1, width: "60%" }} title={{ width: "30%" }} />
            </div>
          ))}
        </div>
      ) : dates.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-10 pb-8 bg-[#111113] border border-dashed border-[#27272a] rounded-xl">
          <span className="text-4xl">🗓️</span>
          <Typography.Text className="text-zinc-600 text-sm">還沒有行程安排</Typography.Text>
          <Button size="small" icon={<PlusOutlined />} onClick={openAdd} className="mt-1">
            新增第一個行程
          </Button>
        </div>
      ) : (
        dates.map((date) => (
          <div key={date} className="mb-6">
            <div className="mb-2.5 pb-1.5 border-b border-[#27272a]">
              <Typography.Text className="text-zinc-400 text-[13px] font-semibold">{date}</Typography.Text>
            </div>
            {grouped[date].map((item) => (
              <div key={item.id} className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-[14px] py-3 mb-2">
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
                      {item.category && (
                        <Tag className="!rounded-md !m-0 !text-xs">
                          {CATEGORY_MAP[item.category] ?? item.category}
                        </Tag>
                      )}
                    </div>
                    {item.location && (
                      <div className="text-zinc-500 text-xs mb-0.5">📍 {item.location}</div>
                    )}
                    {item.notes && (
                      <div className="text-zinc-600 text-xs whitespace-pre-wrap">{item.notes}</div>
                    )}
                  </div>
                  <Space size={2} className="shrink-0 ml-2">
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} />
                    <Popconfirm
                      title="確定刪除這個行程？"
                      onConfirm={() => handleDelete(item.id)}
                      okText="刪除" cancelText="取消" okButtonProps={{ danger: true }}
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      <Modal
        title={editingItem ? "編輯行程" : "新增行程"}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={520}
        styles={{ wrapper: { paddingBottom: 32 } }}
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
            <Input placeholder="例如：東京都台東區淺草" />
          </Form.Item>
          <Form.Item name="notes" label="備注">
            <Input.TextArea rows={2} />
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
