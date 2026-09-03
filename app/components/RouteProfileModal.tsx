"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Input, InputNumber, Select, App, Skeleton, Tooltip } from "antd";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceArea, ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts";
import PillButton from "./PillButton";
import { PlusIcon, TrashIcon, MountainIcon, InfoIcon, ArrowUpIcon, ArrowDownIcon, UploadIcon } from "@/app/components/Icons";
import { parseCoordPair } from "@/lib/coords";
import GpxImportModal, { type ImportedWaypoint } from "@/app/components/GpxImportModal";
import { decideElevationDisplay } from "@/lib/elevationDisplay";

export interface Waypoint {
  id?: string;
  name: string;
  elevation_m: number | null;
  distance_km: number | null;
  day_offset: number;
  duration_min: number | null;
  type: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  /** 編輯中的座標原始輸入（可能是還沒解析的 Google Maps 連結）；不會存進資料庫 */
  coordText?: string;
  /** 編輯中的「這一段走多遠」；存回資料庫時會累加成 distance_km */
  legKm?: number | null;
  /**
   * 編輯期的穩定身分，給 React key 用。
   * 用陣列索引當 key 的話，上下移動時 key 的順序不變，framer-motion 認不出那是移動、不會有動畫。
   * 不會存進資料庫（API 只挑它認得的欄位）。
   */
  uid?: string;
}

/**
 * 點位類型。溪降那組對應紐西蘭 CanyonTopo 的圖例（R 垂降編號、J 跳水、S 滑降、SW 泳渡、
 * UC/DC 上下攀、dangerous hydraulic / undercut / sieve 等危險標記、Exits、flow gauge）。
 * 分組是因為攤平會有二十幾個選項，難找。
 *
 * 刻意不收進來的：TR/TL（左右岸）、SL（安全繩）、CW（溪行）—— 那些是路段的屬性或移動方式，
 * 不是一個點位，寫在該點的備註裡（編輯器有常用註記快捷鍵）。
 */
const WAYPOINT_TYPE_GROUPS = [
  {
    label: "通用",
    options: [
      { value: "junction", label: "岔路" },
      { value: "hut", label: "山屋" },
      { value: "camp", label: "營地" },
      { value: "water", label: "水源" },
      { value: "other", label: "其他" },
    ],
  },
  {
    label: "登山",
    options: [
      { value: "trailhead", label: "登山口" },
      { value: "peak", label: "山頂" },
      { value: "pass", label: "鞍部" },
    ],
  },
  {
    label: "溪降",
    options: [
      { value: "put_in", label: "入溪點" },
      { value: "take_out", label: "出溪點" },
      { value: "rappel", label: "垂降點" },
      { value: "anchor", label: "固定點" },
      { value: "pool", label: "深潭" },
      { value: "jump", label: "跳水點" },
      { value: "slide", label: "滑降點" },
      { value: "swim", label: "泳渡段" },
      { value: "downclimb", label: "下攀" },
      { value: "upclimb", label: "上攀" },
      { value: "hazard", label: "危險點" },
      { value: "exit", label: "脫逃點" },
      { value: "gauge", label: "水位計" },
    ],
  },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  WAYPOINT_TYPE_GROUPS.flatMap(g => g.options).map(t => [t.value, t.label])
);

/** 清單裡需要跳出來的類型：危險點與脫逃點是「絕對不能漏看」的兩類 */
const ROW_ACCENT: Record<string, { border: string; bg: string; text: string }> = {
  hazard: { border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.07)", text: "#fca5a5" },
  exit:   { border: "rgba(52,211,153,0.35)",  bg: "rgba(52,211,153,0.07)",  text: "#6ee7b7" },
};

/** 備註的常用註記：CanyonTopo 圖例裡屬於「路段屬性」而非點位類型的那些 */
const NOTE_CHIPS = [
  "右岸 TR", "左岸 TL",
  "岩栓", "可回收岩栓", "繩環固定點", "樹木固定點",
  "危險迴流", "底切", "篩", "翻越點",
  "溪行 CW", "安全繩 SL",
];

/** 天數色帶：呼應時間軸「第 N 天」的分段，最多輪替這幾色 */
const DAY_BANDS = ["rgba(139,92,246,0.07)", "rgba(56,189,248,0.07)", "rgba(52,211,153,0.07)", "rgba(251,191,36,0.07)"];

