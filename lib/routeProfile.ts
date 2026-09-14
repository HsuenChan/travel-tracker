/**
 * 路線檔案：一條戶外路段除了途經點以外的所有資料 —— 分級、性質、時間、進場、危險、出處。
 *
 * 存在 itinerary_items.route_profile（jsonb，見 supabase/17_route_profile.sql）。
 * 原本這些東西沒有地方放，只能塞進標題（「Cross Creek v3a2II」）跟 notes 的 HTML 裡，
 * 於是分級會手打錯、出處會被當成一般備註。這份型別就是那些欄位的家。
 *
 * 雙語一律收斂成 { zh, en }：來源同時有中英文，畫面以中文為主、英文作次要行，
 * 兩邊都可能缺，所以不能只存一個字串。
 */

export interface Bilingual {
  zh: string | null;
  en: string | null;
}

/** 「v4 a2 IV ★★★」拆開後的樣子 */
export interface RouteGrading {
  /** 原字串，解析不出來時畫面至少還有東西可顯示 */
  raw: string;
  /** 垂直技術，如 "v4" */
  v: string | null;
  /** 水流難度，如 "a2" */
  a: string | null;
  /** 投入度／時程，羅馬數字如 "IV" */
  commitment: string | null;
  stars: number;
}

export interface RouteStep {
  zh: string | null;
  en: string | null;
}

/** 路段切分（上／中／下段），時間可能掛在段落上而不是整條溪 */
export interface RouteSection {
  name: string | null;
  zh: string | null;
  detail: string | null;
  time: string | null;
}

export interface RouteVideo {
  provider: string | null;
  title: string | null;
  url: string;
}

/** 官方 topo 的其中一頁。asset 可能是相對路徑（沒有可用來源），畫面要先篩掉 */
export interface RouteTopoPage {
  page: number | null;
  zh: string | null;
  en: string | null;
  asset: string | null;
}

/** 隊伍回報：錨點鬆脫這種事比官方 topo 更新得快，是現場最該讀的一段 */
export interface RouteUpdate {
  date: string | null;
  author: string | null;
  zh: string | null;
  en: string | null;
}

export interface RouteProfile {
  /** 資料出處代號，之後接別的來源時用來分辨 */
  source: string;
  name_en: string | null;
  subtitle: Bilingual;
  region: Bilingual;
  location: Bilingual;
  grading: RouteGrading | null;
  character: Bilingual;
  gear: Bilingual;
  hazards: Bilingual;
  first_descent: string | null;
  /** 原字串，可能是十進位也可能是度分秒 */
  gps: string | null;
  elevation_m: number | null;
  details: {
    rock: Bilingual;
    catchment: Bilingual;
    anchors: Bilingual;
    water: Bilingual;
    flood: Bilingual;
    map_sheet: string | null;
  };
  times: {
    approach: string | null;
    descent: string | null;
    /** 回程。物件的 key 不能叫 return，這裡刻意用 back */
    back: string | null;
    total: string | null;
    ab_shuttle: string | null;
    max_drop: string | null;
  };
  approach: Bilingual;
  approach_steps: RouteStep[];
  route_sections: RouteSection[];
  photos: string[];
  videos: RouteVideo[];
  topo_url: string | null;
  topo_pages: RouteTopoPage[];
  source_url: string | null;
  note: string | null;
  recent_updates: RouteUpdate[];
  /** 匯入時間，用來判斷這份資料多舊 */
  imported_at: string;
}

/** 中文優先、英文遞補；兩邊都空就回 null，呼叫端據此決定整列要不要畫 */
export function pickText(b: Bilingual | null | undefined): string | null {
  if (!b) return null;
  const zh = b.zh?.trim();
  if (zh) return zh;
  const en = b.en?.trim();
  return en || null;
}

/** 有中文時才回英文，讓畫面把英文當次要行；只有英文的情況由 pickText 收走，不重複顯示 */
export function secondaryText(b: Bilingual | null | undefined): string | null {
  if (!b) return null;
  const zh = b.zh?.trim();
  const en = b.en?.trim();
  return zh && en ? en : null;
}

