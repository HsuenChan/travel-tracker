"use client";

/**
 * 溪降縱剖面圖。
 *
 * 依障礙順序由左往右走，每個障礙依落差往下掉，落點畫落水潭 —— 就是官方 CanyonTopo
 * 那張圖的樣子。幾何演算法沿用 demos/tw-canyoning-tabs，配色換成本專案的。
 *
 * 縱向是落差比例，橫向不等比（橫向只表達順序，不是實際距離）。真正的距離在高度圖那張，
 * 這張要回答的是另一個問題：接下來會掉多少、掉進什麼樣的水裡、繩子要多長。
 *
 * 資料來自這條路線自己的途經點，不是寫死的。所以使用者改了途經點，圖就跟著改。
 */

import { useMemo } from "react";
import { WAYPOINT_TYPE_LABEL } from "@/lib/waypointTypes";

export interface TopoWaypoint {
  name: string;
  type: string | null;
  drop_m: number | null;
  /* 這三欄是 18_waypoint_topo.sql 才加的，舊資料與唯讀分享頁可能整個沒有這些 key */
  pool_type?: string | null;
  anchor_note?: string | null;
  section?: string | null;
  notes?: string | null;
}

/** 畫圖時的障礙種類。由途經點的 type 對應過來 */
type Kind = "R" | "J" | "S" | "DC" | "UC" | "HL" | "N";

const TYPE_TO_KIND: Record<string, Kind> = {
  rappel: "R",
  jump: "J",
  slide: "S",
  downclimb: "DC",
  upclimb: "UC",
  anchor: "HL",
};

/** 認不出來的一律當「註記」：只標一個字，不畫落差 */
function kindOf(w: TopoWaypoint): Kind {
  return (w.type && TYPE_TO_KIND[w.type]) || "N";
}

/* ---------------------------------------------------------------- 幾何 */

/** 每公尺落差畫幾 px */
const SCALE = 1.15;
const PAD_TOP = 70;
const PAD_BOTTOM = 28;
const PAD_X = 26;

/** 落差本身佔的水平寬度：垂降幾乎垂直，滑降與下攀是斜的，所以跟著落差長 */
const DROP_W: Record<Kind, number> = { R: 7, J: 4, S: 0, DC: 0, UC: 0, HL: 13, N: 0 };
/** 障礙之間的平流段最短要多寬，免得標籤擠在一起 */
const RUN_W: Record<Kind, number> = { R: 46, J: 40, S: 26, DC: 26, UC: 26, HL: 30, N: 66 };

/** 粗估字寬，用來保證標籤不重疊。中日韓字元約兩倍寬 */
function estimateWidth(text: string): number {
  let w = 0;
  for (const c of text) w += c.charCodeAt(0) > 255 ? 10 : 5.6;
  return w;
}

interface PlacedItem {
  w: TopoWaypoint;
  kind: Kind;
  label: string;
  /** 障礙起點（落差的頂端） */
  x0: number;
  y0: number;
  /** 落差底端，落水潭畫在這裡 */
  x1: number;
  y1: number;
  /** 平流段結束 */
  x2: number;
  index: number;
}

interface Placed {
  points: [number, number][];
  items: PlacedItem[];
  width: number;
  height: number;
  totalDrop: number;
}

