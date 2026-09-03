"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Input, InputNumber, Select, App, Skeleton } from "antd";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceArea, ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts";
import PillButton from "./PillButton";
import { PlusIcon, TrashIcon, MountainIcon } from "@/app/components/Icons";

export interface Waypoint {
  id?: string;
  name: string;
  elevation_m: number | null;
  distance_km: number | null;
  day_offset: number;
  duration_out_min: number | null;
  duration_back_min: number | null;
  type: string | null;
}

const WAYPOINT_TYPES = [
  { value: "trailhead", label: "登山口" },
  { value: "peak", label: "山頂" },
  { value: "hut", label: "山屋" },
  { value: "camp", label: "營地" },
  { value: "water", label: "水源" },
  { value: "junction", label: "岔路" },
  { value: "other", label: "其他" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(WAYPOINT_TYPES.map(t => [t.value, t.label]));

/** 會標名字在高度圖上的點位；其他點只畫節點，避免密集路線標籤糊成一片 */
const LABELLED_TYPES = new Set(["trailhead", "peak", "hut", "camp"]);

/** 天數色帶：呼應時間軸「第 N 天」的分段，最多輪替這幾色 */
const DAY_BANDS = ["rgba(139,92,246,0.07)", "rgba(56,189,248,0.07)", "rgba(52,211,153,0.07)", "rgba(251,191,36,0.07)"];

function fmtMinutes(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}小時` : `${h}小時${m}分`;
}

function emptyWaypoint(): Waypoint {
  return { name: "", elevation_m: null, distance_km: null, day_offset: 0, duration_out_min: null, duration_back_min: null, type: null };
}

export default function RouteProfileModal({
  itemId,
  itemTitle,
  open,
  onClose,
  onSaved,
  readOnly = false,
  initialWaypoints,
}: {
  itemId: string;
  itemTitle: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (stats: { distance_km: number | null; ascent_m: number | null; descent_m: number | null }) => void;
  readOnly?: boolean;
  /** 唯讀分享頁用：RLS 只放行旅程成員，資料由 /api/share/[token] 帶進來 */
  initialWaypoints?: Waypoint[];
}) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints ?? []);
  const [loading, setLoading] = useState(!initialWaypoints);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Waypoint[]>([]);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/itinerary/waypoints?itineraryItemId=${itemId}`);
    if (res.ok) {
      const data = await res.json();
      setWaypoints(data.waypoints);
    }
    setLoading(false);
  }

  // 這個 Modal 由父層條件掛載（關閉時整個卸載），所以每次打開都是全新的 state，不用手動重設
  useEffect(() => {
    if (initialWaypoints) {
      setWaypoints(initialWaypoints);
      setLoading(false);
      return;
    }
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId, initialWaypoints]);

  const stats = useMemo(() => {
    const withElevation = waypoints.filter(w => w.elevation_m !== null);
    let ascent = 0, descent = 0;
    for (let i = 1; i < withElevation.length; i++) {
      const d = (withElevation[i].elevation_m ?? 0) - (withElevation[i - 1].elevation_m ?? 0);
      if (d > 0) ascent += d; else descent -= d;
    }
    const distances = waypoints.map(w => w.distance_km).filter((d): d is number => d !== null);
    const outMin = waypoints.reduce((s, w) => s + (w.duration_out_min ?? 0), 0);
    const backMin = waypoints.reduce((s, w) => s + (w.duration_back_min ?? 0), 0);
    const days = waypoints.length > 0 ? Math.max(...waypoints.map(w => w.day_offset)) + 1 : 0;
    return {
      distance: distances.length > 0 ? Math.max(...distances) : null,
      ascent: withElevation.length >= 2 ? Math.round(ascent) : null,
      descent: withElevation.length >= 2 ? Math.round(descent) : null,
      outMin,
      backMin,
      days,
    };
  }, [waypoints]);

  /**
   * 累積距離齊全時用距離當 X 軸（間距才會反映真實路程），有缺就退回等距索引，
   * 至少還能看出高低起伏的順序。
   */
  const hasDistances = waypoints.length > 1 && waypoints.every(w => w.distance_km !== null);
  const chartData = useMemo(() => waypoints.map((w, i) => ({
    x: hasDistances ? (w.distance_km as number) : i,
    elevation: w.elevation_m,
    name: w.name,
    day: w.day_offset,
    type: w.type,
  })), [waypoints, hasDistances]);

  /** 每一天在 X 軸上的起訖，用來畫背景色帶 */
  const dayRanges = useMemo(() => {
    const ranges = new Map<number, { from: number; to: number }>();
    chartData.forEach((d) => {
      const cur = ranges.get(d.day);
      if (!cur) ranges.set(d.day, { from: d.x, to: d.x });
      else ranges.set(d.day, { from: Math.min(cur.from, d.x), to: Math.max(cur.to, d.x) });
    });
    return Array.from(ranges.entries()).sort((a, b) => a[0] - b[0]);
  }, [chartData]);

  const plottable = chartData.filter(d => d.elevation !== null).length >= 2;

  function startEdit() {
    setDraft(waypoints.length > 0 ? waypoints.map(w => ({ ...w })) : [emptyWaypoint()]);
    setEditing(true);
  }

  function updateDraft(index: number, patch: Partial<Waypoint>) {
    setDraft(prev => prev.map((w, i) => i === index ? { ...w, ...patch } : w));
  }

  async function handleSave() {
    const rows = draft.filter(w => w.name.trim() !== "");
    setSaving(true);
    const res = await fetch(`/api/itinerary/waypoints`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itineraryItemId: itemId, waypoints: rows }),
    });
    setSaving(false);
    if (!res.ok) {
      message.error("途經點儲存失敗");
      return;
    }
    const data = await res.json();
    setWaypoints(data.waypoints ?? []);
    setEditing(false);
    onSaved?.({ distance_km: data.distance_km, ascent_m: data.ascent_m, descent_m: data.descent_m });
    message.success(rows.length === 0 ? "已清空途經點" : `已儲存 ${rows.length} 個途經點`);
  }

  return (
    <Modal
      title={`路線 · ${itemTitle}`}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={720}
    >
      {loading ? (
        <div className="mt-6"><Skeleton active paragraph={{ rows: 4 }} title={false} /></div>
      ) : editing ? (
        <div className="flex flex-col gap-3 mt-6">
          <div className="text-zinc-500 text-[12px] leading-relaxed">
            照走的順序填。累積距離是從起點算起的公里數；去程／返程分鐘數指的是「從上一個點走到這個點」花的時間，所以第一個點通常留空。
          </div>

          <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto pr-1">
            {draft.map((w, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600 text-[11px] tabular-nums w-4 shrink-0">{i + 1}</span>
                  <Input
                    placeholder="點位名稱（如：三六九山莊）"
                    value={w.name}
                    onChange={e => updateDraft(i, { name: e.target.value })}
                    className="rounded-lg! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-9!"
                  />
                  <button
                    onClick={() => setDraft(prev => prev.filter((_, k) => k !== i))}
                    aria-label="刪除這個點"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6">
                  <InputNumber
                    min={0} step={10} precision={0} addonAfter="m"
                    placeholder="海拔"
                    value={w.elevation_m}
                    onChange={v => updateDraft(i, { elevation_m: v })}
                  />
                  <InputNumber
                    min={0} step={0.1} addonAfter="km"
                    placeholder="累積距離"
                    value={w.distance_km}
                    onChange={v => updateDraft(i, { distance_km: v })}
                  />
                  <InputNumber
                    min={0} step={5} precision={0} addonAfter="分"
                    placeholder="去程"
                    value={w.duration_out_min}
                    onChange={v => updateDraft(i, { duration_out_min: v })}
                  />
                  <InputNumber
                    min={0} step={5} precision={0} addonAfter="分"
                    placeholder="返程"
                    value={w.duration_back_min}
                    onChange={v => updateDraft(i, { duration_back_min: v })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <Select
                    allowClear
                    placeholder="點位類型"
                    value={w.type ?? undefined}
                    onChange={v => updateDraft(i, { type: v ?? null })}
                    options={WAYPOINT_TYPES}
                    className="cute-select"
                  />
                  <Select
                    placeholder="第幾天"
                    value={w.day_offset}
                    onChange={v => updateDraft(i, { day_offset: v })}
                    options={Array.from({ length: 8 }, (_, d) => ({ value: d, label: `第 ${d + 1} 天` }))}
                    className="cute-select"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <PillButton onClick={() => setDraft(prev => [...prev, emptyWaypoint()])}>
              <PlusIcon size={13} />
              加一個點
            </PillButton>
            <div className="flex gap-2">
              <PillButton onClick={() => setEditing(false)} disabled={saving}>取消</PillButton>
              <PillButton variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "儲存中" : "儲存"}
              </PillButton>
            </div>
          </div>
        </div>
      ) : waypoints.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-14 mt-6 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <MountainIcon size={26} stroke="#34d399" strokeWidth={1.6} />
          </div>
          <div className="text-center">
            <div className="text-zinc-200 font-medium mb-1">還沒有途經點</div>
            <div className="text-zinc-500 text-xs px-8 leading-relaxed">
              依序填入登山口、山屋、山頂的海拔與累積距離，就能畫出這段路線的高度圖。
            </div>
          </div>
          {!readOnly && (
            <PillButton variant="primary" onClick={startEdit}>
              <PlusIcon size={13} />
              建立途經點
            </PillButton>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-6">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4">
              {([
                { label: "里程", value: stats.distance === null ? "—" : `${stats.distance} km` },
                { label: "總爬升", value: stats.ascent === null ? "—" : `+${stats.ascent} m` },
                { label: "總下降", value: stats.descent === null ? "—" : `−${stats.descent} m` },
              ]).map(({ label, value }) => (
                <div key={label}>
                  <div className="text-zinc-500 text-[11px] mb-0.5">{label}</div>
                  <div className="text-zinc-100 text-[17px] leading-none font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
            {!readOnly && (
              <PillButton onClick={startEdit}>編輯途經點</PillButton>
            )}
          </div>

          {plottable ? (
            <>
              <div className="h-[220px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="route-elevation" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    {dayRanges.length > 1 && dayRanges.map(([day, range], i) => (
                      <ReferenceArea
                        key={day}
                        x1={range.from}
                        x2={range.to}
                        fill={DAY_BANDS[i % DAY_BANDS.length]}
                        stroke="none"
                        label={{ value: `第 ${day + 1} 天`, position: "insideTop", fill: "#71717a", fontSize: 10 }}
                      />
                    ))}
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickFormatter={(v: number) => hasDistances ? `${v} km` : ""}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <YAxis
                      orientation="right"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickFormatter={(v: number) => `${v}m`}
                      width={46}
                      stroke="rgba(255,255,255,0.1)"
                      domain={["dataMin - 100", "dataMax + 100"]}
                    />
                    <ChartTooltip content={<RouteTooltip />} />
                    <Area
                      type="linear"
                      dataKey="elevation"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      fill="url(#route-elevation)"
                      dot={{ r: 2.5, fill: "#c4b5fd", stroke: "none" }}
                      activeDot={{ r: 4.5, fill: "#ddd6fe", stroke: "none" }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 標名字的重點點位：山頂、山屋、營地、登山口 */}
              <div className="flex flex-wrap gap-1.5">
                {waypoints
                  .filter(w => w.type && LABELLED_TYPES.has(w.type))
                  .map((w, i) => (
                    <span
                      key={`${w.name}-${i}`}
                      className="text-[11px] px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 tabular-nums"
                    >
                      {w.name}
                      {w.elevation_m !== null && <span className="text-zinc-500"> {w.elevation_m}m</span>}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <div className="py-8 rounded-2xl border border-dashed border-white/10 text-center text-zinc-500 text-[13px] leading-relaxed">
              至少要有兩個點填了海拔才畫得出高度圖。
            </div>
          )}

          {/* 去程／返程時間帶：對照上河地形圖那兩排時間 */}
          {(stats.outMin > 0 || stats.backMin > 0) && (
            <div className="flex flex-col gap-1.5">
              {([
                { label: "去程", total: stats.outMin, key: "duration_out_min" as const, bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)" },
                { label: "返程", total: stats.backMin, key: "duration_back_min" as const, bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.25)" },
              ]).filter(row => row.total > 0).map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[11px] w-8 shrink-0">{row.label}</span>
                  <div className="flex-1 flex gap-0.5 min-w-0">
                    {waypoints.slice(1).map((w, i) => {
                      const min = w[row.key] ?? 0;
                      if (min <= 0) return null;
                      return (
                        <div
                          key={i}
                          title={`${waypoints[i].name} → ${w.name}`}
                          className="h-6 rounded-md flex items-center justify-center text-[10px] text-zinc-300 tabular-nums overflow-hidden whitespace-nowrap px-1"
                          style={{ flexGrow: min, flexBasis: 0, background: row.bg, border: `1px solid ${row.border}` }}
                        >
                          {fmtMinutes(min)}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-zinc-400 text-[11px] shrink-0 tabular-nums">{fmtMinutes(row.total)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-zinc-600 text-[11px]">
            {waypoints.length} 個點{stats.days > 1 ? ` · ${stats.days} 天` : ""}
            {!hasDistances && waypoints.length > 1 ? " · 有點位沒填累積距離，X 軸改用等距排列" : ""}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** 自訂 tooltip：點位名稱在上、海拔在下，比預設的 series 名稱好讀 */
function RouteTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload?: { name?: string; type?: string | null; elevation?: number | null } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1c1c1f] px-2.5 py-1.5 text-[12px] shadow-lg">
      <div className="text-zinc-100 font-medium">
        {p.name}
        {p.type ? `（${TYPE_LABEL[p.type] ?? p.type}）` : ""}
      </div>
      {p.elevation != null && <div className="text-zinc-400 tabular-nums">{p.elevation} m</div>}
    </div>
  );
}
