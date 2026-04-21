"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { Skeleton } from "antd";
import L from "leaflet";
import dayjs from "dayjs";

// Fix Leaflet default icon paths broken by webpack
import "leaflet/dist/leaflet.css";

const todayStr = dayjs().format("YYYY-MM-DD");

interface ItineraryItem {
  id: string;
  date: string;
  time: string | null;
  title: string;
  category: string | null;
  location: string | null;
}

interface MapPoint {
  item: ItineraryItem;
  coords: [number, number];
}

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:12px;height:12px;
      border-radius:50%;
      background:${color};
      border:2.5px solid rgba(0,0,0,0.55);
      box-shadow:0 0 0 2px ${color}44;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

function dotColor(date: string) {
  if (date === todayStr) return "#8b5cf6";
  if (date < todayStr) return "#52525b";
  return "#a78bfa";
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0].coords, 12);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => p.coords));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

async function geocode(location: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(location)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.coords ?? null;
  } catch {
    return null;
  }
}

interface Props {
  tripId: string;
}

export default function TripMap({ tripId }: Props) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingGeo, setLoadingGeo] = useState(false);

  useEffect(() => {
    const cacheKey = `travel_itinerary_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setItems(JSON.parse(cached));
      setLoadingItems(false);
    } else {
      setLoadingItems(true);
      fetch(`/api/itinerary?tripId=${tripId}`)
        .then((r) => r.json())
        .then((d) => {
          setItems(d.items);
          localStorage.setItem(cacheKey, JSON.stringify(d.items));
        })
        .finally(() => setLoadingItems(false));
    }
  }, [tripId]);

  useEffect(() => {
    const withLocation = items.filter((i) => i.location);
    if (withLocation.length === 0) {
      setPoints([]);
      return;
    }
    setLoadingGeo(true);
    Promise.all(
      withLocation.map(async (item) => {
        const coords = await geocode(item.location!);
        return coords ? { item, coords } : null;
      })
    ).then((results) => {
      setPoints(results.filter(Boolean) as MapPoint[]);
      setLoadingGeo(false);
    });
  }, [items]);

  const polylineCoords = useMemo(
    () => points.map((p) => p.coords),
    [points]
  );

  if (loadingItems) {
    return (
      <div className="flex flex-col gap-3 mt-3">
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: "40%" }} />
      </div>
    );
  }

  const itemsWithLocation = items.filter((i) => i.location);

  if (itemsWithLocation.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-10 pb-8 bg-[#111113] border border-dashed border-[#27272a] rounded-xl mt-3">
        <span className="text-zinc-600 text-sm">行程中沒有地點資訊</span>
        <span className="text-zinc-700 text-xs">在「行程」tab 的項目加上「地點」欄位即可顯示地圖</span>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {loadingGeo && (
        <p className="text-zinc-600 text-xs mb-2">正在解析地點座標…</p>
      )}
      {points.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-white/[0.07]" style={{ height: 420 }}>
          <MapContainer
            center={points[0].coords}
            zoom={6}
            style={{ height: "100%", width: "100%", background: "#18181b" }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {polylineCoords.length > 1 && (
              <Polyline
                positions={polylineCoords}
                pathOptions={{ color: "#8b5cf6", weight: 2, opacity: 0.5, dashArray: "6 4" }}
              />
            )}
            {points.map((p) => (
              <Marker
                key={p.item.id}
                position={p.coords}
                icon={makeIcon(dotColor(p.item.date))}
              >
                <Popup>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{p.item.title}</div>
                    <div style={{ color: "#888", fontSize: 12 }}>
                      {p.item.date}{p.item.time ? ` ${p.item.time}` : ""}
                    </div>
                    {p.item.location && (
                      <div style={{ color: "#aaa", fontSize: 11, marginTop: 2 }}>{p.item.location}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            <FitBounds points={points} />
          </MapContainer>
        </div>
      )}
      {!loadingGeo && points.length === 0 && itemsWithLocation.length > 0 && (
        <div className="text-zinc-600 text-sm text-center py-8">無法解析地點座標，請確認地點名稱是否正確</div>
      )}
    </div>
  );
}
