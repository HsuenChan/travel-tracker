import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://photos.google.com/",
};

// ── In-memory cache (TTL 5 min) — avoids re-hitting Google CDN on every option change ──
const CACHE_TTL = 5 * 60 * 1000;
const imgCache  = new Map<string, { buf: Buffer; ts: number }>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exifCache = new Map<string, { data: Record<string, any> | null; ts: number }>();

async function fetchPreviewBuf(url: string): Promise<Buffer | null> {
  const cached = imgCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.buf;

  const res = await fetch(`${url}=w1600`, { headers: FETCH_HEADERS }).catch(() => null);
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  imgCache.set(url, { buf, ts: Date.now() });
  return buf;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchExif(url: string): Promise<Record<string, any> | null> {
  const cached = exifCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const res = await fetch(`${url}=d`, {
    headers: { ...FETCH_HEADERS, "Range": "bytes=0-65535" },
  }).catch(() => null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: Record<string, any> | null = null;
  if (res && (res.ok || res.status === 206)) {
    try {
      const exifr = await import("exifr");
      const partial = Buffer.from(await res.arrayBuffer());
      data = await exifr.default.parse(partial, {
        pick: ["Make", "Model", "LensModel", "FNumber", "ExposureTime", "ISO",
               "FocalLength", "DateTimeOriginal", "CreateDate"],
      });
    } catch { /* no EXIF */ }
  }
  exifCache.set(url, { data, ts: Date.now() });
  return data;
}

function cleanModel(make: string, model: string): string {
  if (!model) return "";
  const makeTokens  = make.toLowerCase().split(/\s+/);
  const modelTokens = model.split(/\s+/);
  let i = 0;
  while (i < makeTokens.length && i < modelTokens.length
         && modelTokens[i].toLowerCase() === makeTokens[i]) {
    i++;
  }
  // Skip short corporate-suffix tokens left over (AG, INC, CORP, LTD …)
  while (i < modelTokens.length && /^[A-Z]{2,4}$/.test(modelTokens[i])) {
    i++;
  }
  const cleaned = modelTokens.slice(i).join(" ").trim();
  return cleaned || model;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatExposureTime(et: number): string {
  if (et >= 1) return `${et}s`;
  return `1/${Math.round(1 / et)}s`;
}

function formatDate(raw: string): string {
  const m = raw.match(/(\d{4})[:/-](\d{2})[:/-](\d{2})[T\s](\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[1]}.${m[2]}.${m[3]}  ${m[4]}:${m[5]}`;
}

const LOGO_BRANDS = ["sony", "canon", "fujifilm", "leica", "nikon", "apple", "samsung", "vivo"];

// Per-brand logo size multiplier (relative to default logoTargetH)
const BRAND_LOGO_SCALE: Record<string, number> = {
  samsung: 0.6,
};

const BRAND_FALLBACK_COLORS: Record<string, string> = {
  panasonic: "#005bac",
  olympus:   "#003087",
  default:   "#555555",
};

function detectBrand(make: string, lensModel: string): string {
  const m = make.toLowerCase();
  const l = lensModel.toLowerCase();
  for (const b of LOGO_BRANDS) {
    if (m.includes(b) || l.includes(b)) return b;
  }
  return m.trim().split(/\s+/)[0] ?? "";
}

async function loadLogo(brand: string, targetH: number): Promise<{ buf: Buffer; w: number; h: number } | null> {
  if (!LOGO_BRANDS.includes(brand)) return null;
  const p = path.join(process.cwd(), "public", "logos", `${brand}.png`);
  try {
    await fs.access(p);
    const buf = await sharp(p).resize(null, targetH, { fit: "inside" }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    return { buf, w: meta.width!, h: meta.height! };
  } catch {
    return null;
  }
}



export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url       = searchParams.get("url");
  const ratioParam = searchParams.get("ratio") ?? "original";
  const bgParam   = (searchParams.get("bg") ?? "white") as "white" | "dark";
  const frameParam = (searchParams.get("frame") ?? "border") as "border" | "none";
  const isPreview  = searchParams.get("preview") === "true";

  if (!url || !url.startsWith("https://lh3.googleusercontent.com")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  // ── Fetch image ────────────────────────────────────────────────────────────
  let buffer: Buffer;
  let fetchedOriginal = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exif: Record<string, any> | null = null;

  if (isPreview) {
    const buf = await fetchPreviewBuf(url);
    if (!buf) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    buffer = buf;
    exif = await fetchExif(url);
  } else {
    const origRes = await fetch(`${url}=d`, { headers: FETCH_HEADERS }).catch(() => null);
    if (origRes?.ok && origRes.headers.get("content-type")?.startsWith("image/")) {
      buffer = Buffer.from(await origRes.arrayBuffer());
      fetchedOriginal = true;
    } else {
      const fallback = await fetch(`${url}=w4096`, { headers: FETCH_HEADERS }).catch(() => null);
      if (!fallback?.ok) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
      buffer = Buffer.from(await fallback.arrayBuffer());
    }
  }

  // ── Parse EXIF (download mode only — preview mode parses via Range request above) ──
  if (fetchedOriginal) {
    try {
      const exifr = await import("exifr");
      exif = await exifr.default.parse(buffer, {
        pick: ["Make", "Model", "LensModel", "FNumber", "ExposureTime", "ISO",
               "FocalLength", "DateTimeOriginal", "CreateDate"],
      });
    } catch { /* proceed without EXIF */ }
  }

  const make      = ((exif?.Make      as string | undefined) ?? "").trim();
  const model     = ((exif?.Model     as string | undefined) ?? "").trim();
  const lensModel = ((exif?.LensModel as string | undefined) ?? "").trim();
  const brand     = detectBrand(make, lensModel);

  const makeDisplay  = make;
  const modelDisplay = model
    ? (model.toLowerCase().startsWith(make.toLowerCase())
        ? cleanModel(make, model)
        : model)
    : "";

  const exifParts: string[] = [];
  if (exif?.FocalLength)  exifParts.push(`${Math.round(exif.FocalLength as number)}mm`);
  if (exif?.FNumber)      exifParts.push(`f/${exif.FNumber}`);
  if (exif?.ExposureTime) exifParts.push(formatExposureTime(exif.ExposureTime as number));
  if (exif?.ISO)          exifParts.push(`ISO${exif.ISO}`);
  const exifStr = exifParts.join("  ·  ");

  const rawDate = (exif?.DateTimeOriginal ?? exif?.CreateDate) as string | undefined;
  const dateStr = rawDate ? formatDate(String(rawDate)) : "";

  const lensDisplay = lensModel || modelDisplay;
  const hasInfo = !!(makeDisplay || exifStr);

  // ── Ratio crop ─────────────────────────────────────────────────────────────
  if (ratioParam !== "original") {
    const [rw, rh] = ratioParam.split(":").map(Number);
    const targetAspect = rw / rh;
    const srcMeta = await sharp(buffer).metadata();
    const srcW = srcMeta.width!;
    const srcH = srcMeta.height!;
    const currentAspect = srcW / srcH;

    let cropW: number, cropH: number;
    if (targetAspect > currentAspect) {
      cropW = srcW;
      cropH = Math.round(srcW / targetAspect);
    } else {
      cropW = Math.round(srcH * targetAspect);
      cropH = srcH;
    }
    const left = Math.round((srcW - cropW) / 2);
    const top  = Math.round((srcH - cropH) / 2);
    buffer = await sharp(buffer).extract({ left, top, width: cropW, height: cropH }).toBuffer();
  }

  // ── Layout dimensions ──────────────────────────────────────────────────────
  const imgMeta = await sharp(buffer).metadata();
  const W = imgMeta.width!;
  const H = imgMeta.height!;

  const bgRgb = bgParam === "dark"
    ? { r: 28, g: 28, b: 30, alpha: 1 as const }
    : { r: 255, g: 255, b: 255, alpha: 1 as const };

  const colors = bgParam === "dark"
    ? { brand: "#71717a", model: "#f4f4f5", date: "#52525b", lens: "#e4e4e7", exif: "#a1a1aa", circle: "rgba(255,255,255,0.15)" }
    : { brand: "#888888", model: "#111111", date: "#aaaaaa", lens: "#222222", exif: "#666666", circle: "" };

  const border   = frameParam === "border" ? Math.max(4, Math.round(W * 0.01)) : 0;
  const infoBarH = hasInfo ? Math.round(W * 0.07) : border;
  const canvasW  = W + border * 2;
  const canvasH  = H + border + infoBarH + border;
  const hPad     = Math.max(border, Math.round(W * 0.012));
  const vPad     = Math.round(infoBarH * 0.12);

  const brandFs = Math.round(infoBarH * 0.18);
  const modelFs = Math.round(infoBarH * 0.27);
  const dateFs  = Math.round(infoBarH * 0.15);
  const lens1Fs = Math.round(infoBarH * 0.22);
  const exifFs  = Math.round(infoBarH * 0.18);

  // ── Load logo ──────────────────────────────────────────────────────────────
  const logoScale   = BRAND_LOGO_SCALE[brand] ?? 1.0;
  const logoTargetH = Math.round(infoBarH * 0.55 * logoScale);
  const logo = hasInfo ? await loadLogo(brand, logoTargetH) : null;

  // ── Right section layout: [logo] | [divider] | [lens/exif text] ──────────
  const infoTop      = H + border;
  const textAreaEstW = Math.round(W * 0.34);
  const divGap       = Math.round(infoBarH * 0.20);
  const dividerX     = canvasW - hPad - textAreaEstW;
  const rightTextX   = dividerX + divGap;
  const logoX        = logo ? dividerX - divGap - logo.w : 0;
  const logoY        = logo ? infoTop + Math.round((infoBarH - logo.h) / 2) : 0;
  const dividerColor = bgParam === "dark" ? "#3f3f46" : "#d4d4d8";

  // ── Vertical positions ─────────────────────────────────────────────────────
  const lineGap1 = Math.round(brandFs * 0.3);
  const lineGap2 = Math.round(dateFs  * 0.5);
  let leftBlockH = 0;
  if (makeDisplay)  leftBlockH += brandFs;
  if (modelDisplay) leftBlockH += lineGap1 + modelFs;
  if (dateStr)      leftBlockH += lineGap2 + dateFs;
  const leftStartY = infoTop + Math.round((infoBarH - leftBlockH) / 2);
  const brandY  = leftStartY + brandFs;
  const modelY  = brandY + lineGap1 + modelFs;
  const dateY   = modelY + lineGap2 + dateFs;

  const midY   = infoTop + infoBarH / 2;
  const lens1Y = midY - lens1Fs * 0.15;
  const exifY  = lens1Y + exifFs + Math.round(exifFs * 0.35);

  // ── SVG: background rect + divider line + fallback circle (no text in SVG) ─
  const svgParts: string[] = [];
  if (hasInfo) {
    if (logo) {
      const divY1 = infoTop + Math.round(infoBarH * 0.20);
      const divY2 = infoTop + Math.round(infoBarH * 0.80);
      svgParts.push(`<line x1="${dividerX}" y1="${divY1}" x2="${dividerX}" y2="${divY2}" stroke="${dividerColor}" stroke-width="1.5" stroke-linecap="round"/>`);
    }
    if (!logo && makeDisplay) {
      const r  = Math.round(infoBarH * 0.28);
      const cx = dividerX - divGap - r;
      const cy = infoTop + infoBarH / 2;
      const fc = bgParam === "dark" ? "rgba(255,255,255,0.12)" : (BRAND_FALLBACK_COLORS[brand] ?? BRAND_FALLBACK_COLORS.default);
      svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fc}"/>`);
    }
  }
  const infoRect = `<rect x="0" y="${infoTop}" width="${canvasW}" height="${infoBarH + border}" fill="rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">${infoRect}${svgParts.join("")}</svg>`;

  // ── Compose ────────────────────────────────────────────────────────────────
  const extended = await sharp(buffer)
    .extend({
      top:    border,
      bottom: infoBarH + border,
      left:   border,
      right:  border,
      background: bgRgb,
    })
    .toBuffer();

  const composites: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (logo) composites.push({ input: logo.buf, top: logoY, left: logoX });

  // ── Text via Sharp (bypasses librsvg — works on Vercel without system fonts) ─
  if (hasInfo) {
    const fontfile = path.join(process.cwd(), "public", "fonts", "Geist-Regular.ttf");
    const txt = (
      text: string, size: number, color: string, bold: boolean,
      left: number, baseY: number, maxW: number,
    ): sharp.OverlayOptions => ({
      input: {
        text: {
          text: `<span foreground="${color}" font_weight="${bold ? "bold" : "normal"}" font_size="${size}pt">${escapeXml(text)}</span>`,
          font: "Geist",
          fontfile,
          width: maxW,
          rgba: true,
          dpi: 72,
        },
      },
      top:  Math.max(infoTop, Math.round(baseY - size * 0.82)),
      left: Math.max(0, left),
    });

    if (makeDisplay)  composites.push(txt(makeDisplay,  brandFs, colors.brand, false, hPad,       brandY, Math.round(W * 0.35)));
    if (modelDisplay) composites.push(txt(modelDisplay, modelFs, colors.model, true,  hPad,       modelY, Math.round(W * 0.35)));
    if (dateStr)      composites.push(txt(dateStr,      dateFs,  colors.date,  false, hPad,       dateY,  Math.round(W * 0.35)));
    if (exifStr)      composites.push(txt(exifStr,      lens1Fs, colors.lens,  true,  rightTextX, lens1Y, Math.round(W * 0.32)));
    if (lensDisplay)  composites.push(txt(lensDisplay,  exifFs,  colors.exif,  false, rightTextX, exifY,  Math.round(W * 0.32)));

    if (!logo && makeDisplay) {
      const r   = Math.round(infoBarH * 0.28);
      const cx  = dividerX - divGap - r;
      const cy  = infoTop + infoBarH / 2;
      const ifs = Math.round(r * 1.1);
      const lc  = bgParam === "dark" ? "#e4e4e7" : "white";
      composites.push(txt(makeDisplay.charAt(0).toUpperCase(), ifs, lc, true, cx - Math.round(ifs * 0.30), cy + Math.round(ifs * 0.42), Math.round(ifs * 1.5)));
    }
  }

  let output = await sharp(extended)
    .composite(composites)
    .flatten({ background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b } })
    .jpeg({ quality: 95 })
    .toBuffer();

  if (isPreview) {
    output = await sharp(output)
      .resize(800, null, { withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  }

  const disposition = isPreview ? "inline" : `attachment; filename="photo_${Date.now()}.jpg"`;

  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
