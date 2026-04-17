"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { parseCountriesToPoints, getCountryFlags } from "@/lib/countries";
import { preResolveLocations } from "@/lib/geocode";
import {
  toTransportKey, VEHICLE_ICON, ICON_BEARING, FOLLOW_ALTITUDE, getArcAltitude,
  getPlaneFollowAltitude,
} from "@/lib/transport";

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  countries: string;
  notes: string;
  photo_album_id: string;
}

interface Segment {
  id: string;
  trip_id: string;
  order: number;
  from_city: string;
  from_iata: string;
  to_city: string;
  to_iata: string;
  type: string;
}

interface Props {
  trips: Trip[];
  segments: Segment[];
  selectedTripId: string | null;
  onTripClick: (tripId: string) => void;
  showAllTracks: boolean;
}

const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#f87171", "#38bdf8", "#4ade80"];

// Stable constant — never recreated
const HOME_POINT = { lat: 23.6978, lng: 120.9605, isHome: true, isVehicle: false, isLabel: false, deg: 0, scale: 0, icon: '' };

// Great-circle interpolation
function greatCirclePoint(lat1: number, lng1: number, lat2: number, lng2: number, t: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lng1);
  const φ2 = toRad(lat2), λ2 = toRad(lng2);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return { lat: lat1, lng: lng1 };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))), lng: toDeg(Math.atan2(y, x)) };
}

// Calculate bearing for icon rotation
function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Compute POV to fit both endpoints in view
function routePOV(lat1: number, lng1: number, lat2: number, lng2: number) {
  const midLat = (lat1 + lat2) / 2;
  let midLng = (lng1 + lng2) / 2;
  const dLng = Math.abs(lng2 - lng1);
  if (dLng > 180) midLng = midLng > 0 ? midLng - 180 : midLng + 180;
  const dist = Math.sqrt((lat2 - lat1) ** 2 + Math.min(dLng, 360 - dLng) ** 2);
  const altitude = Math.max(0.5, Math.min(2.5, dist / 28));
  return { lat: midLat, lng: midLng, altitude };
}

