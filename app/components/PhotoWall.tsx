"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spin, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";

interface MediaItem {
  id: string;
  baseUrl: string;
  mediaMetadata: { width: string; height: string; creationTime?: string };
  filename: string;
}

interface Props {
  albumUrl: string;
}

export default function PhotoWall({ albumUrl }: Props) {
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const baseUrl = `/api/photos?shareUrl=${encodeURIComponent(albumUrl)}`;

  useEffect(() => {
    fetch(baseUrl)
      .then((r) => r.json())
      .then((data) => {
        if (data.mediaItems?.length > 0) {
          setPhotos(data.mediaItems);
          setNextPageToken(data.nextPageToken ?? null);
        } else if (data.error) {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [albumUrl]);

  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    try {
      const data = await fetch(`${baseUrl}&pageToken=${encodeURIComponent(nextPageToken)}`).then((r) => r.json());
      if (data.mediaItems?.length > 0) {
        setPhotos((prev) => [...prev, ...data.mediaItems]);
        setNextPageToken(data.nextPageToken ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const openLightbox = useCallback((i: number) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevPhoto = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null)),
    [photos.length],
  );
  const nextPhoto = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i + 1) % photos.length : null)),
    [photos.length],
  );

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      else if (e.key === "ArrowRight") nextPhoto();
      else if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, prevPhoto, nextPhoto, closeLightbox]);

  // Prevent background scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxIndex !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIndex]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ marginTop: 32, padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Spin size="large" />
        <Typography.Text style={{ color: "#71717a", fontSize: 13 }}>載入照片中…</Typography.Text>
      </div>
    );
  }

  // ── Error / empty ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ marginTop: 32 }}>
        <a href={albumUrl} target="_blank" rel="noopener noreferrer">
          <Button icon={<PictureOutlined />} size="large" block>
            查看 Google Photos 相簿
          </Button>
        </a>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div style={{ marginTop: 32 }}>
        <Typography.Text style={{ color: "#71717a" }}>相簿中沒有照片</Typography.Text>
      </div>
    );
  }

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography.Text strong style={{ color: "#f4f4f5", fontSize: 15 }}>
          照片{nextPageToken ? `（${photos.length}+）` : `（${photos.length}）`}
        </Typography.Text>
        <a href={albumUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#71717a", fontSize: 12 }}>
          在 Google Photos 開啟 ↗
        </a>
      </div>

      {/* Masonry grid — CSS columns creates the natural irregular height pattern */}
      <div style={{ columns: "2 160px", columnGap: 6 }}>
        {photos.map((photo, index) => (
          <LazyPhoto key={photo.id} photo={photo} index={index} onClick={openLightbox} />
        ))}
      </div>

      {nextPageToken && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Button onClick={loadMore} loading={loadingMore}>
            載入更多
          </Button>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {currentPhoto && (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.96)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Full-resolution image */}
          <img
            src={`${currentPhoto.baseUrl}=w1600`}
            alt={currentPhoto.filename}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw", maxHeight: "90vh",
              objectFit: "contain", borderRadius: 6,
              userSelect: "none",
            }}
          />

          {/* Close */}
          <button
            onClick={closeLightbox}
            style={iconBtn({ top: 16, right: 16 })}
          >
            ✕
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              style={iconBtn({ top: "50%", left: 12, transform: "translateY(-50%)", fontSize: 24 })}
            >
              ‹
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              style={iconBtn({ top: "50%", right: 12, transform: "translateY(-50%)", fontSize: 24 })}
            >
              ›
            </button>
          )}

          {/* Counter */}
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.45)", fontSize: 13, pointerEvents: "none",
          }}>
            {lightboxIndex! + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LazyPhoto ──────────────────────────────────────────────────────────────
// Renders an aspect-ratio placeholder until the element scrolls into view,
// then swaps in the real image with a fade-in transition.
function LazyPhoto({
  photo, index, onClick,
}: {
  photo: MediaItem;
  index: number;
  onClick: (i: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const w = Math.max(1, parseInt(photo.mediaMetadata.width) || 1);
  const h = Math.max(1, parseInt(photo.mediaMetadata.height) || 1);
  // paddingBottom trick preserves the correct aspect ratio before the image loads
  const aspectPercent = ((h / w) * 100).toFixed(2);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: "400px 0px" }, // pre-load 400px before entering viewport
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onClick={() => onClick(index)}
      style={{
        breakInside: "avoid",
        marginBottom: 6,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        background: "#1c1c1e",
      }}
    >
      {/* Spacer — keeps the correct height in the masonry column */}
      <div style={{ paddingBottom: `${aspectPercent}%` }} />

      {/* Image — absolutely positioned over the spacer */}
      {inView && (
        <img
          src={`${photo.baseUrl}=w800`}
          alt={photo.filename}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.35s ease",
          }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function iconBtn(extra: React.CSSProperties): React.CSSProperties {
  return {
    position: "absolute",
    background: "rgba(255,255,255,0.12)",
    border: "none",
    borderRadius: "50%",
    width: 42, height: 42,
    color: "#fff",
    cursor: "pointer",
    fontSize: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
    ...extra,
  };
}
