import type { PassportData, PassportStamp, PassportYear } from "@/lib/passport";
import { countryName, countryFlag } from "@/lib/countries";

/**
 * 護照頁面的繪圖。
 *
 * 每一頁都畫在 canvas 上，而不是排成 DOM —— Part 2 要把這些頁面貼到 three 的書頁上，貼圖只能
 * 來自 canvas。同一組函式因此有兩個出口：書裡的頁面，與年度回顧的可存圖，不必維護兩套版面。
 */

export const PAGE_W = 704;
export const PAGE_H = 1000;

/**
 * 護照擺放的傾角，以 CSS 的慣例表示（正值＝順時針）。
 *
 * 放在這裡是因為有三個地方要用同一個角度：地球上那本的飛行終點、/passport 的載入佔位、
 * 以及 3D 書本自己。three 的 rotation.z 正向是逆時針（y 軸朝上），CSS 的 rotate 正向是順時針
 * （y 軸朝下）—— 兩邊各自寫死一個負值，畫出來就會是一個順時針一個逆時針。
 *
 * 從 15 度收到 8 度：斜著擺時畫面要框的高度是「寬×sinθ + 高×cosθ」，θ 越大框得越高、頁面就
 * 被壓得越小。15 度時字太小讀不了，8 度還看得出是隨手擺著的，但頁面大了將近一成。
 */
export const BOOK_TILT_DEG = -8;

/** 紙色壓在品牌的深紫調上：護照就該是一份文件，但它活在這個 App 的世界裡 */
const INK = {
  paper: "#171221",
  paperDeep: "#110d1a",
  gold: "#c9a961",
  goldDim: "#8a7440",
  cream: "#e8e0d0",
  dim: "#8b7f9c",
  violet: "#8b5cf6",
};

/**
 * 內頁：淺色紙。
 *
 * 封面維持深紫（品牌色），但翻開之後是淺色的 —— 真的護照就是深色封皮配淺色內頁，而且入境章
 * 的墨色本來就是設計來蓋在淺色紙上的，蓋在深色底上永遠不會像。
 */
const PAGE = {
  paper: "#f5efe4",
  paperEdge: "#e2d7c4",
  line: "#6f5f96",
  lineWarm: "#9a7c46",
  rule: "#a2854e",
  ink: "#2b2242",
  dim: "#776b8b",
  accent: "#8a6a2c",
};

/**
 * Iris（虹彩）印刷：底色在整頁上柔和地換色。
 *
 * 真的護照每一頁都是這樣一組粉彩漸變，而不是單一底色 —— 這是內頁看起來「是護照」而不是
 * 「一張米色紙」的關鍵之一。
 */
const IRIS_SETS = [
  ["#eff3f7", "#f6f1e6", "#f1eef6"],
  ["#f5f0e6", "#eef4ef", "#f6eef0"],
  ["#eef2f6", "#f7f2ea", "#edf4f2"],
  ["#f6f0ea", "#eff2f7", "#f5f0f2"],
  ["#f2f5f1", "#f6f0e8", "#eef1f6"],
  ["#f6f1f4", "#f1f4ef", "#f5f1e8"],
];

/** 保安纖維：淺色紙裡那些看得到的紅藍短纖 */
const FIBRE_COLORS = ["#c2565a", "#4f6fae", "#5d9a72"];

/** 入境章的墨色，取自真的章那幾種顏色 */
const STAMP_INKS = ["#6366f1", "#be123c", "#047857", "#7c3aed", "#b45309", "#0369a1"];

const STAMPS_PER_PAGE = 6;

// ── 字型 ──────────────────────────────────────────────────
// next/font 產生的是雜湊過的家族名，只能從 CSS 變數讀回來；寫死 "LINE Seed TC" 是拿不到的
function cssFont(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function sans(): string {
  return cssFont("--font-line-seed", '-apple-system, "PingFang TC", "Noto Sans TC", sans-serif');
}

function mono(): string {
  return cssFont("--font-geist-mono", 'ui-monospace, "SFMono-Regular", Menlo, monospace');
}

/**
 * 封面用襯線。
 *
 * 全站主字是 LINE Seed（圓潤現代），那個個性放在護照封面上就是不對 —— 護照是一份公文書，
 * 封面的字該是有襯線、壓上去的。中文走系統的宋體，拉丁字走 Georgia，都不必額外載字型。
 */
function serif(): string {
  return '"Songti TC", "Songti SC", "Noto Serif TC", "PMingLiU", "MingLiU", Georgia, serif';
}

// ── 圖片 ──────────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement | null>();

export async function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(url)) return imageCache.get(url)!;
  const result = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    // 之後要 toBlob 匯出年度回顧，沒有 CORS 的圖會把 canvas 汙染成不能匯出
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, result);
  return result;
}

/**
 * 年度回顧要用的那張照片：從該年旅程的 Google 相簿拿。
 *
 * 相簿是外部整合，一次要抓一整頁 HTML 回來解析，所以只在真的要畫那一頁時才抓、並且記住結果 ——
 * 護照有幾年就會有幾本相簿，全部先抓會把整份護照的載入卡住。
 *
 * 挑的是第一張橫幅的照片（版面上那個框是橫的），沒有橫幅就用第一張；影片跳過。
 */
const albumPhotoCache = new Map<string, string | null>();