export function hasText(b: Bilingual | null | undefined): boolean {
  return pickText(b) !== null;
}

/**
 * 「v4 a2 IV ★★★」→ 各欄位。
 *
 * 三個部分都可能缺（新路線常常只有星等或只有 v），所以逐項獨立比對而不是一條總式，
 * 少一段也不會整串解析失敗。
 */
export function parseGrading(raw: string | null | undefined): RouteGrading | null {
  const text = raw?.trim();
  if (!text) return null;
  // 羅馬數字要求整段獨立，否則 "IV" 會在 "v4" 之類的片段裡被誤配
  const commitment = text.match(/(?:^|\s)([IVX]{1,5})(?=\s|$)/)?.[1] ?? null;
  return {
    raw: text,
    v: text.match(/\bv\d+(?:[-–]\d+)?/i)?.[0]?.toLowerCase() ?? null,
    a: text.match(/\ba\d+(?:[-–]\d+)?/i)?.[0]?.toLowerCase() ?? null,
    commitment,
    stars: (text.match(/★/g) ?? []).length,
  };
}

/**
 * 只有絕對網址載得到。
 *
 * 來源的 topo 圖多半是 /topos/nz/*.jpg 這種相對路徑，對應的檔案不在任何可存取的主機上，
 * 直接塞進 img 會得到一排破圖 —— 所以畫面一律先過這一關。
 */
export function isRenderableAsset(url: string | null | undefined): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

/** 真的載得到的照片 */
export function routePhotos(profile: RouteProfile | null | undefined): string[] {
  return (profile?.photos ?? []).filter(isRenderableAsset);
}

/** 真的有圖可看的 topo 頁 */
export function renderableTopoPages(profile: RouteProfile | null | undefined): RouteTopoPage[] {
  return (profile?.topo_pages ?? []).filter((p) => isRenderableAsset(p.asset));
}

/** 時間規劃有沒有東西可畫 */
export function hasTimes(profile: RouteProfile | null | undefined): boolean {
  const t = profile?.times;
  if (!t) return false;
  return Boolean(t.approach || t.descent || t.back || t.total || t.ab_shuttle || t.max_drop)
    || (profile?.route_sections ?? []).some((s) => s.time);
}

/** 快速資訊有沒有東西可畫 */
export function hasQuickInfo(profile: RouteProfile | null | undefined): boolean {
  if (!profile) return false;
  const d = profile.details;
  return Boolean(
    profile.grading || profile.first_descent || profile.gps || profile.elevation_m != null
    || hasText(profile.location) || hasText(profile.character) || hasText(profile.gear)
    || hasText(d.rock) || hasText(d.catchment) || hasText(d.anchors)
    || hasText(d.water) || hasText(d.flood) || d.map_sheet
  );
}

/** 進場路線有沒有東西可畫 */
export function hasApproach(profile: RouteProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.approach_steps.length > 0 || hasText(profile.approach) || Boolean(profile.details.map_sheet);
}

/**
 * 原始路線圖有沒有東西可畫。
 *
 * 只有 topo_pages 而沒有官方 PDF、且那些頁又都是載不到的相對路徑時，這一頁會整頁空白，
 * 所以兩個條件都要看。
 */
export function hasTopo(profile: RouteProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.topo_url) || renderableTopoPages(profile).length > 0;
}

/** 危險注意有沒有東西可畫 */
export function hasHazards(profile: RouteProfile | null | undefined): boolean {
  return hasText(profile?.hazards) || (profile?.recent_updates?.length ?? 0) > 0;
}

/**
 * 危險說明拆成條列。
 *
 * 來源是一整段文字，句號結尾的長段落在現場很難掃讀 —— 換行優先，沒有換行時才用句號切，
 * 這樣既支援已經分好行的資料，也救得回擠成一段的。
 */
export function splitHazards(text: string | null): string[] {
  if (!text) return [];
  const byLine = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return text
    .split(/(?<=[。！？!?])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
