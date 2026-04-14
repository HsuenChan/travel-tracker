"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spin, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";

interface MediaItem {
  id: string;
  baseUrl: string;
  isVideo?: boolean;
  videoUrl?: string;
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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [videoError, setVideoError] = useState(false);

  // /album/{id} URLs → use albumId mode directly (no server-side resolution needed).
  // All other URLs (including /share/{token}) → pass as shareUrl and let the API handle them.
  const albumIdMatch = albumUrl.match(/\/album\/([A-Za-z0-9_\-]+)/);
  const baseUrl = albumIdMatch
    ? `/api/photos?albumId=${encodeURIComponent(albumIdMatch[1])}`
    : `/api/photos?shareUrl=${encodeURIComponent(albumUrl)}`;

  useEffect(() => {
    fetch(baseUrl, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.mediaItems?.length > 0) {
          setPhotos(data.mediaItems);
          setNextPageToken(data.nextPageToken ?? null);
        } else if (data.error) {
          setErrorCode(data.error as string);
        }
      })
      .catch(() => setErrorCode("network"))
      .finally(() => setLoading(false));
  }, [albumUrl]);

  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    try {
      const data = await fetch(`${baseUrl}&pageToken=${encodeURIComponent(nextPageToken)}`).then((r) => r.json());
      if (data.mediaItems?.length > 0) {
        setPhotos((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = (data.mediaItems as MediaItem[]).filter((p) => !seen.has(p.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        setNextPageToken(data.nextPageToken ?? null);
      } else {
        setNextPageToken(null);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const openLightbox = useCallback((i: number) => { setLightboxIndex(i); setVideoError(false); }, []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevPhoto = useCallback(() => {
    setVideoError(false);
    setLightboxIndex((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null));
  }, [photos.length]);
  const nextPhoto = useCallback(() => {
    setVideoError(false);
    setLightboxIndex((i) => (i !== null ? (i + 1) % photos.length : null));
  }, [photos.length]);

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
  if (errorCode) {
    const isShortUrl = errorCode === "short_url";
    return (
      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
        {isShortUrl && (
          <Typography.Text style={{ color: "#a1a1aa", fontSize: 13 }}>
            短網址（photos.app.goo.gl）無法在伺服器讀取。<br />
            請在 Google Photos 開啟相簿，從瀏覽器網址列複製完整連結（<code style={{ color: "#71717a" }}>https://photos.google.com/album/...</code>），再至「編輯旅程」更新。
          </Typography.Text>
        )}
        <a href={albumUrl} target="_blank" rel="noopener noreferrer">
          <Button icon={<PictureOutlined />} size="large" block>
            在 Google Photos 開啟相簿
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
          照片（{photos.length}）
        </Typography.Text>
        <a href={albumUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#71717a", fontSize: 12 }}>
          在 Google Photos 開啟 ↗
        </a>
      </div>

      {/* Justified gallery — same row height, width varies by aspect ratio, fills left-to-right */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {photos.map((photo, index) => (
          <LazyPhoto key={photo.id} photo={photo} index={index} onClick={openLightbox} />
        ))}
      </div>

      {nextPageToken ? (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Button onClick={loadMore} loading={loadingMore}>載入更多</Button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginTop: 20, paddingBottom: 8 }}>
          <Typography.Text style={{ color: "#52525b", fontSize: 12 }}>
            已顯示全部 {photos.length} 張・
          </Typography.Text>
          <a href={albumUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#52525b", fontSize: 12 }}>
            在 Google Photos 開啟 ↗
          </a>
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
          {/* Full-resolution image / video */}
          {currentPhoto.isVideo ? (
            videoError ? (
              /* Fallback: video URL failed — show thumbnail + link */
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
              >
                <img
                  src={`${currentPhoto.baseUrl}=w800`}
                  alt={currentPhoto.filename}
                  style={{ maxWidth: "82vw", maxHeight: "72vh", objectFit: "contain", borderRadius: 6, opacity: 0.7 }}
                />
                <a
                  href={albumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#fff", background: "rgba(255,255,255,0.15)",
                    padding: "8px 20px", borderRadius: 20, fontSize: 14, textDecoration: "none",
                  }}
                >
                  ▶ 在 Google Photos 播放影片 ↗
                </a>
              </div>
            ) : (
              <video
                key={currentPhoto.id}
                src={`/api/video?url=${encodeURIComponent(currentPhoto.videoUrl ?? `${currentPhoto.baseUrl}=m22`)}`}
                poster={`${currentPhoto.baseUrl}=w800`}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                onError={() => setVideoError(true)}
                style={{
                  maxWidth: "92vw", maxHeight: "90vh",
                  borderRadius: 6,
                }}
              />
            )
          ) : (
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
          )}

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

  const w = Number(photo.mediaMetadata.width) || 4;
  const h = Number(photo.mediaMetadata.height) || 3;
  const ROW_HEIGHT = 150;
  const flexBasis = Math.round((w / h) * ROW_HEIGHT);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: "400px 0px" },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onClick={() => onClick(index)}
      style={{
        flexGrow: 1,
        flexBasis: `${flexBasis}px`,
        maxWidth: `${flexBasis * 2}px`,
        height: ROW_HEIGHT,
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        background: "#1c1c1e",
        position: "relative",
      }}
    >
      {inView && (
        <img
          src={`${photo.baseUrl}=w600`}
          alt={photo.filename}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease",
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