function fmtMinutes(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}小時` : `${h}小時${m}分`;
}

/** 上下移動時的位移動畫。easing 沿用專案既有的 LAYOUT_TRANSITION，時間縮短成相鄰互換的尺度 */
const ROW_TRANSITION = { type: "tween" as const, duration: 0.26, ease: [0.2, 0, 0, 1] as const };

/** 編輯途經點的填寫說明；顯示在 Modal 標題的 info icon tooltip 裡 */
const EDITOR_HINT = "照走的順序填。距離與時間都填「這一段」的量（從上一個點到這個點），累積值由系統算給你看，所以第一個點通常留空。座標欄可以貼「緯度, 經度」或 Google Maps 連結，填好按「自動填海拔」就會查出該點的地形高度（不會覆蓋已經填過的海拔）。";

/** 比較用：只取會存進資料庫的欄位，避免 coordText / legKm 這種編輯期狀態造成假髒 */
function normalizeForCompare(rows: Waypoint[]): string {
  return JSON.stringify(rows.map(w => ({
    name: w.name.trim(),
    elevation_m: w.elevation_m ?? null,
    distance_km: w.distance_km ?? null,
    day_offset: w.day_offset ?? 0,
    duration_min: w.duration_min ?? null,
    type: w.type ?? null,
    notes: w.notes ?? null,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
  })));
}

let uidCounter = 0;
/** randomUUID 需要 secure context；localhost 算，但還是留一條退路 */
function newUid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    uidCounter += 1;
    return `wp-${Date.now()}-${uidCounter}`;
  }
}

/** 補上缺少的 uid —— 舊版存下來的草稿沒有這個欄位 */
function withUid(rows: Waypoint[]): Waypoint[] {
  return rows.map(w => (w.uid ? w : { ...w, uid: newUid() }));
}

function emptyWaypoint(): Waypoint {
  return { uid: newUid(), name: "", elevation_m: null, distance_km: null, day_offset: 0, duration_min: null, type: null, notes: null, lat: null, lng: null, legKm: null };
}

export default function RouteProfileModal({
  itemId,
  itemTitle,
  open,
  onClose,
  onSaved,
  readOnly = false,
  initialWaypoints,
  showElevation,
  onShowElevationChange,
}: {
  itemId: string;
  itemTitle: string;
  open: boolean;
  onClose: () => void;
  /** 存檔後回報：統計給 hero 用，存好的途經點給行程卡的 sparkline 用 */
  onSaved?: (stats: { distance_km: number | null; ascent_m: number | null; descent_m: number | null }, saved: Waypoint[]) => void;
  readOnly?: boolean;
  /** 唯讀分享頁用：RLS 只放行旅程成員，資料由 /api/share/[token] 帶進來 */
  initialWaypoints?: Waypoint[];
  /** null = 自動判斷；true/false = 使用者對這條路線的明確設定 */
  showElevation?: boolean | null;
  /** 改變設定後回報，讓行程卡的 sparkline 跟著更新 */
  onShowElevationChange?: (value: boolean | null) => void;
}) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints ?? []);
  const [loading, setLoading] = useState(!initialWaypoints);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Waypoint[]>([]);
  const [saving, setSaving] = useState(false);
  // 常用註記只在「正在編輯備註的那一列」展開，否則每列都掛一排 chip 會太吵
  const [chipsRow, setChipsRow] = useState<number | null>(null);
  const [fillingElevation, setFillingElevation] = useState(false);
  const [gpxOpen, setGpxOpen] = useState(false);
  const [togglingElevation, setTogglingElevation] = useState(false);
  // 進入編輯時的基準快照，用來判斷有沒有未儲存變更
  const [editBaseline, setEditBaseline] = useState<string>("");

  const draftKey = `travel_waypoints_draft_${itemId}`;
  const { message, modal } = App.useApp();

  /**
   * 分段距離累加成累積距離。
   * 全部沒填時回傳一整排 null —— 讓高度圖退回等距排列，而不是把所有點疊在 x=0。
   * 有填但中間漏一段時，那一段以 0 計，總距離不會憑空多出來。
   */
  const cumulative = useMemo(() => {
    const anyDistance = draft.some(w => w.legKm != null);
    if (!anyDistance) return draft.map(() => null);
    let running = 0;
    return draft.map((w) => {
      running += w.legKm ?? 0;
      return Math.round(running * 1000) / 1000;
    });
  }, [draft]);

  /** 到這個點為止的累計時間 */
  const cumulativeMin = useMemo(() => {
    let running = 0;
    return draft.map((w) => {
      running += w.duration_min ?? 0;
      return running;
    });
  }, [draft]);

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
    const totalMin = waypoints.reduce((s, w) => s + (w.duration_min ?? 0), 0);
    const days = waypoints.length > 0 ? Math.max(...waypoints.map(w => w.day_offset)) + 1 : 0;
    return {
      distance: distances.length > 0 ? Math.max(...distances) : null,
      ascent: withElevation.length >= 2 ? Math.round(ascent) : null,
      descent: withElevation.length >= 2 ? Math.round(descent) : null,
      totalMin,
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
    notes: w.notes,
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

  // 與行程卡的 sparkline 共用同一個判斷
  const elevationDecision = decideElevationDisplay(waypoints, showElevation);
  const plottable = elevationDecision.show && chartData.filter(d => d.elevation !== null).length >= 2;

  /**
   * 顯示與否存在 itinerary_items 上而不是瀏覽器 ——「這張圖有沒有參考價值」是路線資料的
   * 性質，不是看的人的偏好，旅伴應該看到一樣的結果。
   */
  async function setShowElevation(value: boolean | null) {
    setTogglingElevation(true);
    try {
      const res = await fetch(`/api/itinerary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, show_elevation: value }),
      });
      if (!res.ok) throw new Error();
      onShowElevationChange?.(value);
    } catch {
      message.error("設定失敗，請再試一次");
    } finally {
      setTogglingElevation(false);
    }
  }

  /** 累積距離反算成分段（資料庫存累積，編輯填分段） */
  function toLegRows(rows: Waypoint[]): Waypoint[] {
    let prevCum: number | null = null;
    return rows.map((w) => {
      const cum = w.distance_km;
      let legKm: number | null = null;
      if (cum != null) legKm = prevCum == null ? cum : Math.round((cum - prevCum) * 1000) / 1000;
      if (cum != null) prevCum = cum;
      return { ...w, legKm, uid: w.uid ?? newUid() };
    });
  }

  function startEdit() {
    const serverRows = toLegRows(waypoints);
    setEditBaseline(normalizeForCompare(waypoints));

    // 上次沒存完的編輯優先還原（與筆記分頁同一套做法）
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Waypoint[];
        if (Array.isArray(parsed) && parsed.length > 0
            && normalizeForCompare(parsed) !== normalizeForCompare(waypoints)) {
          setDraft(withUid(parsed));
          setEditing(true);
          message.info("已還原上次未儲存的草稿");
          return;
        }
      }
    } catch {
      // 草稿壞了就當作沒有，不要卡住編輯
    }

    if (waypoints.length === 0) {
      setDraft([emptyWaypoint()]);
      setEditing(true);
      return;
    }
    setDraft(serverRows);
    setEditing(true);
  }

  /** 編輯中的內容與進入編輯時不同 */
  const dirty = editing && normalizeForCompare(
    draft.map((w, i) => ({ ...w, distance_km: cumulative[i] }))
  ) !== editBaseline;

  /**
   * 有未儲存變更才擋，沒改就直接放行 —— 不擋路是這個確認框有用的前提。
   *
   * 按下捨棄會真的把草稿刪掉。先前的版本保留草稿，結果下次打開又跳「已還原草稿」——
   * 按鈕寫捨棄、內容卻回來，自相矛盾。
   *
   * 草稿因此只服務它真正的用途：沒有經過這個確認框的中斷（切到別的 app、關掉分頁、
   * 瀏覽器當掉）。刻意取消不會留下任何東西。
   */
  function confirmDiscard(onConfirm: () => void) {
    if (!dirty) { onConfirm(); return; }
    modal.confirm({
      title: "捨棄未儲存的途經點編輯？",
      content: "已經填的內容會直接消失，無法復原。",
      okText: "捨棄",
      okType: "danger",
      cancelText: "繼續編輯",
      onOk: () => {
        try { localStorage.removeItem(draftKey); } catch { }
        onConfirm();
      },
    });
  }

  // 編輯中的內容持續寫進草稿；沒有未儲存變更就清掉（與筆記分頁同一套）
  useEffect(() => {
    if (!editing || readOnly) return;
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify(draft));
      else localStorage.removeItem(draftKey);
    } catch {
      // 容量滿或隱私模式：草稿存不了不該讓編輯中斷
    }
  }, [editing, readOnly, dirty, draft, draftKey]);

  function updateDraft(index: number, patch: Partial<Waypoint>) {
    setDraft(prev => prev.map((w, i) => i === index ? { ...w, ...patch } : w));
  }

  /** 座標欄顯示值：優先顯示正在編輯的原始輸入，否則顯示已解析的座標 */
  function coordValue(w: Waypoint): string {
    if (w.coordText !== undefined) return w.coordText;
    return w.lat != null && w.lng != null ? `${w.lat}, ${w.lng}` : "";
  }

  /** 座標打得出來就即時存進 lat/lng；Google Maps 連結要等「自動填海拔」由後端解析 */
  function updateCoord(index: number, text: string) {
    const parsed = parseCoordPair(text);
    updateDraft(index, {
      coordText: text,
      lat: parsed ? parsed[0] : null,
      lng: parsed ? parsed[1] : null,
    });
  }

  /**
   * 對「有座標、還沒填海拔」的列查地形高度。
   * 只認座標與 Google Maps 連結 —— 用點位名稱去猜會查到世界上另一個同名地點，
   * 而海拔在溪降／登山是安全相關數字，填錯比留空危險。
   */
  async function handleFillElevation() {
    const targets = draft
      .map((w, index) => ({ index, query: coordValue(w).trim(), hasElevation: w.elevation_m != null }))
      .filter(t => t.query !== "" && !t.hasElevation);

    if (targets.length === 0) {
      message.info("沒有需要填的列：請先填座標，已有海拔的列不會被覆蓋");
      return;
    }

    setFillingElevation(true);
    try {
      const res = await fetch(`/api/itinerary/waypoints/elevation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: targets.map(({ index, query }) => ({ index, query })) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const results: { index: number; lat: number; lng: number; elevation: number | null }[] = data.results ?? [];

      setDraft(prev => prev.map((w, i) => {
        const hit = results.find(r => r.index === i);
        if (!hit) return w;
        return {
          ...w,
          lat: hit.lat,
          lng: hit.lng,
          coordText: `${hit.lat}, ${hit.lng}`,
          elevation_m: hit.elevation ?? w.elevation_m,
        };
      }));

      const filled = results.filter(r => r.elevation != null).length;
      const skipped = (data.unresolved ?? []).length;
      message.success(
        skipped > 0
          ? `已填入 ${filled} 個海拔，${skipped} 列的座標看不懂`
          : `已填入 ${filled} 個海拔`
      );
    } catch {
      message.error("海拔查詢失敗，請稍後再試");
    } finally {
      setFillingElevation(false);
    }
  }

  /**
   * GPX 匯入的節點接在現有途經點之後，只進草稿、不寫資料庫 ——
   * 使用者仍要檢視並按儲存，所以草稿保護、捨棄確認與存檔流程全部沿用。
   */
  function handleGpxImport(rows: ImportedWaypoint[]) {
    setDraft(prev => {
      // 只有一列且完全空白（剛建立的空殼）就直接取代，不要留一列空的在最前面
      const base = prev.length === 1 && prev[0].name.trim() === "" ? [] : prev;
      return [
        ...base,
        ...rows.map(r => ({
          ...emptyWaypoint(),
          name: r.name,
          elevation_m: r.elevation_m,
          legKm: r.legKm,
          lat: r.lat,
          lng: r.lng,
          coordText: `${r.lat}, ${r.lng}`,
          notes: r.notes,
        })),
      ];
    });
    setGpxOpen(false);
    message.success(`已加入 ${rows.length} 個途經點，檢視後記得儲存`);
  }

  /** 在第 index 列之後插入一個空點位 —— 抄地形圖時漏掉中間一個點很常見 */
  function insertAfter(index: number) {
    setDraft(prev => [...prev.slice(0, index + 1), emptyWaypoint(), ...prev.slice(index + 1)]);
  }

  /** 與相鄰列交換。分段距離／時間跟著整列走，累積值會自動重算 */
  function moveRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    setDraft(prev => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    // chip 列跟著被移動的那一列走，不然展開狀態會留在原位
    setChipsRow(cur => (cur === index ? target : cur === target ? index : cur));
  }

  /** 常用註記以「、」接在既有備註後面；已經有的不重複加 */
  function appendNote(index: number, chip: string) {
    setDraft(prev => prev.map((w, i) => {
      if (i !== index) return w;
      const cur = (w.notes ?? "").trim();
      if (cur.split(/[、,]\s*/).includes(chip)) return w;
      return { ...w, notes: cur ? `${cur}、${chip}` : chip };
    }));
  }

  async function handleSave() {
    const rows = draft
      .map((w, i) => ({ ...w, distance_km: cumulative[i] }))
      .filter(w => w.name.trim() !== "");
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
    try { localStorage.removeItem(draftKey); } catch { }
    setEditBaseline("");
    setEditing(false);
    onSaved?.(
      { distance_km: data.distance_km, ascent_m: data.ascent_m, descent_m: data.descent_m },
      data.waypoints ?? [],
    );
    message.success(rows.length === 0 ? "已清空途經點" : `已儲存 ${rows.length} 個途經點`);
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">路線 · {itemTitle}</span>
          {editing && (
            <Tooltip
              title={EDITOR_HINT}
              // 手機沒有 hover，所以點一下也要能看
              trigger={["hover", "click"]}
              styles={{ root: { maxWidth: 320 } }}
            >
              <button
                type="button"
                aria-label="途經點填寫說明"
                className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-help shrink-0"
              >
                <InfoIcon size={14} />
              </button>
            </Tooltip>
          )}
        </span>
      }
      open={open}
      onCancel={() => confirmDiscard(onClose)}
      footer={null}
      destroyOnHidden
      centered
      width={720}
      /*
        編輯時關掉外層捲動 —— 途經點列表自己捲，下方的取消／儲存要一直按得到。
        檢視時相反：交還給彈窗本身捲，圖與清單在同一欄一起流動，
        否則手機上清單會被高度圖壓到只剩一列多。
      */
      styles={editing
        ? { body: { maxHeight: "none", overflow: "visible", paddingBottom: 16 } }
        : undefined}
    >
      {loading ? (
        <div className="mt-6"><Skeleton active paragraph={{ rows: 4 }} title={false} /></div>
      ) : editing ? (
        <div className="flex flex-col gap-3 mt-6">
          <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto pr-1">
            {draft.map((w, i) => (
              <motion.div
                key={w.uid ?? i}
                layout
                transition={ROW_TRANSITION}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600 text-[11px] tabular-nums w-4 shrink-0">{i + 1}</span>
                  <Input
                    placeholder="點位名稱（如：三六九山莊）"
                    value={w.name}
                    onChange={e => updateDraft(i, { name: e.target.value })}
                    className="rounded-lg! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-9!"
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => moveRow(i, -1)}
                      disabled={i === 0}
                      aria-label="上移這個點"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ArrowUpIcon size={13} />
                    </button>
                    <button
                      onClick={() => moveRow(i, 1)}
                      disabled={i === draft.length - 1}
                      aria-label="下移這個點"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ArrowDownIcon size={13} />
                    </button>
                    <button
                      onClick={() => insertAfter(i)}
                      aria-label="在下方插入一個點"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-violet-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <PlusIcon size={13} />
                    </button>
                    <button
                      onClick={() => setDraft(prev => prev.filter((_, k) => k !== i))}
                      aria-label="刪除這個點"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pl-6">
                  <InputNumber
                    min={0} step={10} precision={0} suffix="m"
                    placeholder="海拔"
                    value={w.elevation_m}
                    onChange={v => updateDraft(i, { elevation_m: v })}
                  />
                  <InputNumber
                    min={0} step={0.1} suffix="km"
                    placeholder="這段距離"
                    value={w.legKm ?? null}
                    onChange={v => updateDraft(i, { legKm: v })}
                  />
                  <InputNumber
                    min={0} step={5} precision={0} suffix="分"
                    placeholder="這段時間"
                    value={w.duration_min}
                    onChange={v => updateDraft(i, { duration_min: v })}
                  />
                </div>
                {/* 累積值由系統算，填的是分段，這裡即時顯示到這個點為止的合計 */}
                {(cumulative[i] != null || cumulativeMin[i] > 0) && (
                  <div className="pl-6 -mt-1 text-zinc-600 text-[11px] tabular-nums">
                    {cumulative[i] != null && <>累積 {cumulative[i]} km</>}
                    {cumulative[i] != null && cumulativeMin[i] > 0 && " · "}
                    {cumulativeMin[i] > 0 && <>累計 {fmtMinutes(cumulativeMin[i])}</>}
                  </div>
                )}
                <div className="flex flex-col gap-2 pl-6">
                  {/*
                    備註常常是好幾句（固定點取用方式、迴流警告），單行 input 讀不完。
                    autoSize 從一行起跳、min-h-9 讓起始高度與旁邊的欄位對齊，打多了才長高。
                  */}
                  <Input.TextArea
                    allowClear
                    autoSize={{ minRows: 1, maxRows: 6 }}
                    placeholder="備註（例：右岸垂降 20m、注意底切）"
                    value={w.notes ?? ""}
                    onChange={e => updateDraft(i, { notes: e.target.value || null })}
                    onFocus={() => setChipsRow(i)}
                    className="rounded-lg! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! min-h-9!"
                  />
                  {chipsRow === i && (
                    <div className="flex flex-wrap gap-1">
                      {NOTE_CHIPS.map(chip => (
                        <button
                          key={chip}
                          type="button"
                          // 用 mouseDown + preventDefault，點 chip 時備註欄不會失焦、chip 列才不會收起來
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => appendNote(i, chip)}
                          className="h-6 px-2 rounded-md text-[11px] border border-white/[0.1] bg-white/[0.04] text-zinc-400 hover:text-zinc-100 hover:border-white/25 transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-6">
                  <Select
                    allowClear
                    placeholder="點位類型"
                    value={w.type ?? undefined}
                    onChange={v => updateDraft(i, { type: v ?? null })}
                    options={WAYPOINT_TYPE_GROUPS}
                    className="cute-select"
                  />
                  <Select
                    placeholder="第幾天"
                    value={w.day_offset}
                    onChange={v => updateDraft(i, { day_offset: v })}
                    options={Array.from({ length: 8 }, (_, d) => ({ value: d, label: `第 ${d + 1} 天` }))}
                    className="cute-select"
                  />
                  <Input
                    allowClear
                    placeholder="座標或地圖連結"
                    value={coordValue(w)}
                    onChange={e => updateCoord(i, e.target.value)}
                    className="rounded-lg! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-9!"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              <PillButton onClick={() => setDraft(prev => [...prev, emptyWaypoint()])}>
                <PlusIcon size={13} />
                加一個點
              </PillButton>
              <PillButton onClick={handleFillElevation} disabled={fillingElevation || saving}>
                <MountainIcon size={13} />
                {fillingElevation ? "查詢中" : "自動填海拔"}
              </PillButton>
              <PillButton onClick={() => setGpxOpen(true)} disabled={saving}>
                <UploadIcon size={13} />
                匯入 GPX
              </PillButton>
            </div>
            <div className="flex gap-2 shrink-0">
              <PillButton onClick={() => confirmDiscard(() => setEditing(false))} disabled={saving} className="flex-1 sm:flex-none">取消</PillButton>
              <PillButton variant="primary" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
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
          <div className="flex items-end justify-between gap-3 flex-wrap shrink-0">
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
              <div className="flex items-center gap-3">
                {/*
                  顯示與隱藏的唯一入口。刻意只有兩態：使用者按過之後就以他的選擇為準，
                  null（自動判斷）只是尚未表態時的初始值 —— 明確的選擇本來就該蓋過啟發式判斷，
                  多一個「改回自動」只會讓這顆按鈕變成難懂的三態循環。
                */}
                {waypoints.length > 0 && (
                  <button
                    onClick={() => setShowElevation(elevationDecision.show ? false : true)}
                    disabled={togglingElevation}
                    className="text-zinc-500 text-[12px] hover:text-zinc-300 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {elevationDecision.show ? "隱藏高度圖" : "顯示高度圖"}
                  </button>
                )}
                <PillButton onClick={startEdit}>編輯</PillButton>
              </div>
            )}
          </div>

          {plottable ? (
            <>
              <div className="h-[160px] sm:h-[220px] -ml-2 shrink-0">
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

            </>
          ) : (
            /* 說「這裡沒東西值得看」的訊息不該比它取代的圖表還佔空間，所以壓成一行、長解釋進 tooltip */
            <div className="flex items-center gap-1.5 flex-wrap text-zinc-600 text-[11px] shrink-0">
              {elevationDecision.detail ? (
                <Tooltip title={elevationDecision.detail} trigger={["hover", "click"]} styles={{ root: { maxWidth: 300 } }}>
                  <span className="inline-flex items-center gap-1 cursor-help">
                    <InfoIcon size={10} />
                    {elevationDecision.reason}
                  </span>
                </Tooltip>
              ) : (
                <span>{elevationDecision.reason ?? "海拔資料不足"}</span>
              )}
            </div>
          )}

          {/* 分段時間帶：寬度依各段耗時比例，對照上河地形圖下方那排時間 */}
          {stats.totalMin > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[11px] shrink-0">時間</span>
              <div className="flex-1 flex gap-0.5 min-w-0">
                {waypoints.slice(1).map((w, i) => {
                  const min = w.duration_min ?? 0;
                  if (min <= 0) return null;
                  return (
                    <div
                      key={i}
                      title={`${waypoints[i].name} → ${w.name}`}
                      className="h-6 rounded-md flex items-center justify-center text-[10px] text-zinc-300 tabular-nums overflow-hidden whitespace-nowrap px-1"
                      style={{ flexGrow: min, flexBasis: 0, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}
                    >
                      {fmtMinutes(min)}
                    </div>
                  );
                })}
              </div>
              <span className="text-zinc-400 text-[11px] shrink-0 tabular-nums">{fmtMinutes(stats.totalMin)}</span>
            </div>
          )}

          {/*
            途經點清單。備註原本只有高度圖的 hover tooltip 一個出口，而手機沒有 hover ——
            等於現場最該讀的危險與脫逃資訊在手機上完全看不到，除非進編輯模式。
            危險點與脫逃點給邊框顏色，因為那兩類是絕對不能漏看的。
          */}
          <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-zinc-400 text-[12px] font-medium">途經點 {waypoints.length}</span>
              <span className="text-zinc-600 text-[11px]">
                {stats.days > 1 ? `${stats.days} 天` : ""}
                {!hasDistances && waypoints.length > 1 ? "　X 軸為等距排列（有點位沒填距離）" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {waypoints.map((w, i) => {
                const accent = ROW_ACCENT[w.type ?? ""] ?? null;
                const meta = [
                  w.type ? TYPE_LABEL[w.type] ?? w.type : null,
                  w.elevation_m !== null ? `${w.elevation_m} m` : null,
                  w.distance_km !== null ? `${w.distance_km} km` : null,
                  w.duration_min ? fmtMinutes(w.duration_min) : null,
                ].filter(Boolean);
                return (
                  <div
                    key={w.id ?? i}
                    className="rounded-xl border px-3 py-2"
                    style={accent
                      ? { borderColor: accent.border, background: accent.bg }
                      : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-zinc-600 text-[11px] tabular-nums w-5 shrink-0">{i + 1}</span>
                      <span className="text-zinc-100 text-[13px] font-medium min-w-0 break-words">{w.name}</span>
                    </div>
                    {meta.length > 0 && (
                      <div className="pl-7 text-[11px] tabular-nums" style={{ color: accent?.text ?? "#71717a" }}>
                        {meta.join(" · ")}
                      </div>
                    )}
                    {w.notes && (
                      <div className="pl-7 mt-1 text-zinc-400 text-[12px] leading-relaxed break-words">
                        {w.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <GpxImportModal
        open={gpxOpen}
        onClose={() => setGpxOpen(false)}
        onImport={handleGpxImport}
      />
    </Modal>
  );
}

/** 自訂 tooltip：點位名稱在上、海拔在下，比預設的 series 名稱好讀 */
function RouteTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload?: { name?: string; type?: string | null; elevation?: number | null; notes?: string | null } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1c1c1f] px-2.5 py-1.5 text-[12px] shadow-lg max-w-[220px]">
      <div className="text-zinc-100 font-medium">
        {p.name}
        {p.type ? `（${TYPE_LABEL[p.type] ?? p.type}）` : ""}
      </div>
      {p.elevation != null && <div className="text-zinc-400 tabular-nums">{p.elevation} m</div>}
      {p.notes && <div className="text-zinc-500 mt-0.5 leading-relaxed">{p.notes}</div>}
    </div>
  );
}
