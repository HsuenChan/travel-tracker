"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Layout, Button, Typography, Descriptions,
  Spin, Popconfirm, Space, Tag, Timeline, Empty,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined,
  PictureOutlined, PlusOutlined, FormOutlined,
} from "@ant-design/icons";
import EditTripModal from "@/app/components/EditTripModal";
import AddSegmentModal from "@/app/components/AddSegmentModal";
import EditSegmentModal from "@/app/components/EditSegmentModal";

interface Trip {
  ID: string;
  Name: string;
  "Start Date": string;
  "End Date": string;
  Countries: string;
  Notes: string;
  "Photo Album ID": string;
}

interface Segment {
  ID: string;
  "Trip ID": string;
  Order: string;
  From: string;
  "From IATA": string;
  To: string;
  "To IATA": string;
  Type: string;
  Date: string;
  Time: string;
  "Flight No": string;
  Aircraft: string;
}

import { toTransportKey, VEHICLE_ICON } from "@/lib/transport";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddSegment, setShowAddSegment] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
      setTrip(data.trips.find((t: Trip) => t.ID === id) ?? null);
    }
  }

  async function fetchSegments() {
    const res = await fetch(`/api/segments?tripId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setSegments(data.segments);
    }
  }

  useEffect(() => {
    Promise.all([fetchTrip(), fetchSegments()]).finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Typography.Text style={{ color: "#71717a" }}>找不到這筆旅程</Typography.Text>
        <Button onClick={() => router.push("/")}>返回首頁</Button>
      </div>
    );
  }

  const countries = trip.Countries
    ? trip.Countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
    : [];

  const timelineItems = segments.map((seg) => ({
    key: seg.ID,
    color: "blue",
    children: (
      <div style={{ background: "#1c1c1e", border: "1px solid #2c2c2e", borderRadius: 10, padding: "12px 14px", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Space>
            <span style={{ fontSize: 18 }}>{VEHICLE_ICON[toTransportKey(seg.Type)]}</span>
            <Typography.Text strong style={{ color: "#f4f4f5" }}>
              {seg.From}
              {seg["From IATA"] && <Tag color="default" style={{ marginLeft: 4, fontSize: 10 }}>{seg["From IATA"]}</Tag>}
              {" → "}
              {seg.To}
              {seg["To IATA"] && <Tag color="default" style={{ marginLeft: 4, fontSize: 10 }}>{seg["To IATA"]}</Tag>}
            </Typography.Text>
          </Space>
          <Space size={2}>
            <Button type="text" size="small" icon={<FormOutlined />} onClick={() => setEditingSegment(seg)} />
            <Popconfirm
              title="確定刪除這段交通？"
              onConfirm={() => handleDeleteSegment(seg.ID)}
              okText="刪除" cancelText="取消" okButtonProps={{ danger: true }}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
        <Space wrap size={4}>
          {seg.Date && <Tag color="geekblue">{seg.Date}{seg.Time && ` ${seg.Time}`}</Tag>}
          {seg["Flight No"] && <Tag color="purple">{seg["Flight No"]}</Tag>}
          {seg.Aircraft && <Tag color="cyan">{seg.Aircraft}</Tag>}
        </Space>
      </div>
    ),
  }));

  return (
    <Layout style={{ minHeight: "100vh", background: "#09090b" }}>
      <Layout.Header style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16, borderBottom: "1px solid #27272a", paddingLeft: isMobile ? 8 : 24, paddingRight: isMobile ? 8 : 24 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" style={{ color: "#a1a1aa", flexShrink: 0 }} onClick={() => router.push("/")} />
        <Typography.Text strong style={{ color: "#fff", fontSize: isMobile ? 14 : 18, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {trip.Name}
        </Typography.Text>
        <Space size={isMobile ? 4 : 8}>
          <Button icon={<EditOutlined />} size={isMobile ? "small" : "middle"} onClick={() => setShowEdit(true)}>
            {!isMobile && "編輯"}
          </Button>
          <Popconfirm title="確定要刪除這筆旅程嗎？" onConfirm={handleDelete} okText="刪除" cancelText="取消" okButtonProps={{ danger: true, loading: deleting }}>
            <Button danger icon={<DeleteOutlined />} size={isMobile ? "small" : "middle"}>
              {!isMobile && "刪除"}
            </Button>
          </Popconfirm>
        </Space>
      </Layout.Header>

      <Layout.Content style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "20px 12px 60px" : "40px 24px 80px", width: "100%" }}>
        <Descriptions
          bordered column={1}
          styles={{
            label: { color: "#a1a1aa", width: 120, background: "#18181b" },
            content: { color: "#f4f4f5", background: "#09090b" },
          }}
          style={{ marginBottom: 32 }}
        >
          {trip["Start Date"] && <Descriptions.Item label="出發日期">{trip["Start Date"]}</Descriptions.Item>}
          {trip["End Date"] && <Descriptions.Item label="結束日期">{trip["End Date"]}</Descriptions.Item>}
          {countries.length > 0 && (
            <Descriptions.Item label="國家 / 地區">
              <Space wrap>{countries.map((c) => <Tag key={c} color="blue">{c}</Tag>)}</Space>
            </Descriptions.Item>
          )}
          {trip.Notes && (
            <Descriptions.Item label="備注">
              <span style={{ whiteSpace: "pre-wrap" }}>{trip.Notes}</span>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* 交通段落 */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography.Text strong style={{ color: "#f4f4f5", fontSize: 15 }}>交通段落</Typography.Text>
          <Button icon={<PlusOutlined />} size="small" onClick={() => setShowAddSegment(true)}>新增段落</Button>
        </div>

        {segments.length === 0 ? (
          <Empty description={<span style={{ color: "#71717a" }}>還沒有交通記錄</span>} style={{ padding: "24px 0" }}>
            <Button onClick={() => setShowAddSegment(true)}>新增第一段</Button>
          </Empty>
        ) : (
          <Timeline items={timelineItems} />
        )}

        {trip["Photo Album ID"] && (
          <div style={{ marginTop: 32 }}>
            <a href={trip["Photo Album ID"]} target="_blank" rel="noopener noreferrer">
              <Button icon={<PictureOutlined />} size="large" block>查看 Google Photos 相簿</Button>
            </a>
          </div>
        )}
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
