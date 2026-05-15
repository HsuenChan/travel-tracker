"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCountryFlags } from "@/lib/countries";
import "./present.css";

// ── Types ─────────────────────────────────────────────────────────────────

interface Trip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  countries: string | null;
  photo_album_id: string | null;
  people: string[] | null;
}

interface ItineraryItem {
  id: string;
  date: string;
  time: string | null;
  title: string;
  category: string | null;
  location: string | null;
}

interface MediaItem {
  id: string;
  baseUrl: string;
  filename: string;
  mediaMetadata: { creationTime?: string; width: string; height: string };
}

type Template = "cinema" | "minimal" | "vibrant" | "photo";

type Slide =
  | { kind: "cover" }
  | { kind: "day"; date: string; dayNum: number; dateLabel: string; items: ItineraryItem[]; pageNum: number; totalPages: number }
  | { kind: "photo"; url: string; filename: string; creationTime?: string }
  | { kind: "closing" };

// ── Constants ─────────────────────────────────────────────────────────────

const ITEMS_PER_SLIDE = 5;
const PHOTOS_PER_DAY_MAX = 5;

const TEMPLATES: Template[] = ["cinema", "minimal", "vibrant", "photo"];

const TPL_META: Record<Template, { emoji: string; label: string; activeColor: string; activeBg: string }> = {
  cinema:  { emoji: "🎬", label: "Cinema",   activeColor: "#a5b4fc", activeBg: "rgba(99,102,241,.25)" },
  minimal: { emoji: "☁️", label: "Minimal",  activeColor: "#6b7280", activeBg: "rgba(156,163,175,.2)" },
  vibrant: { emoji: "🌸", label: "Vibrant",  activeColor: "#f472b6", activeBg: "rgba(244,114,182,.22)" },
  photo:   { emoji: "🖼", label: "Photo BG", activeColor: "#fbbf24", activeBg: "rgba(251,191,36,.2)" },
};

