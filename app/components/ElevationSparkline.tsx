"use client";

import { useMemo } from "react";
import type { Waypoint } from "@/app/components/RouteProfileModal";
import { MIN_ELEVATION_POINTS } from "@/lib/elevationDisplay";

export { decideElevationDisplay } from "@/lib/elevationDisplay";

/**
 * 行程卡上的迷你高度剖面。刻意不畫座標軸、不標點名、不做互動 ——
 * 它只回答「這條路線長什麼形狀」，細節在路線彈窗裡。
 * 手寫 SVG 而不用 recharts：這個尺寸不需要圖表引擎，也省掉卡片上的 ResponsiveContainer 量測。
 */
export default function ElevationSparkline({
  waypoints,
  height = 44,
  className = "",
}: {
  waypoints: Waypoint[];
  height?: number;
  className?: string;
}) {
  const shape = useMemo(() => {
    const pts = waypoints
      .map((w) => ({ y: w.elevation_m, x: w.distance_km }))
      .filter((p): p is { y: number; x: number | null } => p.y != null);
    if (pts.length < MIN_ELEVATION_POINTS) return null;

    // 累積距離齊全時用距離當 X（間距才反映真實路程），有缺就退回等距
    const everyDistance = pts.every(p => p.x != null);
    const xs = pts.map((p, i) => (everyDistance ? (p.x as number) : i));
    const ys = pts.map(p => p.y);

    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;

    // viewBox 用固定的 100×100 再靠 preserveAspectRatio="none" 拉開，寬度就能完全交給 CSS
    const coords = xs.map((x, i) => {
      const px = ((x - xMin) / xSpan) * 100;
      const py = 100 - ((ys[i] - yMin) / ySpan) * 92 - 4;   // 上下各留 4 讓線不貼邊
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    });

    return {
      line: `M${coords.join("L")}`,
      area: `M${coords.join("L")}L100,100L0,100Z`,
      min: Math.round(yMin),
      max: Math.round(yMax),
      count: waypoints.length,
    };
  }, [waypoints]);

  if (!shape) return null;

  return (
    <div className={`relative w-full overflow-hidden rounded-lg ${className}`} style={{ height }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="block"
        aria-hidden
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.30} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={shape.area} fill="url(#spark-fill)" />
        {/* vectorEffect 讓線寬不被 preserveAspectRatio 的非等比縮放拉變形 */}
        <path
          d={shape.line}
          fill="none"
          stroke="#6ee7b7"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute inset-x-1.5 bottom-0.5 flex items-end justify-between text-[9px] leading-none text-zinc-500 tabular-nums pointer-events-none">
        <span>{shape.min} m</span>
        <span>{shape.count} 點 · 最高 {shape.max} m</span>
      </div>
    </div>
  );
}