export default function TripGlobe({ trips, segments, selectedTripId, onTripClick, showAllTracks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const globeReadyRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GlobeComponent, setGlobeComponent] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [arcProgresses, setArcProgresses] = useState<number[]>([]);
  const [vehicleState, setVehicleState] = useState<{
    lat: number; lng: number; icon: string; deg: number; scale: number;
  } | null>(null);
  const [activeLabel, setActiveLabel] = useState<{
    fromLabel: string; fromPt: { lat: number; lng: number };
    toLabel: string; toPt: { lat: number; lng: number };
  } | null>(null);
  const [locationMap, setLocationMap] = useState<Map<string, { lat: number; lng: number } | null>>(new Map());
  const [allLocationMap, setAllLocationMap] = useState<Map<string, { lat: number; lng: number } | null>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    import("react-globe.gl").then((mod) => setGlobeComponent(() => mod.default));
  }, []);

  const handleGlobeRef = useCallback((ref: unknown) => {
    globeRef.current = ref;
    if (ref && !globeReadyRef.current) {
      globeReadyRef.current = true;
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ref as any).pointOfView({ lat: 23.7, lng: 121.0, altitude: 2.0 }, 0);
      }, 100);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setDimensions({ width: el.clientWidth, height: el.clientHeight }));
    obs.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // Pre-resolve all segment locations when showing all tracks
  useEffect(() => {
    if (!showAllTracks || segments.length === 0) return;
    const queries = segments.flatMap((seg) => [
      (seg.from_iata || "").trim() || seg.from_city,
      (seg.to_iata || "").trim() || seg.to_city,
    ]);
    preResolveLocations(queries).then(setAllLocationMap);
  }, [showAllTracks, segments]);

  // Animation controller
  useEffect(() => {
    setArcProgresses([]);
    setVehicleState(null);
    setActiveLabel(null);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (!selectedTripId) return;

    const tripSegs = segments
      .filter((s) => s.trip_id === selectedTripId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (tripSegs.length === 0) return;

    let cancelled = false;

    (async () => {
      const queries = tripSegs.flatMap((seg) => {
        const fk = (seg.from_iata || "").trim() || seg.from_city;
        const tk = (seg.to_iata || "").trim() || seg.to_city;
        return [fk, tk];
      });
      const resolved = await preResolveLocations(queries);
      if (cancelled) return;
      setLocationMap(resolved);

      const INTERVAL = 5000;
      const VEHICLE_DUR = 3000;
      const START_ZOOM_DUR = 900;
      const VEHICLE_START = 1050;

      tripSegs.forEach((seg, i) => {
        const t0 = setTimeout(() => {
          if (cancelled) return;
          setActiveLabel(null);
          const fromKey = (seg.from_iata || "").trim() || seg.from_city;
          const toKey = (seg.to_iata || "").trim() || seg.to_city;
          const from = resolved.get(fromKey) ?? null;
          const to = resolved.get(toKey) ?? null;
          if (!from || !to) return;
          const fromPt = from!;
          const toPt = to!;

          const transportKey = toTransportKey(seg.type);
          const icon = VEHICLE_ICON[transportKey];
          const iconOffset = ICON_BEARING[transportKey];
          const isPlane = transportKey === "plane";

          if (isPlane) {
            const followAlt = getPlaneFollowAltitude(fromPt, toPt);
            globeRef.current?.pointOfView({ lat: fromPt.lat, lng: fromPt.lng, altitude: followAlt }, START_ZOOM_DUR);
          } else {
            const pov = routePOV(fromPt.lat, fromPt.lng, toPt.lat, toPt.lng);
            globeRef.current?.pointOfView(pov, START_ZOOM_DUR);
          }

          const t1 = setTimeout(() => {
            if (cancelled) return;
            const startTime = Date.now();
            const followAlt = isPlane ? getPlaneFollowAltitude(fromPt, toPt) : routePOV(fromPt.lat, fromPt.lng, toPt.lat, toPt.lng).altitude;

            function animate() {
              if (cancelled) return;
              const t = Math.min((Date.now() - startTime) / VEHICLE_DUR, 1);
              const pos = greatCirclePoint(fromPt.lat, fromPt.lng, toPt.lat, toPt.lng, t);

              let rawBearing: number;
              if (t < 0.98) {
                const next = greatCirclePoint(fromPt.lat, fromPt.lng, toPt.lat, toPt.lng, t + 0.015);
                rawBearing = bearing(pos.lat, pos.lng, next.lat, next.lng);
              } else {
                const prev = greatCirclePoint(fromPt.lat, fromPt.lng, toPt.lat, toPt.lng, t - 0.015);
                rawBearing = bearing(prev.lat, prev.lng, pos.lat, pos.lng);
              }

              const scale = isPlane
                ? (t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1)
                : 1;

              setVehicleState({ lat: pos.lat, lng: pos.lng, icon, deg: rawBearing - iconOffset, scale });
              setArcProgresses((prev) => {
                const next = [...prev];
                while (next.length <= i) next.push(0);
                next[i] = t;
                return next;
              });
              globeRef.current?.pointOfView({ lat: pos.lat, lng: pos.lng, altitude: followAlt }, 80);

              if (t < 1) {
                animFrameRef.current = requestAnimationFrame(animate);
              } else {
                setVehicleState(null);
                const fromLabel = (seg.from_iata && seg.from_city && seg.from_iata !== seg.from_city)
                  ? `${seg.from_iata} · ${seg.from_city}`
                  : seg.from_iata || seg.from_city;
                const toLabel = (seg.to_iata && seg.to_city && seg.to_iata !== seg.to_city)
                  ? `${seg.to_iata} · ${seg.to_city}`
                  : seg.to_iata || seg.to_city;
                setActiveLabel({ fromLabel, fromPt, toLabel, toPt });
              }
            }

            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = requestAnimationFrame(animate);
          }, VEHICLE_START);

          timersRef.current.push(t1);
        }, i * INTERVAL);

        timersRef.current.push(t0);
      });
    })();

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [selectedTripId, segments]);

  const tripColor = selectedTripId
    ? COLORS[trips.findIndex((t) => t.id === selectedTripId) % COLORS.length]
    : "#60a5fa";

  const flagPoints = useMemo(() =>
    trips.flatMap((trip, i) =>
      parseCountriesToPoints(trip.countries ?? "", trip.id, trip.name, COLORS[i % COLORS.length]).map((p) => ({
        ...p, flag: getCountryFlags(p.country), isVehicle: false, isHome: false,
        isSelected: trip.id === selectedTripId, deg: 0, scale: 0, icon: '',
      }))
    ), [trips, selectedTripId]);

  const selectedSegs = useMemo(() =>
    selectedTripId
      ? segments
        .filter((s) => s.trip_id === selectedTripId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, arcProgresses.length)
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, selectedTripId, arcProgresses.length]);

  const arcs = useMemo(() =>
    selectedSegs
      .map((seg, idx) => {
        const fromKey = (seg.from_iata || "").trim() || seg.from_city;
        const toKey = (seg.to_iata || "").trim() || seg.to_city;
        const from = locationMap.get(fromKey) ?? null;
        const to = locationMap.get(toKey) ?? null;
        if (!from || !to) return null;
        const progress = arcProgresses[idx] ?? 0;
        return {
          startLat: from.lat, startLng: from.lng,
          endLat: to.lat, endLng: to.lng,
          color: tripColor,
          alt: getArcAltitude(toTransportKey(seg.type), from, to),
          dashLength: progress,
          dashGap: progress >= 1 ? 0 : 100,
          initialGap: progress >= 1 ? 0 : 1 - progress,
        };
      })
      .filter(Boolean),
    [selectedSegs, locationMap, arcProgresses, tripColor]);

  const staticArcs = useMemo(() =>
    showAllTracks
      ? segments.flatMap((seg) => {
          const tripIdx = trips.findIndex((t) => t.id === seg.trip_id);
          if (tripIdx === -1) return [];
          const color = COLORS[tripIdx % COLORS.length];
          const fromKey = (seg.from_iata || "").trim() || seg.from_city;
          const toKey = (seg.to_iata || "").trim() || seg.to_city;
          const from = allLocationMap.get(fromKey) ?? null;
          const to = allLocationMap.get(toKey) ?? null;
          if (!from || !to) return [];
          return [{
            startLat: from.lat, startLng: from.lng,
            endLat: to.lat, endLng: to.lng,
            color,
            alt: getArcAltitude(toTransportKey(seg.type), from, to),
            dashLength: 1, dashGap: 0, initialGap: 0,
            isStatic: true,
          }];
        })
      : [],
    [showAllTracks, segments, trips, allLocationMap]);

  const allArcs = useMemo(() => [...staticArcs, ...arcs], [staticArcs, arcs]);

  const labelPoints = useMemo(() => activeLabel ? [
    { lat: activeLabel.fromPt.lat, lng: activeLabel.fromPt.lng, isLabel: true, isVehicle: false, isHome: false, labelText: activeLabel.fromLabel, deg: 0, scale: 0, icon: '' },
    { lat: activeLabel.toPt.lat, lng: activeLabel.toPt.lng, isLabel: true, isVehicle: false, isHome: false, labelText: activeLabel.toLabel, deg: 0, scale: 0, icon: '' },
  ] : [], [activeLabel]);

  const vehiclePoint = vehicleState
    ? { ...vehicleState, isVehicle: true, isHome: false, isLabel: false }
    : null;

  const allPoints = [
    HOME_POINT,
    ...flagPoints,
    ...labelPoints,
    ...(vehiclePoint ? [vehiclePoint] : []),
  ];

  const htmlElementCallback = useCallback((d: object) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = d as any;
    const el = document.createElement("div");

    if (p.isHome) {
      el.style.cssText = "pointer-events:none;transform:translate(-50%,-50%);";
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-4 h-4 bg-white/40 rounded-full animate-ping"></div>
          <div class="relative w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,1)]"></div>
        </div>`;
    } else if (p.isLabel) {
      el.style.cssText = "pointer-events:none;transform:translate(-50%,-140%);opacity:0;transition:opacity 0.4s ease";
      el.innerHTML = `<div style="background:rgba(0,0,0,0.85);color:#f4f4f5;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px;white-space:nowrap;border:1px solid rgba(255,255,255,0.18);box-shadow:0 2px 12px rgba(0,0,0,0.7);letter-spacing:0.3px">${p.labelText}</div>`;
      requestAnimationFrame(() => { el.style.opacity = "1"; });
    } else if (p.isVehicle) {
      el.style.cssText = 'pointer-events:none';
      el.innerHTML = `<div style="font-size:32px;line-height:1;transform:scale(${p.scale}) rotate(${p.deg}deg);filter:drop-shadow(0 2px 6px rgba(0,0,0,0.9)) drop-shadow(0 0 10px rgba(255,255,255,0.5))">${p.icon}</div>`;
    } else {
      const color = p.color || "#8b5cf6";
      const size = p.isSelected ? "12px" : "8px";
      el.style.cssText = "cursor:pointer;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%)";
      el.innerHTML = `
        <div style="position:relative;width:${size};height:${size};display:flex;items-center;justify-content:center;">
          <div style="position:absolute;inset:-4px;background:${color};opacity:0.4;border-radius:50%;filter:blur(4px);display:${p.isSelected ? 'block' : 'none'}"></div>
          <div style="width:100%;height:100%;background:${color};border-radius:50%;box-shadow:0 0 8px ${color}, 0 0 16px ${color};border:1.5px solid #fff;"></div>
        </div>
        <div style="margin-top:6px;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px;white-space:nowrap;border:1px solid rgba(255,255,255,0.15);box-shadow:0 4px 12px rgba(0,0,0,0.5);">${p.tripName}</div>`;
      el.addEventListener("click", () => onTripClick(p.tripId));
    }
    return el;
  }, [onTripClick]);

  return (
    <div ref={containerRef} className="w-full h-full">
      {GlobeComponent && (
        <GlobeComponent
          ref={handleGlobeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          htmlElementsData={allPoints}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.02}
          htmlElement={htmlElementCallback}
          arcsData={allArcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcAltitude={(arc: object) => (arc as { alt: number }).alt}
          arcStroke={(arc: object) => (arc as { isStatic?: boolean }).isStatic ? 0.2 : 0.4}
          arcDashLength={(arc: object) => (arc as { dashLength: number }).dashLength}
          arcDashGap={(arc: object) => (arc as { dashGap: number }).dashGap}
          arcDashInitialGap={(arc: object) => (arc as { initialGap: number }).initialGap}
          arcDashAnimateTime={0}
        />
      )}
    </div>
  );
}