const CAT_CSS: Record<string, string> = {
  food: "pres-cat-food", hotel: "pres-cat-food", shopping: "pres-cat-food",
  attraction: "pres-cat-attraction", nature: "pres-cat-attraction",
  activity: "pres-cat-activity", experience: "pres-cat-activity", transport: "pres-cat-activity",
  other: "pres-cat-attraction",
};
const CAT_EMOJI: Record<string, string> = {
  food: "🍜", hotel: "🏨", shopping: "🛍", attraction: "🏛",
  nature: "🌿", activity: "🎌", experience: "🎌", transport: "🚌", other: "📌",
};
const CAT_LABEL: Record<string, string> = {
  transport: "交通", hotel: "住宿", food: "餐飲", attraction: "景點",
  shopping: "購物", activity: "活動", experience: "體驗", other: "其他",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${m}月${day}日 週${wd}`;
}

function getDays(trip: Trip): number {
  if (!trip.start_date || !trip.end_date) return 0;
  return (
    Math.round(
      (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1
  );
}

// Shuffle array (Fisher-Yates) — returns a new array
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Extract YYYY-MM-DD from Google Photos creationTime.
// Google Photos stores camera EXIF local time as UTC (no tz conversion),
// so we take the date portion directly from the ISO string — not via new Date()
// which would shift the date based on the browser's timezone.
function photoDateKey(creationTime: string): string {
  return creationTime.slice(0, 10); // "2025-03-15T08:30:00Z" → "2025-03-15"
}

// ── Slide builder ─────────────────────────────────────────────────────────

function buildSlides(itinerary: ItineraryItem[], photos: MediaItem[]): Slide[] {
  const slides: Slide[] = [{ kind: "cover" }];

  // Group itinerary by date
  const byDate = new Map<string, ItineraryItem[]>();
  for (const item of itinerary) {
    const arr = byDate.get(item.date) ?? [];
    arr.push(item);
    byDate.set(item.date, arr);
  }

  // Group photos by date (using local date from creationTime)
  const photosByDate = new Map<string, MediaItem[]>();
  for (const p of photos) {
    if (!p.mediaMetadata.creationTime) continue;
    const key = photoDateKey(p.mediaMetadata.creationTime);
    const arr = photosByDate.get(key) ?? [];
    arr.push(p);
    photosByDate.set(key, arr);
  }

  const sortedDates = Array.from(byDate.keys()).sort();

  sortedDates.forEach((date, i) => {
    // ── Itinerary slides for this day ──
    const items = byDate.get(date)!;
    const totalPages = Math.ceil(items.length / ITEMS_PER_SLIDE);
    for (let p = 0; p < totalPages; p++) {
      slides.push({
        kind: "day",
        date,
        dayNum: i + 1,
        dateLabel: formatDateLabel(date),
        items: items.slice(p * ITEMS_PER_SLIDE, (p + 1) * ITEMS_PER_SLIDE),
        pageNum: p + 1,
        totalPages,
      });
    }

    // ── Photo slides for this day ──
    // Randomly select up to PHOTOS_PER_DAY_MAX photos from this day
    const dayPhotos = photosByDate.get(date) ?? [];
    const selected = shuffle(dayPhotos).slice(0, PHOTOS_PER_DAY_MAX);
    // Sort selected photos back by time so they appear chronologically
    selected.sort((a, b) => {
      const ta = a.mediaMetadata.creationTime ?? "";
      const tb = b.mediaMetadata.creationTime ?? "";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    for (const p of selected) {
      slides.push({
        kind: "photo",
        url: `${p.baseUrl}=w1920`,
        filename: p.filename,
        creationTime: p.mediaMetadata.creationTime,
      });
    }
  });

  // If no itinerary but photos exist, show up to 30 photos chronologically
  if (sortedDates.length === 0 && photos.length > 0) {
    const sorted = [...photos]
      .filter((p) => p.mediaMetadata.creationTime)
      .sort((a, b) => (a.mediaMetadata.creationTime! < b.mediaMetadata.creationTime! ? -1 : 1));
    for (const p of sorted.slice(0, 30)) {
      slides.push({
        kind: "photo",
        url: `${p.baseUrl}=w1920`,
        filename: p.filename,
        creationTime: p.mediaMetadata.creationTime,
      });
    }
  }

  slides.push({ kind: "closing" });
  return slides;
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  trip: Trip;
  itinerary: ItineraryItem[];
}

export default function PresentClient({ trip, itinerary }: Props) {
  const router = useRouter();
  const [tpl, setTpl] = useState<Template>("cinema");
  const [idx, setIdx] = useState(0);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const touchStartX = useRef<number | null>(null);
  // Stable random seed per render so slides don't reshuffle on template change
  const slidesRef = useRef<Slide[] | null>(null);

  const slides = useMemo(() => {
    // Rebuild slides only when itinerary or photos change (not template)
    const built = buildSlides(itinerary, photos);
    slidesRef.current = built;
    return built;
  }, [itinerary, photos]);

  const total = slides.length;
  const slide = slides[Math.min(idx, total - 1)];

  // Fetch ALL album photos (follow nextPageToken, max 5 pages ≈ 250 photos)
  useEffect(() => {
    if (!trip.photo_album_id) return;
    const albumUrl = trip.photo_album_id;
    const albumIdMatch = albumUrl.match(/\/album\/([A-Za-z0-9_-]+)/);
    const baseApiUrl = albumIdMatch
      ? `/api/photos?albumId=${encodeURIComponent(albumIdMatch[1])}`
      : `/api/photos?shareUrl=${encodeURIComponent(albumUrl)}`;

    (async () => {
      const all: MediaItem[] = [];
      let pageToken: string | null = null;
      const MAX_PAGES = 5;
      for (let page = 0; page < MAX_PAGES; page++) {
        try {
          const url: string = pageToken
            ? `${baseApiUrl}&pageToken=${encodeURIComponent(pageToken)}`
            : baseApiUrl;
          const data: { mediaItems?: MediaItem[]; nextPageToken?: string } =
            await fetch(url, { cache: "no-store" }).then((r) => r.json());
          if ((data.mediaItems?.length ?? 0) > 0) {
            all.push(...(data.mediaItems as MediaItem[]));
          }
          if (data.nextPageToken) {
            pageToken = data.nextPageToken;
          } else {
            break;
          }
        } catch {
          break;
        }
      }
      if (all.length > 0) setPhotos(all);
    })();
  }, [trip.photo_album_id]);

  // Navigation
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx((i) => Math.min(total - 1, i + 1)), [total]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, router]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Touch swipe
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
  }

  // Photo BG: pick a photo from the album for non-photo slides
  const bgPhotoUrl = useMemo(() => {
    if (tpl !== "photo" || photos.length === 0 || slide.kind === "photo") return null;
    return `${photos[idx % photos.length].baseUrl}=w1600`;
  }, [tpl, photos, slide.kind, idx]);

  const flags = getCountryFlags(trip.countries ?? "");
  const days = getDays(trip);
  const countries = (trip.countries ?? "").split(/[,，、]/).map((c) => c.trim()).filter(Boolean);
  const peopleCount = trip.people?.length ?? 0;

  return (
    <div className={`pres-stage ${tpl}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* ── Template switcher (top-right floating) ─────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          display: "flex",
          gap: 6,
          zIndex: 20,
          alignItems: "center",
        }}
      >
        {TEMPLATES.map((t) => {
          const meta = TPL_META[t];
          const active = t === tpl;
          return (
            <button
              key={t}
              onClick={() => setTpl(t)}
              title={meta.label}
              style={{
                height: 34,
                padding: "0 10px",
                borderRadius: 100,
                border: active ? `1px solid ${meta.activeColor}` : "1px solid rgba(255,255,255,0.12)",
                background: active ? meta.activeBg : "rgba(0,0,0,0.35)",
                color: active ? meta.activeColor : "rgba(255,255,255,0.55)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                backdropFilter: "blur(10px)",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>{meta.emoji}</span>
              <span
                style={{
                  display: "none",
                  // show label on wider screens via CSS below
                }}
                className="pres-tpl-label"
              >
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Slide area ─────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: "0 0 52px 0", overflow: "hidden" }}>
        {/* Photo BG layers */}
        {bgPhotoUrl && (
          <>
            <img className="pres-album-img" src={bgPhotoUrl} alt="" />
            <div
              className="pres-album-overlay"
              style={{
                background:
                  slide.kind === "cover"
                    ? "linear-gradient(160deg,rgba(0,0,0,.22) 0%,rgba(0,0,0,.6) 100%)"
                    : slide.kind === "closing"
                      ? "linear-gradient(to top,rgba(0,0,0,.7) 0%,rgba(0,0,0,.3) 100%)"
                      : "rgba(0,0,0,.52)",
              }}
            />
          </>
        )}

        {/* Cover */}
        {slide.kind === "cover" && (
          <div
            className="pres-cover"
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "0 clamp(20px,5vw,80px)", textAlign: "center",
            }}
          >
            {flags && <div style={{ fontSize: "clamp(28px,5vw,52px)", lineHeight: 1 }}>{flags}</div>}
            <div
              className="pres-title"
              style={{ fontSize: "clamp(22px,4.5vw,52px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.15 }}
            >
              {trip.name}
            </div>
            {(trip.start_date || trip.end_date) && (
              <div className="pres-sub" style={{ fontSize: "clamp(12px,1.6vw,18px)", letterSpacing: "0.05em", marginTop: 2 }}>
                {trip.start_date} → {trip.end_date}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
              {days > 0 && (
                <span className="pres-tag" style={{ fontSize: "clamp(10px,1.2vw,14px)", padding: "4px 13px", borderRadius: 100 }}>
                  {days} 天
                </span>
              )}
              {countries.map((c) => (
                <span key={c} className="pres-tag" style={{ fontSize: "clamp(10px,1.2vw,14px)", padding: "4px 13px", borderRadius: 100 }}>
                  📍 {c}
                </span>
              ))}
              {peopleCount > 0 && (
                <span className="pres-tag" style={{ fontSize: "clamp(10px,1.2vw,14px)", padding: "4px 13px", borderRadius: 100 }}>
                  👥 {peopleCount} 人
                </span>
              )}
            </div>
          </div>
        )}

        {/* Day */}
        {slide.kind === "day" && (
          <div
            className="pres-day"
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "flex", flexDirection: "column",
              padding: "clamp(16px,3vw,36px)",
            }}
          >
            <div
              className="pres-day-hd pres-title"
              style={{
                fontSize: "clamp(12px,1.6vw,18px)", fontWeight: 700,
                paddingBottom: 10, marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span>
                Day {slide.dayNum} · {slide.dateLabel}
                {slide.totalPages > 1 && (
                  <span style={{ opacity: 0.5, fontWeight: 400, fontSize: "0.85em" }}>
                    {" "}({slide.pageNum}/{slide.totalPages})
                  </span>
                )}
              </span>
              <span className="pres-sub" style={{ fontSize: "clamp(10px,1.1vw,13px)", fontWeight: 400 }}>
                {slide.items.length} 個行程
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(6px,1vh,10px)", flex: 1 }}>
              {slide.items.map((item) => {
                const catCss  = CAT_CSS[item.category ?? "other"]   ?? "pres-cat-attraction";
                const catEmoji = CAT_EMOJI[item.category ?? "other"] ?? "📌";
                const catLabel = CAT_LABEL[item.category ?? "other"] ?? "其他";
                return (
                  <div
                    key={item.id}
                    className="pres-card"
                    style={{
                      display: "flex", alignItems: "center",
                      gap: "clamp(6px,1vw,10px)",
                      padding: "clamp(7px,1.2vh,12px) clamp(10px,1.4vw,16px)",
                      borderRadius: 12,
                    }}
                  >
                    {item.time && (
                      <span
                        className="pres-time"
                        style={{
                          fontSize: "clamp(10px,1.1vw,14px)", fontWeight: 700,
                          minWidth: 36, flexShrink: 0, fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {item.time.slice(0, 5)}
                      </span>
                    )}
                    <span
                      className={catCss}
                      style={{
                        fontSize: "clamp(9px,0.95vw,12px)", padding: "2px 7px",
                        borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      {catEmoji} {catLabel}
                    </span>
                    <span
                      className="pres-iname"
                      style={{
                        fontSize: "clamp(11px,1.4vw,17px)", fontWeight: 600,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        flex: 1, minWidth: 0,
                      }}
                    >
                      {item.title}
                    </span>
                    {item.location && (
                      <span
                        className="pres-iloc"
                        style={{
                          fontSize: "clamp(9px,1vw,12px)", flexShrink: 0,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "28%",
                        }}
                      >
                        📍 {item.location}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo */}
        {slide.kind === "photo" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <img
              src={slide.url}
              alt={slide.filename}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "20px 24px",
                background: "linear-gradient(to top, rgba(0,0,0,.78) 0%, transparent 100%)",
              }}
            >
              <div style={{ fontSize: "clamp(12px,1.5vw,17px)", fontWeight: 600, color: "#fff" }}>
                {slide.filename}
              </div>
              {slide.creationTime && (
                <div style={{ fontSize: "clamp(10px,1.1vw,13px)", color: "rgba(255,255,255,.5)", marginTop: 4 }}>
                  {new Date(slide.creationTime).toLocaleDateString("zh-TW", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Closing */}
        {slide.kind === "closing" && (
          <div
            className="pres-close"
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, textAlign: "center", padding: "0 clamp(20px,5vw,80px)",
            }}
          >
            <div style={{ fontSize: "clamp(36px,6vw,64px)", lineHeight: 1 }}>✈️</div>
            <div
              className="pres-title"
              style={{ fontSize: "clamp(20px,3.2vw,40px)", fontWeight: 900, letterSpacing: "-0.01em" }}
            >
              謝謝你的陪伴
            </div>
            <div className="pres-sub" style={{ fontSize: "clamp(11px,1.3vw,16px)", marginTop: 4 }}>
              {trip.name}
              {days > 0 && ` · ${days} 天`}
              {photos.length > 0 && ` · ${photos.length} 張照片`}
            </div>
            <div style={{ marginTop: 12 }}>
              <span
                className="pres-tag"
                style={{ fontSize: "clamp(10px,1.1vw,14px)", padding: "5px 16px", borderRadius: 100, letterSpacing: "0.05em" }}
              >
                ✦ Travel Tracker
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Prev / Next click areas ─────────────────────────────────── */}
      {idx > 0 && (
        <button
          onClick={prev}
          aria-label="上一張"
          style={{
            position: "absolute", left: 0, top: 0, bottom: 52, width: "14%",
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", paddingLeft: 14, zIndex: 10,
            opacity: 0, transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
        >
          <span style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26 }}>‹</span>
        </button>
      )}
      {idx < total - 1 && (
        <button
          onClick={next}
          aria-label="下一張"
          style={{
            position: "absolute", right: 0, top: 0, bottom: 52, width: "14%",
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 14, zIndex: 10,
            opacity: 0, transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
        >
          <span style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26 }}>›</span>
        </button>
      )}

      {/* ── Close button ───────────────────────────────────────────── */}
      <button
        onClick={() => router.back()}
        aria-label="關閉"
        style={{
          position: "absolute", top: 14, left: 14,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%",
          width: 38, height: 38,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#fff", fontSize: 16, zIndex: 20,
        }}
      >
        ✕
      </button>

      {/* ── Nav bar ────────────────────────────────────────────────── */}
      <div
        className="pres-nav"
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 52,
          display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
          paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 20,
        }}
      >
        {/* Progress bar */}
        <div className="pres-prog" style={{ flex: 1, height: 4, borderRadius: 2, overflow: "hidden" }}>
          <div
            className="pres-prog-fill"
            style={{ height: "100%", borderRadius: 2, width: `${((idx + 1) / total) * 100}%`, transition: "width 0.3s ease" }}
          />
        </div>
        {/* Counter */}
        <span className="pres-counter" style={{ fontSize: 12, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {idx + 1} / {total}
        </span>
      </div>
    </div>
  );
}