function place(rows: TopoWaypoint[]): Placed {
  let x = PAD_X;
  let y = PAD_TOP;
  const points: [number, number][] = [[x, y]];
  const items: PlacedItem[] = [];
  let rightmost = 0;
  let totalDrop = 0;

  rows.forEach((w, index) => {
    const kind = kindOf(w);
    const label = w.name;
    const metres = kind === "N" ? 0 : Number(w.drop_m ?? 0);
    const drop = metres * SCALE;
    totalDrop += metres;

    // 滑降與下攀是斜坡，寬度跟著落差走；垂降幾乎垂直，固定窄
    const dropW = kind === "S" ? Math.max(14, drop * 0.9)
      : kind === "DC" || kind === "UC" ? Math.max(16, drop * 0.65)
      : DROP_W[kind];

    const x0 = x, y0 = y;
    if (metres > 0) {
      x += dropW;
      y += drop;
      points.push([x, y]);
    }
    const x1 = x, y1 = y;

    rightmost = Math.max(rightmost, x0 + 2 + estimateWidth(label));
    x += Math.max(RUN_W[kind], estimateWidth(label) + 8 - dropW);
    points.push([x, y]);

    items.push({ w, kind, label, x0, y0, x1, y1, x2: x, index });
  });

  return {
    points,
    items,
    width: Math.max(x, rightmost) + PAD_X,
    height: y + PAD_BOTTOM,
    totalDrop,
  };
}

/* ---------------------------------------------------------------- 樣式 */

/**
 * 落水潭。藍色在這個以翠綠／紫為主的介面裡是刻意的 —— 水就該是水的顏色，
 * 而且「掉進去的是什麼」要能一眼分辨，不能跟其他元素同色。
 */
const POOL: Record<string, { fill: string; stroke: string; h: number; swirl?: boolean }> = {
  unknown:   { fill: "#2b6f9c", stroke: "#7cc4e8", h: 6 },
  shallow:   { fill: "#2f93ad", stroke: "#8fe4f5", h: 4 },
  deep:      { fill: "#1f5f8e", stroke: "#63b8e6", h: 7 },
  hydraulic: { fill: "#123a63", stroke: "#9dbfe0", h: 7, swirl: true },
};

const POOL_LABEL: Record<string, string> = {
  unknown: "未區分深淺",
  shallow: "淺潭",
  deep: "深潭",
  hydraulic: "危險迴流",
};

/** 垂降的標籤給強調色 —— 那是要架繩的點，掃圖時第一個要找的 */
const LABEL_FILL: Record<Kind, string> = {
  R: "#6ee7b7",
  J: "#e4e4e7",
  S: "#e4e4e7",
  DC: "#e4e4e7",
  UC: "#e4e4e7",
  HL: "#e4e4e7",
  N: "#8b8b93",
};

const STREAM = "#d4d4d8";
const LEADER = "#3f3f46";
const LEADER_NOTE = "#52525b";

/* ---------------------------------------------------------------- 元件 */

