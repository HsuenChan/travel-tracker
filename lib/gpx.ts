/**
 * GPX track parsing for the route editor.
 *
 * Regex-based rather than DOMParser so the same code runs in Node (tests) and the browser.
 * GPX is regular enough for this: trkpt always carries lat/lon attributes and an optional
 * <ele> child. Anything else in the file is ignored — we only need the track shape.
 */

export interface GpxPoint {
  lat: number;
  lng: number;
  ele: number | null;
  /** Cumulative distance from the track start, in km */
  km: number;
}

export interface GpxNode extends GpxPoint {
  /** 起點／終點／最高／最低，其餘為 null —— 這幾個是路線描述會提到的點 */
  role: "start" | "end" | "high" | "low" | null;
}

export interface GpxTrack {
  name: string | null;
  points: GpxPoint[];
  distanceKm: number;
  eleMin: number | null;
  eleMax: number | null;
  /** Sum of positive / negative steps. Includes GPS noise, so larger than the net change. */
  ascent: number;
  descent: number;
}

const R = 6371000;

export function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function parseGpx(xml: string): GpxTrack | null {
  const nameMatch = xml.match(/<name>([^<]*)<\/name>/);

  const raw: { lat: number; lng: number; ele: number | null }[] = [];
  const ptRe = /<trkpt\b[^>]*?\blat="(-?[\d.]+)"[^>]*?\blon="(-?[\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let m: RegExpExecArray | null;
  while ((m = ptRe.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const inner = m[3] ?? "";
    const eleMatch = inner.match(/<ele>\s*(-?[\d.]+)\s*<\/ele>/);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null;
    raw.push({ lat, lng, ele: ele !== null && Number.isFinite(ele) ? ele : null });
  }
  if (raw.length < 2) return null;

  let cum = 0;
  const points: GpxPoint[] = raw.map((p, i) => {
    if (i > 0) cum += haversineMetres(raw[i - 1], p);
    return { ...p, km: Math.round((cum / 1000) * 1000) / 1000 };
  });

  const eles = points.map(p => p.ele).filter((e): e is number => e !== null);
  let ascent = 0, descent = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].ele, b = points[i].ele;
    if (a === null || b === null) continue;
    const d = b - a;
    if (d > 0) ascent += d; else descent -= d;
  }

  return {
    name: nameMatch ? nameMatch[1].trim() || null : null,
    points,
    distanceKm: points[points.length - 1].km,
    eleMin: eles.length ? Math.min(...eles) : null,
    eleMax: eles.length ? Math.max(...eles) : null,
    ascent: Math.round(ascent),
    descent: Math.round(descent),
  };
}

/**
 * Moving average over elevation, used only to choose nodes.
 *
 * GPS elevation is noisy: this track wobbles 699 → 730 → 720 → 724 within 200 metres near the
 * ridge. Feeding that straight to Douglas-Peucker makes it keep the noise and simplify away the
 * long smooth climb, which is the opposite of useful. The returned nodes keep their raw values.
 */
function smoothElevations(points: GpxPoint[], window = 5): (number | null)[] {
  return points.map((p, i) => {
    if (p.ele === null) return null;
    let sum = 0, n = 0;
    for (let k = Math.max(0, i - window); k <= Math.min(points.length - 1, i + window); k++) {
      const e = points[k].ele;
      if (e !== null) { sum += e; n++; }
    }
    return n ? sum / n : null;
  });
}

/**
 * Picks the points that define the profile's shape, via Douglas-Peucker over
 * (distance, elevation) with **both axes normalised to 0–1**.
 *
 * Normalising matters: in raw units distance is in km (single digits) and elevation in m
 * (hundreds), so the deviation term is all elevation and the selection clusters wherever the
 * track is steepest instead of spreading along the route.
 *
 * Start, end, highest and lowest are always kept — those are the points a route description names.
 *
 * `count` is a target, not a guarantee: the tolerance is found by bisection so the caller never
 * has to reason about tolerance units.
 */