async function albumPhoto(rawAlbumUrl: string): Promise<string | null> {
  // 貼進來的分享連結常常夾著換行與縮排，URL 裡不該有空白
  const albumUrl = rawAlbumUrl.replace(/\s+/g, "");
  if (albumPhotoCache.has(albumUrl)) return albumPhotoCache.get(albumUrl)!;

  let picked: string | null = null;
  try {
    const res = await fetch(`/api/photos?shareUrl=${encodeURIComponent(albumUrl)}`);
    if (res.ok) {
      const { mediaItems } = await res.json();
      const stills = (mediaItems ?? []).filter(
        (m: { isVideo?: boolean }) => !m.isVideo
      ) as { baseUrl: string; mediaMetadata?: { width?: string; height?: string } }[];
      const landscape = stills.find(
        (m) => Number(m.mediaMetadata?.width ?? 0) >= Number(m.mediaMetadata?.height ?? 0)
      );
      const chosen = landscape ?? stills[0];
      if (chosen) picked = `${chosen.baseUrl}=w1200`;
    }
  } catch {
    // 相簿讀不到就退回行程照片，不要讓整頁畫不出來
  }

  albumPhotoCache.set(albumUrl, picked);
  return picked;
}

/** 年度那一頁實際要畫的照片：相簿優先，讀不到才退回行程照片 */
async function yearPhoto(year: PassportYear): Promise<HTMLImageElement | null> {
  if (year.albumUrl) {
    const url = await albumPhoto(year.albumUrl);
    // 跨網域讀不回來的圖會讓 canvas 匯不出年度回顧，所以載不到就往下退
    if (url) {
      const img = await loadImage(url);
      if (img) return img;
    }
  }
  return year.photo ? loadImage(year.photo) : null;
}

// ── 頁面清單 ──────────────────────────────────────────────
export type PageSpec =
  | { key: string; kind: "cover"; label: string }
  | { key: string; kind: "data"; label: string }
  | { key: string; kind: "stamps"; label: string; stamps: PassportStamp[] }
  | { key: string; kind: "mileage"; label: string }
  | { key: string; kind: "year"; label: string; year: PassportYear };

export function buildPages(data: PassportData): PageSpec[] {
  const pages: PageSpec[] = [
    { key: "cover", kind: "cover", label: "封面" },
    { key: "data", kind: "data", label: "資料頁" },
  ];

  for (let i = 0; i < data.stamps.length; i += STAMPS_PER_PAGE) {
    pages.push({
      key: `stamps-${i}`,
      kind: "stamps",
      label: "入境章",
      stamps: data.stamps.slice(i, i + STAMPS_PER_PAGE),
    });
  }

  pages.push({ key: "mileage", kind: "mileage", label: "里程" });

  for (const year of data.years) {
    pages.push({ key: `year-${year.year}`, kind: "year", label: `${year.year}`, year });
  }

  return pages;
}

// ── 小工具 ────────────────────────────────────────────────
/**
 * 種子化亂數（mulberry32）。
 *
 * 章的斑駁必須是可重現的：同一個國碼、同一個日期，每次重畫都要長得一模一樣 ——
 * 用 Math.random 的話每次翻回這一頁，章的缺口都會換位置，那看起來就不是蓋上去的。
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  opts: { size: number; color: string; weight?: number; family?: string; align?: CanvasTextAlign; spacing?: number }
) {
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.spacing ? "left" : (opts.align ?? "left");
  ctx.textBaseline = "alphabetic";
  ctx.font = `${opts.weight ?? 400} ${opts.size}px ${opts.family ?? sans()}`;

  if (!opts.spacing) {
    ctx.fillText(str, x, y);
    ctx.restore();
    return;
  }

  // canvas 沒有 letterSpacing 的跨瀏覽器支援，逐字排；護照的欄位標籤靠字距才有文件感
  const chars = [...str];
  const total = chars.reduce((w, c) => w + ctx.measureText(c).width + opts.spacing!, -opts.spacing!);
  let cursor = x;
  if ((opts.align ?? "left") === "center") cursor = x - total / 2;
  if (opts.align === "right") cursor = x - total;
  for (const c of chars) {
    ctx.fillText(c, cursor, y);
    cursor += ctx.measureText(c).width + opts.spacing!;
  }
  ctx.restore();
}

/**
 * 量一段字在指定字體下的寬度。
 *
 * 不能直接在 text() 之後呼叫 measureText —— text() 內部有 save/restore，畫完之後 ctx.font
 * 已經還原成先前的值，量到的會是別的字級的寬度。旅行紀錄那頁的單位疊在數字上就是這樣來的。
 */
function measure(
  ctx: CanvasRenderingContext2D,
  str: string,
  size: number,
  weight = 400,
  family = sans()
): number {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/**
 * 分頁標題：中文用襯線、英文用字距拉開的全大寫，底下一條細線收尾。
 *
 * 護照上的欄位標題就是這種樣子 —— 中英並列、英文letterspacing 很開。全部用同一套無襯線
 * 只是「一行字」，撐不起文件感。
 */
function sectionHeader(
  ctx: CanvasRenderingContext2D,
  zh: string,
  en: string,
  x: number,
  y: number,
  right: number
) {
  text(ctx, zh, x, y, { size: 19, color: PAGE.ink, weight: 700, family: serif(), spacing: 4 });
  const zhWidth = measure(ctx, zh, 19, 700, serif()) + 4 * [...zh].length;
  text(ctx, en, x + zhWidth + 14, y, { size: 12, color: PAGE.accent, weight: 700, spacing: 3.5 });

  ctx.save();
  ctx.strokeStyle = PAGE.rule;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 16);
  ctx.lineTo(right, y + 16);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  rosette(ctx, right, y + 16, 7, 1.5, 4, 6, 2, PAGE.lineWarm, 0.6);
}

/** 欄位底下那條細線：整本內頁共用同一個濃度 */
function hairline(ctx: CanvasRenderingContext2D, x: number, y: number, right: number) {
  ctx.save();
  ctx.strokeStyle = PAGE.rule;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.restore();
}

