import { resolveLocation } from "./airports";

const MEM_CACHE = new Map<string, { lat: number; lng: number } | null>();

function cacheKey(q: string) {
  return `geo:${q.toLowerCase().trim()}`;
}

function readLocalCache(q: string): { lat: number; lng: number } | null | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = localStorage.getItem(cacheKey(q));
  if (raw === null) return undefined;           // 未快取
  if (raw === "null") return null;              // 曾查詢但找不到
  try { return JSON.parse(raw); } catch { return undefined; }
}

function writeLocalCache(q: string, value: { lat: number; lng: number } | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(cacheKey(q), value ? JSON.stringify(value) : "null");
}

async function nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/** 解析單一地點（本地 → 記憶體快取 → localStorage → Nominatim） */
export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query?.trim()) return null;
  const q = query.trim();

  const local = resolveLocation(q);
  if (local) return local;

  if (MEM_CACHE.has(q)) return MEM_CACHE.get(q) ?? null;

  const lc = readLocalCache(q);
  if (lc !== undefined) { MEM_CACHE.set(q, lc); return lc; }

  const result = await nominatim(q);
  MEM_CACHE.set(q, result);
  writeLocalCache(q, result);
  if (!result) console.warn(`[geocode] 找不到地點: "${q}"`);
  return result;
}

/** 批次解析多個地點，對需要打 Nominatim 的項目自動限速（≤1 req/s） */
export async function preResolveLocations(
  queries: string[]
): Promise<Map<string, { lat: number; lng: number } | null>> {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const result = new Map<string, { lat: number; lng: number } | null>();
  let needsDelay = false;

  for (const q of unique) {
    // 本地 DB
    const local = resolveLocation(q);
    if (local) { result.set(q, local); continue; }

    // 記憶體快取
    if (MEM_CACHE.has(q)) { result.set(q, MEM_CACHE.get(q) ?? null); continue; }

    // localStorage 快取
    const lc = readLocalCache(q);
    if (lc !== undefined) { MEM_CACHE.set(q, lc); result.set(q, lc); continue; }

    // Nominatim（限速）
    if (needsDelay) await new Promise((r) => setTimeout(r, 1100));
    needsDelay = true;

    const fetched = await nominatim(q);
    MEM_CACHE.set(q, fetched);
    writeLocalCache(q, fetched);
    result.set(q, fetched);
    if (!fetched) console.warn(`[geocode] 找不到地點: "${q}"`);
  }

  return result;
}