export function pickNodes(track: GpxTrack, count = 8): GpxNode[] {
  const pts = track.points;
  if (pts.length <= count) {
    return pts.map((p, i) => ({
      ...p,
      role: i === 0 ? "start" : i === pts.length - 1 ? "end" : null,
    }));
  }

  const smooth = smoothElevations(pts);
  const haveEle = smooth.filter((e): e is number => e !== null);
  // 沒有海拔就只能照距離等分 —— 形狀資訊不存在，挑不出「有意義的轉折」
  if (haveEle.length < 2) {
    const step = (pts.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.round(i * step);
      return {
        ...pts[idx],
        role: (idx === 0 ? "start" : idx === pts.length - 1 ? "end" : null) as GpxNode["role"],
      };
    });
  }

  const xSpan = track.distanceKm || 1;
  const yMin = Math.min(...haveEle), yMax = Math.max(...haveEle);
  const ySpan = (yMax - yMin) || 1;
  const nx = (i: number) => pts[i].km / xSpan;
  const ny = (i: number) => ((smooth[i] ?? yMin) - yMin) / ySpan;

  const simplify = (eps: number): number[] => {
    const keep = new Set<number>([0, pts.length - 1]);
    const stack: [number, number][] = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      const ax = nx(a), ay = ny(a), bx = nx(b), by = ny(b);
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      let best = -1, bestDist = 0;
      for (let i = a + 1; i < b; i++) {
        const dist = Math.abs(dy * (nx(i) - ax) - dx * (ny(i) - ay)) / len;
        if (dist > bestDist) { bestDist = dist; best = i; }
      }
      if (best > 0 && bestDist > eps) {
        keep.add(best);
        stack.push([a, best], [best, b]);
      }
    }
    return [...keep].sort((x, y) => x - y);
  };

  let lo = 0, hi = 1, chosen = simplify(0.002);
  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    const idx = simplify(mid);
    if (idx.length > count) lo = mid; else hi = mid;
    chosen = idx;
    if (idx.length === count) break;
  }
  if (chosen.length > count) chosen = simplify(hi);

  const hiIdx = pts.reduce((best, p, i) => (p.ele ?? -Infinity) > (pts[best].ele ?? -Infinity) ? i : best, 0);
  const loIdx = pts.reduce((best, p, i) => (p.ele ?? Infinity) < (pts[best].ele ?? Infinity) ? i : best, 0);

  const roleOf = (i: number): GpxNode["role"] => {
    if (i === 0) return "start";
    if (i === pts.length - 1) return "end";
    if (i === hiIdx) return "high";
    if (i === loIdx) return "low";
    return null;
  };

  const set = new Set(chosen);
  set.add(0); set.add(pts.length - 1); set.add(hiIdx); set.add(loIdx);

  // 兩個點高度相同時 DP 與 hi/lo 可能各挑一個，結果是相距幾公尺的重複節點。
  // 角色點永遠保留，其餘離前一個保留點太近就丟掉。
  const MIN_GAP_KM = 0.02;
  const out: GpxNode[] = [];
  for (const i of [...set].sort((a, b) => a - b)) {
    const role = roleOf(i);
    const prev = out[out.length - 1];
    if (prev && !role && pts[i].km - prev.km < MIN_GAP_KM) continue;
    if (prev && role && pts[i].km - prev.km < MIN_GAP_KM && !prev.role) out.pop();
    out.push({ ...pts[i], role });
  }
  return out;
}

/** 角色點給有意義的名字，其餘編號 —— 使用者匯入後還是會自己改 */
export function labelNode(node: GpxNode, order: number): string {
  switch (node.role) {
    case "start": return "起點";
    case "end": return "終點";
    case "high": return "最高點";
    case "low": return "最低點";
    default: return `節點 ${order}`;
  }
}