/** 欄位：標籤在上、值在下，底下一條細線 —— 資料頁那一排欄位的樣子 */
function field(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  right: number,
  valueSize = 30
) {
  text(ctx, label, x, y, { size: 12, color: PAGE.dim, spacing: 2.6 });
  // 值用等寬：全站的數字慣例是 Geist Mono，而護照的欄位本來就是打字機印上去的
  text(ctx, value, x, y + valueSize + 6, {
    size: valueSize, color: PAGE.ink, weight: 700, family: mono(),
  });
  hairline(ctx, x, y + valueSize + 20, right);
}

/** 沿著圓弧排字，圓形章的國名用 */
function arcText(
  ctx: CanvasRenderingContext2D,
  str: string,
  radius: number,
  startAngle: number,
  size: number,
  color: string,
  flip = false
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ${sans()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...str];
  const arc = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) / radius;
  let angle = startAngle - arc / 2;
  for (const c of chars) {
    const w = ctx.measureText(c).width;
    angle += w / 2 / radius;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, flip ? radius : -radius);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    angle += w / 2 / radius;
  }
  ctx.restore();
}

/**
 * Guilloche 玫瑰花紋。
 *
 * 真的護照底紋是這種東西 —— 由參數產生的對稱細線曲線（趨旋線），一圈一圈疊成帶狀。
 * 上一版用同心橢圓假裝，那畫出來只是一團線，沒有 guilloche 該有的花瓣與交織。
 *
 *   x = a·cos t + b·cos(n·t)
 *   y = a·sin t − b·sin(n·t)
 *
 * n 決定幾瓣，b 決定花瓣多深；b 由小到大掃一遍就是一條帶。
 */
