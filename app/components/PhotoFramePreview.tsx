"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, Drawer, Modal } from "antd";

interface MediaItem {
  baseUrl: string;
  filename: string;
}

interface Props {
  photo: MediaItem;
  onClose: () => void;
}

const RATIOS = [
  { label: "Original", value: "original" },
  { label: "1:1",      value: "1:1" },
  { label: "3:4",      value: "3:4" },
  { label: "4:3",      value: "4:3" },
  { label: "9:16",     value: "9:16" },
  { label: "16:9",     value: "16:9" },
];

const RATIO_ASPECT: Record<string, number> = {
  "1:1": 1, "3:4": 3/4, "4:3": 4/3, "9:16": 9/16, "16:9": 16/9,
};

type BgMode    = "white" | "dark";
type FrameMode = "border" | "none";

export default function PhotoFramePreview({ photo, onClose }: Props) {
  const [ratio, setRatio]           = useState("original");
  const [bg, setBg]                 = useState<BgMode>("white");
  const [frame, setFrame]           = useState<FrameMode>("border");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [isDesktop, setIsDesktop]   = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const prevUrlRef = useRef<string | null>(null);
  const abortRef   = useRef<AbortController | null>(null);

  const buildUrl = useCallback((preview: boolean) => {
    const p = new URLSearchParams({ url: photo.baseUrl, ratio, bg, frame });
    if (preview) p.set("preview", "true");
    return `/api/photos/frame?${p}`;
  }, [photo.baseUrl, ratio, bg, frame]);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setPreviewSrc(null);

    fetch(buildUrl(true), { signal: ctrl.signal })
      .then(r => r.blob())
      .then(blob => {
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        const u = URL.createObjectURL(blob);
        prevUrlRef.current = u;
        setPreviewSrc(u);
        setLoading(false);
      })
      .catch(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [buildUrl]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(buildUrl(false));
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `photo_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(u);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  };

  const containerAspect = ratio !== "original" ? (RATIO_ASPECT[ratio] ?? 4/3) : 4/3;

  const controls = (
    <>
      {/* Preview image */}
      <div className="flex items-center justify-center mb-5">
        <div className="w-full flex items-center justify-center" style={{ maxHeight: 260 }}>
          {loading ? (
            <div
              className="w-full bg-zinc-800 animate-pulse"
              style={{ aspectRatio: String(containerAspect), maxHeight: 260 }}
            />
          ) : previewSrc ? (
            <img
              src={previewSrc}
              alt="preview"
              className="max-w-full object-contain shadow-xl"
              style={{ maxHeight: 260 }}
            />
          ) : (
            <div className="text-zinc-600 text-sm py-10">無法載入預覽</div>
          )}
        </div>
      </div>

      {/* Ratio */}
      <div className="mb-4">
        <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-2.5">比例</p>
        <div className="flex gap-2 flex-wrap">
          {RATIOS.map(r => (
            <button
              key={r.value}
              onClick={() => setRatio(r.value)}
              className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                ratio === r.value
                  ? "bg-violet-500/20 border-violet-400 text-violet-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Frame mode */}
      <div className="mb-4">
        <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-2.5">邊框</p>
        <div className="flex gap-2">
          {([
            { label: "有邊框", value: "border" },
            { label: "無邊框", value: "none"   },
          ] as const).map(f => (
            <button
              key={f.value}
              onClick={() => setFrame(f.value)}
              className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                frame === f.value
                  ? "bg-violet-500/20 border-violet-400 text-violet-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Background color */}
      <div className="mb-6">
        <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-3">底部顏色</p>
        <div className="flex gap-4 items-center">
          {([
            { value: "white", bg: "#ffffff", label: "白色" },
            { value: "dark",  bg: "#1c1c1e", label: "深灰" },
          ] as const).map(c => (
            <button
              key={c.value}
              onClick={() => setBg(c.value)}
              className="cursor-pointer flex flex-col items-center gap-1.5 group"
            >
              <div
                className={`w-9 h-9 rounded-full border-2 transition-all duration-150 ${
                  bg === c.value ? "border-violet-400 scale-110" : "border-zinc-600 group-hover:border-zinc-500"
                }`}
                style={{ background: c.bg }}
              />
              <span className={`text-[10px] ${bg === c.value ? "text-violet-400" : "text-zinc-600"}`}>
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Download */}
      <Button
        type="primary"
        size="large"
        block
        loading={downloading}
        onClick={handleDownload}
        style={{
          background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
          border: "none",
          height: 48,
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        下載原圖
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Modal
        open
        onCancel={onClose}
        footer={null}
        width={480}
        centered
        zIndex={2500}
        styles={{
          container: { background: "#18181b", borderRadius: 16, padding: "24px 24px 28px" },
          mask:    { background: "rgba(0,0,0,0.75)" },
          wrapper: { zIndex: 2500 },
        }}
      >
        {controls}
      </Modal>
    );
  }

  return (
    <Drawer
      open
      placement="bottom"
      onClose={onClose}
      closeIcon={null}
      title={null}
      styles={{
        body:    { padding: "12px 20px 40px", background: "#18181b" },
        header:  { display: "none" },
        wrapper: { height: "auto", borderRadius: "22px 22px 0 0", overflow: "hidden" },
        mask:    { background: "rgba(0,0,0,0.75)" },
      }}
      rootStyle={{ zIndex: 2500 }}
    >
      {/* Handle */}
      <div className="flex justify-center mb-4">
        <div className="w-9 h-1 rounded-full bg-zinc-700" />
      </div>
      {controls}
    </Drawer>
  );
}
