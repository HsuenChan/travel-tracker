// Google Sheets stored transport type names (Chinese), normalized to English keys
export type TransportKey = "plane" | "train" | "bus" | "ferry" | "other";

const TYPE_MAP: Record<string, TransportKey> = {
  "飛機": "plane", "plane": "plane",
  "火車": "train", "train": "train",
  "巴士": "bus",   "bus": "bus",
  "渡輪": "ferry", "ferry": "ferry",
  "其他": "other", "other": "other",
};

export function toTransportKey(raw: string): TransportKey {
  return TYPE_MAP[raw] ?? "other";
}

export const VEHICLE_ICON: Record<TransportKey, string> = {
  plane: "✈️", train: "🚂", bus: "🚌", ferry: "⛴️", other: "🚗",
};

// Default bearing offset per emoji on Apple systems (degrees clockwise from north)
export const ICON_BEARING: Record<TransportKey, number> = {
  plane: 45, train: 270, bus: 90, ferry: 270, other: 90,
};

const GROUND_ARC_ALTITUDE: Record<Exclude<TransportKey, "plane">, number> = {
  train: 0.01, bus: 0.01, ferry: 0.03, other: 0.01,
};

export const FOLLOW_ALTITUDE: Record<TransportKey, number> = {
  plane: 1.4, train: 0.5, bus: 0.5, ferry: 0.7, other: 0.6,
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Dynamic follow altitude for planes based on flight distance
export function getPlaneFollowAltitude(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const distKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  if (distKm < 500)  return 0.25;
  if (distKm < 1200) return 0.45;
  if (distKm < 4000) return 0.8;
  if (distKm < 8000) return 1.1;
  return 1.4;
}

export function getArcAltitude(
  key: TransportKey,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  if (key !== "plane") return GROUND_ARC_ALTITUDE[key];
  const distKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  if (distKm < 1200) return 0.08;
  if (distKm < 4000) return 0.15;
  if (distKm < 8000) return 0.25;
  return 0.35;
}

// AddSegmentModal options (value stays Chinese for Sheets data compatibility)
export const TRANSPORT_OPTIONS = [
  { value: "飛機", label: "✈️ 飛機", key: "plane" as TransportKey },
  { value: "火車", label: "🚂 火車", key: "train" as TransportKey },
  { value: "巴士", label: "🚌 巴士", key: "bus" as TransportKey },
  { value: "渡輪", label: "⛴️ 渡輪", key: "ferry" as TransportKey },
  { value: "其他", label: "🚗 其他", key: "other" as TransportKey },
];