function rosette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  a: number,
  bFrom: number,
  bTo: number,
  petals: number,
  rings: number,
  color: string,
  alpha: number,
  rotate = 0
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 0.7;
  const steps = 540;
  for (let ring = 0; ring < rings; ring++) {
    const b = bFrom + ((bTo - bFrom) * ring) / Math.max(1, rings - 1);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = a * Math.cos(t) + b * Math.cos(petals * t);
      const y = a * Math.sin(t) - b * Math.sin(petals * t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 微縮文字。
 *
 * 在頁面上是一條細線，放大才看得出是字 —— 真的護照就是用這個當分隔線與邊飾。
 * 這裡印的是這個 App 的名字，等於一條簽名。
 */
function microtext(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  size: number,
  alpha: number
) {
  ctx.save();
  ctx.font = `${size}px ${mono()}`;
  ctx.fillStyle = PAGE.line;
  ctx.globalAlpha = alpha;
  const unit = "TRAVELTRACKER\u00B7";
  const unitWidth = ctx.measureText(unit).width || size * 8;
  for (let cursor = x; cursor < x + width; cursor += unitWidth) {
    ctx.fillText(unit, cursor, y);
  }
  ctx.restore();
}

/** 細密的交錯波紋，壓在花紋底下多一層質地 */
function waveLines(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.save();
  ctx.strokeStyle = PAGE.line;
  ctx.globalAlpha = 0.045;
  ctx.lineWidth = 0.7;
  const amp = 6 + (seed % 4);
  for (let y = 110; y < h - 90; y += 15) {
    ctx.beginPath();
    for (let x = 46; x <= w - 46; x += 6) {
      const yy = y + Math.sin((x + y * 1.7 + seed * 9) / 42) * amp;
      if (x === 46) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function fibres(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const rand = rng(seed * 7919 + 13);
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 80; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI;
    const len = 5 + rand() * 11;
    ctx.strokeStyle = FIBRE_COLORS[Math.floor(rand() * FIBRE_COLORS.length)];
    ctx.globalAlpha = 0.14 + rand() * 0.18;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 內頁的紙面。
 *
 * 疊法照著真的護照：iris 漸變底色 → 中央的 guilloche 花紋 → 四角小花紋 → 波紋 → 保安纖維 →
 * 微縮文字邊飾 → 雙壓線 → 頁碼。全部壓在 0.12 以下的透明度，內容才不會被吃掉。
 */
function pageBase(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, pageNo = 0) {
  const iris = IRIS_SETS[seed % IRIS_SETS.length];
  const angle = ((seed % 5) - 2) * 0.22;
  const g = ctx.createLinearGradient(
    w / 2 - Math.cos(angle) * w,
    h / 2 - Math.sin(angle) * h,
    w / 2 + Math.cos(angle) * w,
    h / 2 + Math.sin(angle) * h
  );
  g.addColorStop(0, iris[0]);
  g.addColorStop(0.5, iris[1]);
  g.addColorStop(1, iris[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 中央主花紋：兩組花瓣數不同、互相交織，這是 guilloche 的樣子
  const petals = 6 + (seed % 4);
  rosette(ctx, w / 2, h / 2, 196, 26, 78, petals, 9, PAGE.line, 0.1);
  rosette(ctx, w / 2, h / 2, 150, 18, 58, petals + 3, 7, PAGE.lineWarm, 0.085, Math.PI / petals);

  // 四角小花飾
  for (const [cx, cy] of [
    [104, 132], [w - 104, 132], [104, h - 132], [w - 104, h - 132],
  ] as const) {
    rosette(ctx, cx, cy, 44, 8, 22, 5, 5, PAGE.line, 0.075);
  }

  waveLines(ctx, w, h, seed);
  fibres(ctx, w, h, seed);

  /*
    書脊側的陰影刻意不畫進貼圖裡：同一張頁面在攤開的書上，這一刻在右邊、翻過去之後就在左邊，
    書脊會換邊。烘進貼圖就會有一半的時間陰影落在外緣。
  */

  ctx.strokeStyle = PAGE.rule;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.4;
  roundRect(ctx, 34, 34, w - 68, h - 68, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  microtext(ctx, 46, 54, w - 92, 4.4, 0.42);
  microtext(ctx, 46, h - 46, w - 92, 4.4, 0.42);

  ctx.strokeStyle = PAGE.rule;
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = 0.8;
  roundRect(ctx, 46, 62, w - 92, h - 124, 7);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (pageNo > 0) {
    // 底部置中：內容一律靠左，所以中間這一塊不會跟任何東西撞到
    const nx = w / 2;
    const ny = h - 78;
    rosette(ctx, nx, ny - 5, 15, 3, 9, 6, 3, PAGE.lineWarm, 0.45);
    text(ctx, String(pageNo), nx, ny, {
      size: 13, color: PAGE.dim, weight: 700, align: "center", family: mono(),
    });
  }
}

// ── 封面 ──────────────────────────────────────────────────

/** 燙金：先壓一道暗影再疊金色，字才像壓進封皮而不是印上去 */
function foilText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  opts: { size: number; weight?: number; spacing?: number; family?: string; color?: string }
) {
  const family = opts.family ?? serif();
  text(ctx, str, x, y + 2, {
    size: opts.size, color: "rgba(0,0,0,0.55)", weight: opts.weight,
    family, align: "center", spacing: opts.spacing,
  });
  text(ctx, str, x, y, {
    size: opts.size, color: opts.color ?? INK.gold, weight: opts.weight,
    family, align: "center", spacing: opts.spacing,
  });
}

/** 國徽位：一顆乾淨的地球加一條航跡。上一版把八個整圈的橢圓疊在一起，看起來是一團線 */
function coverEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  stroke: string = INK.gold,
  arc: string = INK.cream
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = stroke;
  ctx.lineCap = "round";

  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // 緯線：只畫落在球面內的那一段，不是整圈橢圓
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.62;
  for (const f of [-0.55, 0, 0.55]) {
    const y = r * f;
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    ctx.beginPath();
    ctx.ellipse(0, y, half, half * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 經線：兩條就夠了，多了就變成網子
  for (const rx of [r * 0.42, r * 0.78]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 航跡：這是這個 App 的地球在做的事，放在國徽位上剛好
  ctx.save();
  ctx.rotate(-0.42);
  ctx.strokeStyle = arc;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 1.22, r * 0.62, 0, Math.PI * 1.06, Math.PI * 1.94);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = arc;
  for (const t of [Math.PI * 1.06, Math.PI * 1.94]) {
    ctx.beginPath();
    ctx.arc(Math.cos(t) * r * 1.22, r * 0.16 + Math.sin(t) * r * 0.62, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

/** 晶片護照的符號。認得出這個圖案，整張封面就會被讀成護照而不是筆記本 */
function chipSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK.gold;
  ctx.fillStyle = INK.gold;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;

  roundRect(ctx, -26, -17, 52, 34, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-11, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (const r of [9, 15, 21]) {
    ctx.beginPath();
    ctx.arc(-11, 0, r, -Math.PI / 3.1, Math.PI / 3.1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCover(ctx: CanvasRenderingContext2D, span: string, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
  g.addColorStop(0, "#32244a");
  g.addColorStop(0.5, "#221739");
  g.addColorStop(1, "#150e24");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 皮革顆粒：比上一版細、也淡得多，上一版整片是雜訊
  ctx.save();
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
  }
  ctx.restore();

  // 壓邊：外框細、內框更細，中間留白，是真的封皮壓線的樣子
  ctx.strokeStyle = INK.gold;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2.2;
  roundRect(ctx, 40, 40, w - 80, h - 80, 14);
  ctx.stroke();
  ctx.globalAlpha = 0.24;
  ctx.lineWidth = 1;
  roundRect(ctx, 50, 50, w - 100, h - 100, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  foilText(ctx, "TRAVEL TRACKER", w / 2, 168, { size: 27, weight: 700, spacing: 9 });

  ctx.strokeStyle = INK.gold;
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 128, 194);
  ctx.lineTo(w / 2 + 128, 194);
  ctx.stroke();
  ctx.globalAlpha = 1;

  coverEmblem(ctx, w / 2, 452, 118);

  foilText(ctx, "旅遊護照", w / 2, 700, { size: 56, weight: 700, spacing: 16, color: INK.cream });
  foilText(ctx, "PASSPORT", w / 2, 752, { size: 21, weight: 400, spacing: 13 });

  chipSymbol(ctx, w / 2, 852, 1);

  text(ctx, span, w / 2, 926, { size: 18, color: INK.dim, align: "center", spacing: 5, family: mono() });

  // 邊角壓暗，讓封皮看起來是有弧度的
  const vignette = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.2, w / 2, h * 0.5, h * 0.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

// ── 資料頁 ────────────────────────────────────────────────
function mrzName(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z ]/g, "").trim();
  return clean || "TRAVELLER";
}

function mrzLines(data: PassportData): [string, string] {
  const parts = mrzName(data.holder.name).split(/\s+/);
  const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const given = parts.length > 1 ? parts.slice(0, -1).join("<") : "";
  const line1 = `P<TTK${surname}<<${given}`.padEnd(44, "<").slice(0, 44);

  const s = data.summary;
  const num = String(hashCode(data.holder.name)).padStart(9, "0").slice(0, 9);
  const issued = s.firstYear ? String(s.firstYear).slice(2) : "00";
  const tail = `T${String(s.tripCount).padStart(3, "0")}C${String(s.countryCount).padStart(2, "0")}D${String(s.dayCount).padStart(4, "0")}`;
  const line2 = `${num}TTK${issued}0101M${tail}`.padEnd(44, "<").slice(0, 44);

  return [line1, line2];
}

async function drawDataPage(ctx: CanvasRenderingContext2D, data: PassportData, w: number, h: number) {
  // 不標頁碼：底部整塊留給機讀碼，真的護照的資料頁也沒有頁碼
  pageBase(ctx, w, h, 3, 0);

  sectionHeader(ctx, "旅遊護照", "PASSPORT", 82, 126, w - 82);

  // 持證人照片
  const boxX = 82, boxY = 186, boxW = 196, boxH = 250;
  ctx.save();
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.clip();
  ctx.fillStyle = PAGE.paper;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  const avatar = data.holder.avatarUrl ? await loadImage(data.holder.avatarUrl) : null;
  if (avatar) {
    const scale = Math.max(boxW / avatar.width, boxH / avatar.height);
    const dw = avatar.width * scale, dh = avatar.height * scale;
    ctx.drawImage(avatar, boxX + (boxW - dw) / 2, boxY + (boxH - dh) / 2, dw, dh);
    // 網點：護照照片是印上去的，不是貼一張彩照
    try {
      const px = ctx.getImageData(boxX, boxY, boxW, boxH);
      ctx.fillStyle = PAGE.paper;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      const step = 4;
      for (let y = 0; y < boxH; y += step) {
        for (let x = 0; x < boxW; x += step) {
          const i = (y * boxW + x) * 4;
          const lum = (px.data[i] * 0.299 + px.data[i + 1] * 0.587 + px.data[i + 2] * 0.114) / 255;
          // 紙是淺的、墨是深的，所以是暗的地方點大，和深色底那版剛好相反
          const r = (step / 2) * (1 - lum) * 1.35;
          if (r < 0.3) continue;
          ctx.fillStyle = PAGE.ink;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(boxX + x + step / 2, boxY + y + step / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } catch {
      // 跨網域讀不回像素就留彩色原圖，網點只是質感
    }
  } else {
    text(ctx, "NO PHOTO", boxX + boxW / 2, boxY + boxH / 2, { size: 17, color: PAGE.dim, align: "center", spacing: 3 });
  }
  ctx.restore();
  ctx.strokeStyle = PAGE.rule;
  ctx.lineWidth = 1.5;
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.stroke();

  // 欄位
  const fx = 316;
  const rows: [string, string][] = [
    ["持有人 / HOLDER", data.holder.name],
    ["發照年 / ISSUED", data.summary.firstYear ? String(data.summary.firstYear) : "—"],
    ["旅程 / TRIPS", String(data.summary.tripCount)],
    ["國家 / COUNTRIES", String(data.summary.countryCount)],
    ["天數 / DAYS", String(data.summary.dayCount)],
  ];
  rows.forEach(([label, value], i) => {
    field(ctx, label, value, fx, 206 + i * 74, w - 82, 28);
  });

  /*
    機讀碼：這兩行是「真的像護照」最關鍵的細節。

    字級由可用寬度反推 —— 寫死字級的話，44 個字元一定會撐出內框（上一版就是這樣超出邊緣）。
    底色只用很淡的一層，真的護照這一區就是同一張紙、只是不印底紋讓機器讀得到，
    蓋一塊白會顯得像貼上去的。
  */
  const [l1, l2] = mrzLines(data);
  const mrzLeft = 72;
  const mrzWidth = w - mrzLeft * 2;
  const top = h - 210;

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(56, top, w - 112, 122);
  ctx.strokeStyle = PAGE.rule;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, top);
  ctx.lineTo(w - 56, top);
  ctx.moveTo(56, top + 122);
  ctx.lineTo(w - 56, top + 122);
  ctx.stroke();
  ctx.globalAlpha = 1;

  let mrzSize = 21;
  ctx.save();
  while (mrzSize > 8) {
    ctx.font = `${mrzSize}px ${mono()}`;
    if (ctx.measureText(l1).width <= mrzWidth) break;
    mrzSize -= 0.5;
  }
  ctx.restore();

  text(ctx, l1, mrzLeft, top + 52, { size: mrzSize, color: PAGE.ink, family: mono() });
  text(ctx, l2, mrzLeft, top + 96, { size: mrzSize, color: PAGE.ink, family: mono() });
}

// ── 入境章 ────────────────────────────────────────────────
const STAMP_BOX = 320;

/**
 * 蓋一枚章。
 *
 * 先畫在自己的 canvas 上，再把墨「擦掉」一部分 —— 手壓下去的力道不平均，一側吃墨重、另一側
 * 缺角，橡皮章表面也不是實心的。直接在頁面上畫是做不出這個的：斑駁要靠 destination-out
 * 把已經畫好的墨挖掉，在頁面上挖會連底紋一起挖穿。
 */
function stampCanvas(stamp: PassportStamp): HTMLCanvasElement {
  const seed = hashCode(stamp.code + stamp.date);
  const rand = rng(seed);
  const ink = STAMP_INKS[seed % STAMP_INKS.length];
  const shape = seed % 4;
  const name = countryName(stamp.code);
  const d = new Date(stamp.date);
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateStr = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const canvas = document.createElement("canvas");
  canvas.width = STAMP_BOX;
  canvas.height = STAMP_BOX;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(STAMP_BOX / 2, STAMP_BOX / 2);

  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 3;

  /** 同一條線描兩次、第二次偏一點點：橡皮章壓下去邊緣不會只有一條乾淨的線 */
  const doubleStroke = (path: () => void) => {
    path();
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.translate((rand() - 0.5) * 1.8, (rand() - 0.5) * 1.8);
    path();
    ctx.stroke();
    ctx.restore();
  };

  if (shape === 0 || shape === 3) {
    const r = 86;
    doubleStroke(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); });
    if (shape === 3) {
      ctx.lineWidth = 1.5;
      doubleStroke(() => { ctx.beginPath(); ctx.arc(0, 0, r - 9, 0, Math.PI * 2); });
      ctx.lineWidth = 3;
    }
    arcText(ctx, name.en, r - 26, 0, 13, ink);
    arcText(ctx, "TRAVEL TRACKER", r - 24, Math.PI, 10, ink, true);
    text(ctx, stamp.code, 0, 4, { size: 44, color: ink, weight: 700, align: "center", spacing: 3 });
    text(ctx, dateStr, 0, 34, { size: 15, color: ink, align: "center", spacing: 1.5, family: mono() });
  } else if (shape === 1) {
    doubleStroke(() => roundRect(ctx, -104, -62, 208, 124, 5));
    ctx.lineWidth = 1.2;
    doubleStroke(() => { ctx.beginPath(); ctx.moveTo(-92, -28); ctx.lineTo(92, -28); });
    ctx.lineWidth = 3;
    text(ctx, name.en, 0, -38, { size: 15, color: ink, weight: 700, align: "center", spacing: 2 });
    text(ctx, stamp.code, 0, 14, { size: 42, color: ink, weight: 700, align: "center", spacing: 3 });
    text(ctx, dateStr, 0, 44, { size: 15, color: ink, align: "center", spacing: 1.5, family: mono() });
  } else {
    doubleStroke(() => { ctx.beginPath(); ctx.ellipse(0, 0, 108, 74, 0, 0, Math.PI * 2); });
    ctx.lineWidth = 1.2;
    doubleStroke(() => { ctx.beginPath(); ctx.ellipse(0, 0, 98, 64, 0, 0, Math.PI * 2); });
    ctx.lineWidth = 3;
    text(ctx, name.en, 0, -32, { size: 14, color: ink, weight: 700, align: "center", spacing: 2 });
    text(ctx, stamp.code, 0, 14, { size: 40, color: ink, weight: 700, align: "center", spacing: 3 });
    text(ctx, dateStr, 0, 42, { size: 14, color: ink, align: "center", spacing: 1.5, family: mono() });
  }

  // ── 斑駁 ────────────────────────────────────────────
  ctx.globalCompositeOperation = "destination-out";

  // 1. 施力不均：離施力點越遠吃墨越少
  const pressAngle = rand() * Math.PI * 2;
  const pressX = Math.cos(pressAngle) * 58;
  const pressY = Math.sin(pressAngle) * 58;
  const falloff = ctx.createRadialGradient(pressX, pressY, 10, pressX, pressY, 210);
  falloff.addColorStop(0, "rgba(0,0,0,0)");
  falloff.addColorStop(0.55, "rgba(0,0,0,0.12)");
  falloff.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = falloff;
  ctx.fillRect(-STAMP_BOX / 2, -STAMP_BOX / 2, STAMP_BOX, STAMP_BOX);

  // 2. 章面的細孔，讓墨色不是實心的
  for (let i = 0; i < 620; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 150;
    ctx.globalAlpha = 0.2 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.5 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 3. 一角沒壓到：半數的章會缺一塊邊，這是「蓋沒蓋完整」最像的來源
  if (rand() < 0.55) {
    const a = rand() * Math.PI * 2;
    const gx = Math.cos(a) * 118;
    const gy = Math.sin(a) * 100;
    const gap = ctx.createRadialGradient(gx, gy, 6, gx, gy, 96 + rand() * 46);
    gap.addColorStop(0, "rgba(0,0,0,0.95)");
    gap.addColorStop(0.6, "rgba(0,0,0,0.5)");
    gap.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gap;
    ctx.fillRect(-STAMP_BOX / 2, -STAMP_BOX / 2, STAMP_BOX, STAMP_BOX);
  }

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

function drawStamp(ctx: CanvasRenderingContext2D, stamp: PassportStamp, cx: number, cy: number) {
  const seed = hashCode(stamp.code + stamp.date);
  const stamped = stampCanvas(stamp);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((((seed % 36) - 18) * Math.PI) / 180);
  // 墨壓在紙上不會是全不透明的
  ctx.globalAlpha = 0.86;
  ctx.drawImage(stamped, -STAMP_BOX / 2, -STAMP_BOX / 2);
  ctx.restore();
}

function drawStampsPage(
  ctx: CanvasRenderingContext2D,
  stamps: PassportStamp[],
  w: number,
  h: number,
  seed: number,
  pageNo: number
) {
  pageBase(ctx, w, h, seed, pageNo);
  sectionHeader(ctx, "入境查驗", "ENTRIES", 82, 122, w - 82);

  stamps.forEach((stamp, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const jitter = hashCode(stamp.tripId + i);
    const cx = 216 + col * 272 + ((jitter % 24) - 12);
    const cy = 268 + row * 236 + ((Math.floor(jitter / 24) % 24) - 12);
    drawStamp(ctx, stamp, cx, cy);
  });
}

// ── 里程 ──────────────────────────────────────────────────
function drawMileagePage(
  ctx: CanvasRenderingContext2D,
  data: PassportData,
  w: number,
  h: number,
  pageNo: number
) {
  pageBase(ctx, w, h, 11, pageNo);
  sectionHeader(ctx, "旅行紀錄", "RECORD", 82, 122, w - 82);

  const m = data.mileage;
  let y = 212;

  /** 一條紀錄：標籤、主值、附註，底下一條細線 */
  const record = (label: string, value: string, note: string | null, big = false) => {
    text(ctx, label, 82, y, { size: 12, color: PAGE.dim, spacing: 2.6 });
    if (big) {
      // 數字一律等寬，和全站 font-money 同一個慣例；護照的欄位本來就是打字機印上去的
      text(ctx, value, 82, y + 62, { size: 54, color: PAGE.ink, weight: 700, family: mono() });
      text(ctx, "KM", 82 + measure(ctx, value, 54, 700, mono()) + 14, y + 62, {
        size: 17, color: PAGE.accent, weight: 700, spacing: 2.5,
      });
    } else {
      text(ctx, value, 82, y + 48, { size: 28, color: PAGE.ink, weight: 700 });
    }
    const noteY = big ? y + 94 : y + 78;
    if (note) text(ctx, note, 82, noteY, { size: 13, color: PAGE.dim });
    hairline(ctx, 82, noteY + 22, w - 82);
    y += big ? 178 : 146;
  };

  record(
    "已記錄航段 / LOGGED FLIGHTS",
    m.flightKm.toLocaleString("en-US"),
    m.knownSegments < m.totalSegments
      ? `${m.totalSegments} 段航段中 ${m.knownSegments} 段查得到機場座標，其餘未計入`
      : null,
    true
  );

  if (m.longestFlight) {
    const f = m.longestFlight;
    record(
      "最遠的一段航段 / LONGEST FLIGHT",
      `${f.from} → ${f.to}`,
      `${f.fromCity} → ${f.toCity} · ${f.km.toLocaleString("en-US")} KM`
    );
  }

  if (m.longestTrip) {
    record("最長的一趟 / LONGEST TRIP", m.longestTrip.name, `${m.longestTrip.days} 天`);
  }

  if (m.topCountry) {
    const name = countryName(m.topCountry.code);
    record(
      "去最多次的國家 / MOST VISITED",
      `${countryFlag(m.topCountry.code)} ${name.zh}`,
      `${name.en} · ${m.topCountry.count} 次`
    );
  }
}

// ── 年度 ──────────────────────────────────────────────────
async function drawYearPage(ctx: CanvasRenderingContext2D, year: PassportYear, w: number, h: number, pageNo: number) {
  pageBase(ctx, w, h, year.year, pageNo);
  sectionHeader(ctx, "年度回顧", "YEAR IN REVIEW", 82, 122, w - 82);
  text(ctx, String(year.year), 82, 218, {
    size: 88, color: PAGE.ink, weight: 700, spacing: 6, family: mono(),
  });

  const photo = await yearPhoto(year);
  const px = 82, py = 258, pw = w - 164, ph = 268;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 10);
  ctx.clip();
  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const dw = photo.width * scale, dh = photo.height * scale;
    ctx.drawImage(photo, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    const shade = ctx.createLinearGradient(0, py, 0, py + ph);
    shade.addColorStop(0, "rgba(245,239,228,0)");
    shade.addColorStop(1, "rgba(245,239,228,0.4)");
    ctx.fillStyle = shade;
    ctx.fillRect(px, py, pw, ph);
  } else {
    ctx.fillStyle = "rgba(43,34,66,0.05)";
    ctx.fillRect(px, py, pw, ph);
    text(ctx, "這一年沒有照片", px + pw / 2, py + ph / 2, { size: 17, color: PAGE.dim, align: "center", spacing: 2 });
  }
  ctx.restore();
  ctx.strokeStyle = PAGE.rule;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  roundRect(ctx, px, py, pw, ph, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const stats: [string, string][] = [
    ["趟數", String(year.tripCount)],
    ["國家", String(year.countryCodes.length)],
    ["天數", String(year.dayCount)],
  ];
  hairline(ctx, 82, 576, w - 82);
  stats.forEach(([label, value], i) => {
    const x = 82 + i * ((w - 164) / 3);
    text(ctx, value, x, 624, { size: 44, color: PAGE.ink, weight: 700, family: mono() });
    text(ctx, label, x, 654, { size: 12, color: PAGE.dim, spacing: 2.6 });
  });
  hairline(ctx, 82, 682, w - 82);

  if (year.countryCodes.length > 0) {
    text(ctx, year.countryCodes.map(countryFlag).join(" "), 82, 742, { size: 34, color: PAGE.ink });
    text(ctx, year.countryCodes.map((c) => countryName(c).zh).join("、"), 82, 782, {
      size: 16, color: PAGE.dim,
    });
  }

  if (year.longestTrip) {
    text(ctx, "最長的一趟 / LONGEST TRIP", 82, 856, { size: 12, color: PAGE.dim, spacing: 2.6 });
    text(ctx, year.longestTrip, 82, 894, { size: 26, color: PAGE.ink, weight: 700 });
  }
}

// ── 對外 ──────────────────────────────────────────────────
/** 把一頁畫進 canvas；DPR 與尺寸都在這裡處理，呼叫端只給元素 */
export async function drawPage(
  canvas: HTMLCanvasElement,
  page: PageSpec,
  data: PassportData,
  /** 印在頁面底部的頁碼；0 表示不標（封面與資料頁） */
  pageNo = 0
): Promise<void> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = PAGE_W * dpr;
  canvas.height = PAGE_H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, PAGE_W, PAGE_H);

  switch (page.kind) {
    case "cover":
      drawCover(ctx, coverSpan(data.summary.firstYear, data.summary.lastYear), PAGE_W, PAGE_H);
      break;
    case "data":
      await drawDataPage(ctx, data, PAGE_W, PAGE_H);
      break;
    case "stamps":
      drawStampsPage(ctx, page.stamps, PAGE_W, PAGE_H, hashCode(page.key), pageNo);
      break;
    case "mileage":
      drawMileagePage(ctx, data, PAGE_W, PAGE_H, pageNo);
      break;
    case "year":
      await drawYearPage(ctx, page.year, PAGE_W, PAGE_H, pageNo);
      break;
  }
}

/** 貼圖還沒畫好時，3D 那層先用這個當頁面底色，才不會閃一下深色 */
export const PAGE_PAPER_HEX = 0xf5efe4;

/** 3D 書本的取景參數。飛行終點要算出同一個大小，所以這幾個數字必須是共用的 */
export const BOOK_FOV = 34;
export const BOOK_FIT_MARGIN = 0.96;
/** 闔起來時框幾倍頁寬 */
export const CLOSED_VIEW_W = 1.5;
/** /passport 的 header 與底部按鈕列佔掉的高度、左右內距 */
export const BOOK_CHROME_Y = 112;
export const BOOK_CHROME_X = 16;

/**
 * 闔起來時，護照長邊在畫面上的高度。
 *
 * 和 3D 書本停在封面時是同一條計算 —— 之前這裡是自己訂一個大小、再反推鏡頭距離，而攤開的那本
 * 走的是外接矩形的框法；放大攤開那本之後兩條就分家了，於是翻開的瞬間大小會跳。現在兩邊都從
 * 這個函式來，闔著和攤開的頁面一樣大。
 */
export function closedCoverHeight(areaW: number, areaH: number): number {
  if (areaW <= 0 || areaH <= 0) return 0;
  const pw = PAGE_W / PAGE_H;
  const tilt = (BOOK_TILT_DEG * Math.PI) / 180;
  const c = Math.abs(Math.cos(tilt));
  const sn = Math.abs(Math.sin(tilt));

  const viewW = pw * CLOSED_VIEW_W;
  const boxW = viewW * c + sn;
  const boxH = viewW * sn + c;

  const halfTanV = Math.tan((BOOK_FOV * Math.PI) / 180 / 2);
  const distH = boxH / 2 / halfTanV;
  const distW = boxW / 2 / (halfTanV * (areaW / areaH));
  const dist = Math.max(distH, distW) * BOOK_FIT_MARGIN;

  // 頁高是 1 個單位，換算成畫面上的 px
  return areaH / (2 * dist * halfTanV);
}

/** 飛行終點與載入佔位用的尺寸：把 /passport 的 header 與按鈕列扣掉再算 */
export function coverDisplayHeight(): number {
  return closedCoverHeight(
    window.innerWidth - BOOK_CHROME_X,
    window.innerHeight - BOOK_CHROME_Y
  );
}

/**
 * 空白內頁：只有紙與底紋，沒有內容。
 *
 * 攤開時的左頁與活頁的背面都用它。兩者是同一張圖，所以活頁翻到底、正好蓋在左頁上的那一刻
 * 把它藏起來是看不出來的 —— 背面若印著別的東西，翻完瞬間就會跳一下。
 */
export function drawBlankPage(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = PAGE_W * dpr;
  canvas.height = PAGE_H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  pageBase(ctx, PAGE_W, PAGE_H, 5);
}

export function coverSpan(firstYear: number | null, lastYear: number | null): string {
  return firstYear ? `${firstYear} — ${lastYear}` : "尚未啟程";
}

/**
 * 只畫封面。
 *
 * 首頁地球角落那本護照用的是這一張，和書裡的封面同一組繪圖 —— 飛到中間放大之後落地的
 * 是同一張圖，接縫才看不出來。cssWidth 是它實際會被顯示的最大寬度，用來決定畫布解析度。
 */
export function drawCoverInto(canvas: HTMLCanvasElement, span: string, cssWidth: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth * dpr) / PAGE_W;
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  drawCover(ctx, span, PAGE_W, PAGE_H);
}

export const RECAP_W = 1080;
export const RECAP_H = 1350;

/**
 * 年度回顧的可存圖。
 *
 * 和書裡那頁不是同一個版面（IG 直式比例不同），但共用同一套繪圖語彙與顏色，所以存出來的圖
 * 看得出是從這本護照撕下來的。
 */
export async function drawRecapCard(
  canvas: HTMLCanvasElement,
  year: PassportYear,
  data: PassportData
): Promise<void> {
  canvas.width = RECAP_W;
  canvas.height = RECAP_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const g = ctx.createLinearGradient(0, 0, RECAP_W, RECAP_H);
  g.addColorStop(0, "#2a1e3d");
  g.addColorStop(0.6, "#1a1226");
  g.addColorStop(1, "#110d1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, RECAP_W, RECAP_H);
  rosette(ctx, RECAP_W / 2, RECAP_H / 2, 420, 60, 180, 7, 8, INK.violet, 0.07);

  text(ctx, "TRAVEL TRACKER", RECAP_W / 2, 118, {
    size: 26, color: INK.gold, weight: 700, align: "center", spacing: 8,
  });
  text(ctx, String(year.year), RECAP_W / 2, 268, {
    size: 132, color: INK.cream, weight: 700, align: "center", spacing: 8,
  });

  const photo = await yearPhoto(year);
  const px = 96, py = 320, pw = RECAP_W - 192, ph = 440;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.clip();
  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const dw = photo.width * scale, dh = photo.height * scale;
    ctx.drawImage(photo, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.restore();
  ctx.strokeStyle = INK.goldDim;
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.stroke();

  const stats: [string, string][] = [
    [String(year.tripCount), "趟旅程"],
    [String(year.countryCodes.length), "個國家"],
    [String(year.dayCount), "天在路上"],
  ];
  stats.forEach(([value, label], i) => {
    const x = RECAP_W / 2 + (i - 1) * 300;
    text(ctx, value, x, 900, { size: 84, color: INK.cream, weight: 700, align: "center" });
    text(ctx, label, x, 946, { size: 22, color: INK.dim, align: "center", spacing: 3 });
  });

  if (year.countryCodes.length > 0) {
    text(ctx, year.countryCodes.map(countryFlag).join("  "), RECAP_W / 2, 1052, {
      size: 52, color: INK.cream, align: "center",
    });
  }

  if (year.longestTrip) {
    text(ctx, year.longestTrip, RECAP_W / 2, 1150, {
      size: 34, color: INK.cream, weight: 700, align: "center",
    });
  }

  text(ctx, data.holder.name, RECAP_W / 2, RECAP_H - 92, {
    size: 22, color: INK.gold, align: "center", spacing: 4,
  });
}
