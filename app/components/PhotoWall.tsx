"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import PhotoFramePreview from "./PhotoFramePreview";
import PillButton from "./PillButton";

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
  const [previewPhoto, setPreviewPhoto] = useState<MediaItem | null>(null);

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

  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef(0);

  const openLightbox = useCallback((i: number) => { setLightboxIndex(i); setVideoError(false); setZoom(null); }, []);
  const closeLightbox = useCallback(() => { setLightboxIndex(null); setZoom(null); }, []);
  const prevPhoto = useCallback(() => {
    setVideoError(false);
    setZoom(null);
    setLightboxIndex((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null));
  }, [photos.length]);
  const nextPhoto = useCallback(() => {
    setVideoError(false);
    setZoom(null);
    setLightboxIndex((i) => (i !== null ? (i + 1) % photos.length : null));
  }, [photos.length]);

  // Touch: horizontal swipe switches photos (disabled while zoomed)
  function handleLightboxTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function handleLightboxTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || zoom || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextPhoto(); else prevPhoto();
    }
  }

  // Double-tap / double-click toggles 2.2x zoom centered on the tapped point
  function handleImageClick(e: React.MouseEvent) {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (zoom) {
        setZoom(null);
      } else {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setZoom({
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        });
      }
    } else {
      lastTapRef.current = now;
    }
  }

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
    // 固定的假比例，避免每次 render 算出來不一樣
    const ratios = [4/3, 1, 3/4, 16/9, 4/3, 3/4, 1, 4/3, 16/9, 4/3];
    const ROW_HEIGHT = 150;

    return (
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <Typography.Text strong className="text-zinc-100 text-[15px]">
            照片
          </Typography.Text>
        </div>
        <div className="flex flex-wrap gap-1">
          {ratios.map((ratio, i) => {
            const flexBasis = Math.round(ratio * ROW_HEIGHT);
            return (
              <div
                key={i}
                className="rounded-md bg-[#1c1c1e] animate-pulse"
                style={{
                  flexGrow: 1,
                  flexBasis: `${flexBasis}px`,
                  maxWidth: `${flexBasis * 2}px`,
                  height: ROW_HEIGHT,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ── Error / empty ────────────────────────────────────────────────────────
  if (errorCode) {
    const isShortUrl = errorCode === "short_url";
    return (
      <div className="mt-8 flex flex-col gap-2.5">
        {isShortUrl && (
          <Typography.Text className="text-zinc-400 text-[13px]">
            短網址（photos.app.goo.gl）無法在伺服器讀取。<br />
            請在 Google Photos 開啟相簿，從瀏覽器網址列複製完整連結（<code className="text-zinc-500">https://photos.google.com/album/...</code>），再至「編輯旅程」更新。
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
      <div className="mt-8">
        <Typography.Text className="text-zinc-500">相簿中沒有照片</Typography.Text>
      </div>
    );
  }

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <Typography.Text strong className="text-zinc-100 text-[15px]">
          照片（{photos.length}）
        </Typography.Text>
        <a href={albumUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 text-xs">
          在 Google Photos 開啟 ↗
        </a>
      </div>

      {/* Justified gallery — same row height, width varies by aspect ratio, fills left-to-right */}
      <div className="flex flex-wrap gap-1">
        {photos.map((photo, index) => (
          <LazyPhoto key={photo.id} photo={photo} index={index} onClick={openLightbox} />
        ))}
      </div>

      {nextPageToken ? (
        <div className="text-center mt-4">
          <PillButton onClick={loadMore} disabled={loadingMore}>{loadingMore ? "載入中..." : "載入更多"}</PillButton>
        </div>
      ) : (
        <div className="text-center mt-5 pb-2">
          <Typography.Text className="text-zinc-600 text-xs">
            已顯示全部 {photos.length} 張・
          </Typography.Text>
          <a href={albumUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 text-xs">
            在 Google Photos 開啟 ↗
          </a>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {previewPhoto && (
        <PhotoFramePreview
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      )}

      {currentPhoto && (
        <div
          onClick={closeLightbox}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
          className="fixed inset-0 z-[2000] bg-black/[0.96] flex items-center justify-center overflow-hidden"
        >
          {/* Full-resolution image / video */}
          {currentPhoto.isVideo ? (
            videoError ? (
              /* Fallback: video URL failed — show thumbnail + link */
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center gap-3"
              >
                <img
                  src={`${currentPhoto.baseUrl}=w800`}
                  alt={currentPhoto.filename}
                  className="max-w-[82vw] max-h-[72vh] object-contain rounded-md opacity-70"
                />
                <a
                  href={albumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white bg-white/15 px-5 py-2 rounded-full text-sm no-underline"
                >
                  在 Google Photos 播放影片 ↗
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
                className="max-w-[92vw] max-h-[90vh] rounded-md"
              />
            )
          ) : (
            <img
              src={`${currentPhoto.baseUrl}=w1600`}
              alt={currentPhoto.filename}
              onClick={handleImageClick}
              className="max-w-[92vw] max-h-[90vh] object-contain rounded-md select-none transition-transform duration-200"
              style={{
                transform: zoom ? "scale(2.2)" : "none",
                transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
                cursor: zoom ? "zoom-out" : "zoom-in",
              }}
            />
          )}

          {/* Download / preview (photos only) */}
          {!currentPhoto.isVideo && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewPhoto(currentPhoto); }}
              title="下載（含邊框與相機資訊）"
              aria-label="下載照片（含邊框與相機資訊）"
              className="absolute top-4 right-[60px] bg-white/[0.12] border-none rounded-full w-[42px] h-[42px] text-white cursor-pointer flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1v9M5 7l3 3 3-3M2 14h12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Close */}
          <button
            onClick={closeLightbox}
            aria-label="關閉照片檢視"
            className="absolute top-4 right-4 bg-white/[0.12] border-none rounded-full w-[42px] h-[42px] text-white cursor-pointer text-lg flex items-center justify-center"
          >
            ✕
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              aria-label="上一張照片"
              className="absolute top-1/2 left-3 -translate-y-1/2 bg-white/[0.12] border-none rounded-full w-[42px] h-[42px] text-white cursor-pointer text-[24px] flex items-center justify-center"
            >
              ‹
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              aria-label="下一張照片"
              className="absolute top-1/2 right-3 -translate-y-1/2 bg-white/[0.12] border-none rounded-full w-[42px] h-[42px] text-white cursor-pointer text-[24px] flex items-center justify-center"
            >
              ›
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/45 text-[13px] pointer-events-none">
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
      role="button"
      tabIndex={0}
      aria-label={`檢視照片 ${photo.filename}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(index);
        }
      }}
      className="rounded-md overflow-hidden cursor-pointer bg-[#1c1c1e] relative focus-visible:outline-2 focus-visible:outline-violet-400 focus-visible:outline-offset-2"
      style={{
        flexGrow: 1,
        flexBasis: `${flexBasis}px`,
        maxWidth: `${flexBasis * 2}px`,
        height: ROW_HEIGHT,
      }}
    >
      {inView && (
        <img
          src={`${photo.baseUrl}=w600`}
          alt={photo.filename}
          className="w-full h-full object-cover block transition-opacity duration-300 ease-in-out"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