function Section({ rows, title }: { rows: TopoWaypoint[]; title: string | null }) {
  const placed = useMemo(() => place(rows), [rows]);

  return (
    <div className="flex flex-col gap-1.5">
      {title && (
        <div className="flex items-baseline gap-2 text-[12px]">
          <span className="text-zinc-200 font-medium">{title}</span>
          <span className="ml-auto text-zinc-500 tabular-nums">
            總落差約 {Math.round(placed.totalDrop)} m
          </span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <svg
          width={placed.width}
          height={placed.height}
          viewBox={`0 0 ${placed.width} ${placed.height}`}
          role="img"
          aria-label={`${title ?? "路線"}縱剖面，總落差約 ${Math.round(placed.totalDrop)} 公尺`}
        >
          {/* 落水潭畫在河床下面，才不會蓋住折線 */}
          {placed.items.map((it) => {
            const key = it.w.pool_type;
            if (!key) return null;
            const style = POOL[key] ?? POOL.unknown;
            const width = Math.min(30, it.x2 - it.x1 - 6);
            if (width < 3) return null;
            const h = style.h;
            const cx = it.x1 + width / 2;
            const cy = it.y1 + h / 2 + 1;
            return (
              <g key={`pool-${it.index}`}>
                <path
                  d={`M${it.x1} ${it.y1} h${width} v${h} a3 3 0 0 1-3 3 h-${width - 6} a3 3 0 0 1-3-3 z`}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth=".9"
                />
                {/* 迴流畫一個漩渦箭頭：這是會把人壓在水下的那種潭，要一眼認得出來 */}
                {style.swirl && width >= 12 && (
                  <>
                    <path
                      d={`M${cx - 3.4} ${cy + 1.2}a3.4 3.4 0 1 1 3.4 3.4`}
                      fill="none" stroke="#fff" strokeWidth="1.15" strokeLinecap="round"
                    />
                    <path d={`M${cx + 0.2} ${cy + 2.6}l2.4 2.1 -2.9 1.1z`} fill="#fff" />
                  </>
                )}
              </g>
            );
          })}

          {/* 河床 */}
          <polyline
            points={placed.points.map((p) => `${p[0]},${p[1]}`).join(" ")}
            fill="none"
            stroke={STREAM}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 標籤。上下交錯三層，否則連續障礙的標籤會疊在一起 */}
          {placed.items.map((it) => {
            const up = [10, 32, 54][it.index % 3];
            const lx = it.x0 + 2;
            const ly = it.y0 - up;
            const isNote = it.kind === "N";
            return (
              <g key={`label-${it.index}`}>
                <line
                  x1={it.x0} y1={it.y0 - 2} x2={it.x0} y2={ly + 2.5}
                  stroke={isNote ? LEADER_NOTE : LEADER}
                  strokeWidth=".8"
                  strokeDasharray={isNote ? "2 2" : undefined}
                />
                <text
                  x={lx} y={ly}
                  fill={LABEL_FILL[it.kind]}
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  fontSize="9.5"
                  fontStyle={isNote ? "italic" : undefined}
                  fontWeight={it.kind === "R" ? 500 : 400}
                >
                  {it.label}
                </text>
                {it.w.anchor_note && (
                  <text
                    x={lx} y={ly + 9.5}
                    fill="#71717a"
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    fontSize="8"
                  >
                    {it.w.anchor_note}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function RouteTopoProfile({ waypoints }: { waypoints: TopoWaypoint[] }) {
  /*
    只畫得出剖面的點位才進圖：進場的停車點、渡溪點沒有落差也不是障礙，
    畫進來只會變成一長排看不懂的註記，把真正的落差擠到看不見。
  */
  const rows = useMemo(
    () => waypoints.filter((w) => {
      const kind = kindOf(w);
      if (kind !== "N") return true;
      // 註記類只留現場真的要看的：危險點、脫逃點、深潭
      return w.type === "hazard" || w.type === "exit" || w.type === "pool";
    }),
    [waypoints]
  );

  /** 依 section 分組，保持原本的順序；沒有分段就是一整條 */
  const sections = useMemo(() => {
    const groups: { title: string | null; rows: TopoWaypoint[] }[] = [];
    for (const w of rows) {
      const title = w.section?.trim() || null;
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.rows.push(w);
      else groups.push({ title, rows: [w] });
    }
    return groups;
  }, [rows]);

  const hasDrop = rows.some((w) => Number(w.drop_m ?? 0) > 0);
  if (!hasDrop) return null;

  const usedPools = Array.from(new Set(rows.map((w) => w.pool_type).filter((p): p is string => Boolean(p))));

  return (
    <div className="flex flex-col gap-3">
      {sections.map((s, i) => (
        <Section key={i} rows={s.rows} title={sections.length > 1 ? s.title : null} />
      ))}

      {usedPools.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-zinc-500">
          {usedPools.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <i
                className="inline-block w-3 h-2 rounded-[2px]"
                style={{ background: (POOL[p] ?? POOL.unknown).fill, border: `1px solid ${(POOL[p] ?? POOL.unknown).stroke}` }}
              />
              {POOL_LABEL[p] ?? p}
            </span>
          ))}
        </div>
      )}

      <p className="m-0 text-zinc-600 text-[11px] leading-relaxed">
        縱向為落差比例，橫向只表達順序、不等比。圖依這條路線的途經點繪製，
        逃生點與細部地形請對照官方 topo 原圖。
      </p>
    </div>
  );
}

/** 類型的中文名，給無障礙描述用 */
export function waypointKindLabel(type: string | null): string {
  return (type && WAYPOINT_TYPE_LABEL[type]) || "點位";
}
