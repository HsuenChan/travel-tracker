"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Layout,
  Button,
  Typography,
  Spin,
  Empty,
  Drawer,
  Tag,
} from "antd";
import { UnorderedListOutlined, PlusOutlined, GlobalOutlined, LogoutOutlined } from "@ant-design/icons";
import AddTripModal from "./components/AddTripModal";
import { getCountryFlags } from "@/lib/countries";

const TripGlobe = dynamic(() => import("./components/TripGlobe"), { ssr: false });

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
}

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [sortKey, setSortKey] = useState<"added" | "date">("added");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) fetchAll();
        else setLoading(false);
      });
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [tripsRes, segsRes] = await Promise.all([
      fetch("/api/sheets"),
      fetch("/api/segments"),
    ]);
    if (tripsRes.ok) setTrips((await tripsRes.json()).trips);
    if (segsRes.ok) setSegments((await segsRes.json()).segments);
    setLoading(false);
  }

  async function fetchTrips() {
    const res = await fetch("/api/sheets");
    if (res.ok) setTrips((await res.json()).trips);
  }

  if (authenticated === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <Typography.Title style={{ color: "#fff", margin: 0 }}>Travel Tracker</Typography.Title>
        <Typography.Text style={{ color: "#71717a" }}>記錄你走過的每一段旅程</Typography.Text>
        <a href="/api/auth/google">
          <Button size="large" style={{ background: "#fff", color: "#09090b", borderColor: "#fff", borderRadius: 24, fontWeight: 600 }}>
            <GoogleIcon /> 使用 Google 登入
          </Button>
        </a>
      </div>
    );
  }

  const tripListContent = loading ? (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <Spin />
    </div>
  ) : trips.length === 0 ? (
    <div style={{ padding: 32 }}>
      <Empty description={<span style={{ color: "#71717a" }}>還沒有旅程記錄</span>}>
        <Button type="primary" onClick={() => { setShowModal(true); setDrawerOpen(false); }}>
          新增第一筆
        </Button>
      </Empty>
    </div>
  ) : (
    <>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #27272a" }}>
        <Typography.Text style={{ color: "#71717a", fontSize: 12, display: "block", marginBottom: 8 }}>
          共 {trips.length} 筆旅程 · 點擊查看路線 · {isMobile ? "長按進入詳情" : "雙擊進入詳情"}
        </Typography.Text>
        <div style={{ display: "flex", gap: 6 }}>
          {(["added", "date"] as const).map((key) => {
            const active = sortKey === key;
            const label = key === "added" ? "新增時間" : "行程日期";
            const arrow = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
            return (
              <button
                key={key}
                onClick={() => {
                  if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
                  else { setSortKey(key); setSortDir("desc"); }
                }}
                style={{
                  flex: 1, padding: "3px 0", fontSize: 11, borderRadius: 6, cursor: "pointer",
                  background: active ? "#1e3a5f" : "#27272a",
                  border: `1px solid ${active ? "#3b82f6" : "#3f3f46"}`,
                  color: active ? "#93c5fd" : "#71717a",
                  transition: "all 0.15s",
                }}
              >
                {label}{arrow}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        {[...trips].sort((a, b) => {
          let cmp = 0;
          if (sortKey === "added") {
            cmp = parseInt(a.ID || "0") - parseInt(b.ID || "0");
          } else {
            cmp = (a["Start Date"] || "").localeCompare(b["Start Date"] || "");
          }
          return sortDir === "asc" ? cmp : -cmp;
        }).map((trip) => {
          const flags = getCountryFlags(trip.Countries);
          const selected = selectedTripId === trip.ID;
          return (
            <div
              key={trip.ID}
              onClick={() => {
                setSelectedTripId((prev) => prev === trip.ID ? null : trip.ID);
                if (isMobile) setDrawerOpen(false);
              }}
              onDoubleClick={!isMobile ? () => router.push(`/trips/${trip.ID}`) : undefined}
              onTouchStart={() => {
                longPressTimer.current = setTimeout(() => {
                  router.push(`/trips/${trip.ID}`);
                }, 500);
              }}
              onTouchEnd={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              onTouchMove={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              style={{ cursor: "pointer", padding: "6px 12px" }}
            >
              <div style={{
                position: "relative",
                background: selected ? "#1e293b" : "#1c1c1e",
                border: `1px solid ${selected ? "#3b82f6" : "#2c2c2e"}`,
                borderRadius: 10,
                padding: "12px 14px",
                transition: "all 0.2s",
              }}>
                {trip["Start Date"] && (
                  <Tag style={{ position: "absolute", top: 8, right: 8, fontSize: 10, lineHeight: "16px", padding: "0 4px" }} color="default">
                    {trip["Start Date"].substring(0, 4)}
                  </Tag>
                )}
                {flags && (
                  <div style={{ fontSize: 20, marginBottom: 6, letterSpacing: 2 }}>{flags}</div>
                )}
                <Typography.Text strong style={{ color: "#f4f4f5", display: "block", fontSize: 13 }}>
                  {trip.Name}
                </Typography.Text>
                {(trip["Start Date"] || trip["End Date"]) && (
                  <Typography.Text style={{ color: "#71717a", fontSize: 11, display: "block", marginTop: 3 }}>
                    {trip["Start Date"]}{trip["End Date"] && ` → ${trip["End Date"]}`}
                  </Typography.Text>
                )}
                {trip.Countries && (
                  <Typography.Text style={{ color: "#52525b", fontSize: 11, display: "block", marginTop: 2 }}>
                    {trip.Countries}
                  </Typography.Text>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <Layout style={{ height: "100vh", background: "#09090b" }}>
      <Layout.Header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #27272a", paddingLeft: isMobile ? 12 : 24, paddingRight: isMobile ? 12 : 24,
      }}>
        <Typography.Text strong style={{ color: "#fff", fontSize: isMobile ? 15 : 18 }}>
          ✈️ Travel Tracker
        </Typography.Text>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            icon={<GlobalOutlined />}
            onClick={() => setShowAllTracks((v) => !v)}
            size={isMobile ? "small" : "middle"}
            type={showAllTracks ? "primary" : "default"}
          >
            {isMobile ? "" : (showAllTracks ? "隱藏航跡" : "全部航跡")}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
            size={isMobile ? "small" : "middle"}
          >
            {isMobile ? "" : "新增旅程"}
          </Button>
          <a href="/api/auth/logout" style={{ display: "flex" }}>
            <Button icon={<LogoutOutlined />} size={isMobile ? "small" : "middle"} title="登出" />
          </a>
        </div>
      </Layout.Header>

      <Layout style={{ flex: 1, overflow: "hidden" }}>
        <Layout.Content style={{ position: "relative" }}>
          <TripGlobe
            trips={trips}
            segments={segments}
            selectedTripId={selectedTripId}
            onTripClick={(id) => setSelectedTripId((prev) => prev === id ? null : id)}
            showAllTracks={showAllTracks}
          />

          {/* 手機版：旅程列表浮動按鈕 */}
          {isMobile && (
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{
                position: "absolute", bottom: 24, right: 16, zIndex: 10,
                background: "rgba(24,24,27,0.92)", borderColor: "#3f3f46",
                color: "#f4f4f5", borderRadius: 24,
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              }}
            >
              旅程列表
            </Button>
          )}
        </Layout.Content>

        {/* 桌面版：側欄 */}
        {!isMobile && (
          <Layout.Sider
            width={300}
            style={{ background: "#18181b", borderLeft: "1px solid #27272a", overflow: "auto" }}
          >
            {tripListContent}
          </Layout.Sider>
        )}
      </Layout>

      {/* 手機版：底部抽屜 */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="bottom"
          height="85vh"
          title={<span style={{ color: "#f4f4f5" }}>我的旅程</span>}
          styles={{
            header: { background: "#18181b", borderBottom: "1px solid #27272a" },
            body: { background: "#18181b", padding: 0, overflowY: "auto" },
          }}
          closeIcon={<span style={{ color: "#a1a1aa" }}>✕</span>}
        >
          {tripListContent}
        </Drawer>
      )}

      {showModal && (
        <AddTripModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchTrips(); }}
        />
      )}
    </Layout>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" style={{ marginRight: 6, verticalAlign: "middle" }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
