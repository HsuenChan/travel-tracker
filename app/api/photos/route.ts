import { type NextRequest, NextResponse } from "next/server";

type ParsedAlbumUrl =
  | { type: "share"; url: string }
  | { type: "short_url" }
  | { type: "unknown" };

function parseAlbumUrl(url: string): ParsedAlbumUrl {
  if (/photos\.app\.goo\.gl/.test(url)) return { type: "short_url" };
  if (/photos\.google\.com\/(share|album)\//.test(url)) return { type: "share", url };
  return { type: "unknown" };
}

interface MediaItem {
  id: string;
  baseUrl: string;
  filename: string;
  isVideo?: boolean;
  videoUrl?: string;  // direct video CDN URL extracted from entry[9] if available
  mediaMetadata: { width: string; height: string; creationTime?: string };
}

/**
 * Opaque pagination state encoded into nextPageToken.
 * ct = continuation token from ds:1 data[2] (AH_uQ4…); passed as payload[1] in snAcKc.
 * Subsequent pages get a new ct from the snAcKc response.
 */
interface PageState {
  albumToken: string; // share path token (AF1Qip…)
  albumKey: string;   // key= query param
  ct: string;         // continuation token
  sid: string;        // f.sid session ID
  bl: string;         // build label (boq_photosuiserver_…)
  url: string;        // original share URL (Referer)
}

function encodePageState(state: PageState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodePageState(token: string): PageState | null {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf-8")) as PageState;
  } catch {
    return null;
  }
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
};

// ── ds:1 parsing ─────────────────────────────────────────────────────────────

interface Ds1Result {
  items: MediaItem[];
  ct: string | null;         // continuation token for snAcKc (data[2])
  albumToken: string | null; // share path token (data[3][0])
}

function parseDs1(html: string): Ds1Result | null {
  try {
    const marker = "AF_initDataCallback({key: 'ds:1'";
    const start = html.indexOf(marker);
    if (start < 0) return null;

    const dataStart = html.indexOf("data:", start) + 5;
    let depth = 0, dataEnd = dataStart;
    for (let i = dataStart; i < html.length; i++) {
      if (html[i] === "[" || html[i] === "{") depth++;
      else if (html[i] === "]" || html[i] === "}") {
        depth--;
        if (depth === 0) { dataEnd = i + 1; break; }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = JSON.parse(html.slice(dataStart, dataEnd));

    // data[1] = photo list
    // data[2] = AH_uQ4… continuation token (used as payload[1] in snAcKc RPC)
    // data[3] = [albumPathToken, albumName, dateMeta, ...]
    const photoList = data[1];
    if (!Array.isArray(photoList)) return null;

    const ct = typeof data[2] === "string" ? data[2] : null;
    const albumToken = Array.isArray(data[3]) && typeof data[3][0] === "string"
      ? data[3][0] as string
      : null;

    const items: MediaItem[] = [];
    for (const entry of photoList) {
      if (!Array.isArray(entry)) continue;
      const mediaMeta = entry[1];
      if (!Array.isArray(mediaMeta)) continue;
      const cdnUrl = mediaMeta[0] as string;
      const width = mediaMeta[1] as number;
      const height = mediaMeta[2] as number;
      const tsMs = entry[2] as number;
      if (typeof cdnUrl !== "string" || !cdnUrl.startsWith("https://lh3")) continue;

      const pwMatch = cdnUrl.match(/\/pw\/([A-Za-z0-9_-]{20,})/);
      const id = pwMatch ? pwMatch[1].slice(0, 40) : `idx_${items.length}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entryAny = entry as any;

      // A true video has entry[9]["76647426"] — an array containing the video CDN URL.
      // entry[8]===2 alone is unreliable; many photos also have it.
      let videoUrl: string | undefined;
      try {
        const v9 = entryAny[9];
        if (v9 && typeof v9 === "object") {
          const videoMeta = v9["76647426"];
          if (Array.isArray(videoMeta)) {
            for (const part of videoMeta) {
              if (Array.isArray(part)) {
                const found = (part as unknown[]).find(
                  (x): x is string => typeof x === "string" && x.startsWith("https://lh3"),
                );
                if (found) { videoUrl = found; break; }
              } else if (typeof part === "string" && part.startsWith("https://lh3")) {
                videoUrl = part; break;
              }
            }
            // Has the video metadata array but URL not found — fall back to =m22
            if (!videoUrl) videoUrl = `${cdnUrl}=m22`;
          }
        }
      } catch { /* ignore */ }

      const isVideo = videoUrl !== undefined;

      items.push({
        id,
        baseUrl: cdnUrl,
        filename: `photo_${items.length + 1}.${isVideo ? "mp4" : "jpg"}`,
        isVideo: isVideo || undefined,
        videoUrl,
        mediaMetadata: {
          width: String(width || 1000),
          height: String(height || 750),
          creationTime: tsMs ? new Date(tsMs).toISOString() : undefined,
        },
      });
    }

    return items.length > 0 ? { items, ct, albumToken } : null;
  } catch {
    return null;
  }
}

// ── Fallback CDN URL scraping ──────────────────────────────────────────────

function extractCdnUrls(html: string): MediaItem[] {
  const seen = new Set<string>();
  const items: MediaItem[] = [];
  const regex = /https:\/\/lh3\.googleusercontent\.com\/pw\/([A-Za-z0-9_\-]{60,})/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const baseUrl = `https://lh3.googleusercontent.com/pw/${m[1]}`;
    if (!seen.has(baseUrl)) {
      seen.add(baseUrl);
      items.push({
        id: m[1].slice(0, 40),
        baseUrl,
        filename: `photo_${items.length + 1}.jpg`,
        mediaMetadata: { width: "1000", height: "750" },
      });
    }
  }
  return items;
}

// ── Session param extraction ───────────────────────────────────────────────

function extractSessionParams(html: string): { sid: string | null; bl: string | null } {
  const sidMatch = html.match(/"FdrFJe":"(-?\d+)"/);
  const blMatch =
    html.match(/"IVh2Zc":"([^"]+)"/) ??
    html.match(/"([^"]*boq_photosuiserver[^"]*)"/) ??
    html.match(/buildLabel[=\\u003d]+([^&'"\\]+)/);
  return {
    sid: sidMatch?.[1] ?? null,
    bl: blMatch?.[1] ?? null,
  };
}

// ── batchexecute snAcKc pagination ────────────────────────────────────────

/**
 * Extract all JSON arrays from a Google batchexecute response.
 * Handles both standard and streaming (rt=c) formats where byte-count
 * lines appear between JSON chunks.
 */
function extractBatchChunks(text: string): unknown[][] {
  const results: unknown[][] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t === ")]}'") continue;
    if (/^\d+$/.test(t)) continue;
    try {
      const parsed: unknown = JSON.parse(t);
      if (Array.isArray(parsed)) results.push(parsed as unknown[]);
    } catch { /* skip */ }
  }
  return results;
}

function parseSnAcKcResponse(text: string): { items: MediaItem[]; nextCt: string | null } | null {
  try {
    const chunks = extractBatchChunks(text);
    console.log("[photos] snAcKc chunks:", chunks.length);

    // Find wrb.fr entry for snAcKc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dataStr: string | null = null;
    for (const outer of chunks) {
      for (const chunk of outer) {
        if (Array.isArray(chunk) && chunk[0] === "wrb.fr" && chunk[1] === "snAcKc") {
          console.log("[photos] snAcKc wrb.fr found, data[2] type:", typeof chunk[2], "data[5]:", JSON.stringify(chunk[5])?.slice(0, 40));
          if (typeof chunk[2] === "string") { dataStr = chunk[2] as string; break; }
        }
      }
      if (dataStr) break;
    }

    if (!dataStr) {
      console.log("[photos] snAcKc: no data string in response");
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = JSON.parse(dataStr);
    console.log("[photos] snAcKc data.length:", Array.isArray(data) ? data.length : "not array",
      "data[0] type:", typeof data[0], "data[1] isArray:", Array.isArray(data[1]));

    // Response structure mirrors ds:1:
    // data[0] = null, data[1] = photo array, data[2] = next continuation token
    const nextCt = typeof data[2] === "string" ? data[2] : null;
    const photoList = Array.isArray(data[1]) ? data[1] : null;
    if (!photoList) return null;

    const items: MediaItem[] = [];
    for (const entry of photoList) {
      if (!Array.isArray(entry)) continue;
      const mediaMeta = entry[1];
      if (!Array.isArray(mediaMeta)) continue;
      const cdnUrl = mediaMeta[0] as string;
      const width = mediaMeta[1] as number;
      const height = mediaMeta[2] as number;
      const tsMs = entry[2] as number;
      if (typeof cdnUrl !== "string" || !cdnUrl.startsWith("https://lh3")) continue;

      const pwMatch = cdnUrl.match(/\/pw\/([A-Za-z0-9_-]{20,})/);
      const id = pwMatch ? pwMatch[1].slice(0, 40) : `idx_${items.length}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entryAny = entry as any;
      // entry[8]===2 alone is unreliable (photos can also have it).
      // Videos additionally have entry[4] > 0 (duration) AND entry[9] as an object.
      const isVideo =
        entryAny[8] === 2 &&
        entryAny[4] != null && entryAny[4] > 0 &&
        entryAny[9] != null && typeof entryAny[9] === "object";

      let videoUrl: string | undefined;
      if (isVideo) {
        try {
          const v9 = entryAny[9];
          if (v9 && typeof v9 === "object") {
            const videoMeta = v9["76647426"];
            if (Array.isArray(videoMeta)) {
              for (const part of videoMeta) {
                if (Array.isArray(part)) {
                  const found = (part as unknown[]).find(
                    (x): x is string => typeof x === "string" && x.startsWith("https://lh3"),
                  );
                  if (found) { videoUrl = found; break; }
                } else if (typeof part === "string" && part.startsWith("https://lh3")) {
                  videoUrl = part; break;
                }
              }
            }
          }
        } catch { /* ignore */ }
        if (!videoUrl) videoUrl = `${cdnUrl}=m22`;
      }

      items.push({
        id,
        baseUrl: cdnUrl,
        filename: `photo_${items.length + 1}.${isVideo ? "mp4" : "jpg"}`,
        isVideo: isVideo || undefined,
        videoUrl,
        mediaMetadata: {
          width: String(width || 1000),
          height: String(height || 750),
          creationTime: tsMs ? new Date(tsMs).toISOString() : undefined,
        },
      });
    }

    console.log("[photos] snAcKc parsed:", items.length, "photos, nextCt:", nextCt ? nextCt.slice(0, 20) + "…" : null);
    return { items, nextCt };
  } catch (e) {
    console.log("[photos] snAcKc parse error:", e);
    return null;
  }
}

async function fetchNextPage(state: PageState): Promise<{ items: MediaItem[]; nextCt: string | null } | null> {
  const { albumToken, albumKey, ct, sid, bl, url: shareUrl } = state;
  if (!sid || !bl || !ct) return null;

  const rpcId = "snAcKc";
  const reqId = Math.floor(Math.random() * 1000000) * 100 + 1;

  // Payload confirmed from DevTools: [albumToken, continuationToken, null, albumKey]
  const innerPayload = JSON.stringify([albumToken, ct, null, albumKey]);
  const fReq = JSON.stringify([[[rpcId, innerPayload, null, "generic"]]]);

  const apiUrl =
    `https://photos.google.com/_/PhotosUi/data/batchexecute` +
    `?rpcids=${rpcId}` +
    `&source-path=${encodeURIComponent("/share/" + albumToken)}` +
    `&f.sid=${encodeURIComponent(sid)}` +
    `&bl=${encodeURIComponent(bl)}` +
    `&hl=en` +
    `&soc-app=165&soc-platform=1&soc-device=1` +
    `&_reqid=${reqId}&rt=c`;

  const body = new URLSearchParams({ "f.req": fReq });
  // Note: no 'at' CSRF token — unauthenticated server requests don't have one.
  // snAcKc for public shared albums may work without it.

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "User-Agent": FETCH_HEADERS["User-Agent"],
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "Accept": "*/*",
      "Origin": "https://photos.google.com",
      "Referer": shareUrl,
      "X-Same-Domain": "1",
    },
    body: body.toString(),
  });

  console.log("[photos] snAcKc status:", res.status);
  const text = await res.text();
  console.log("[photos] snAcKc raw:", text.slice(0, 400));

  if (!res.ok) return null;
  return parseSnAcKcResponse(text);
}

// ── Main scrape ────────────────────────────────────────────────────────────

async function scrapeShareUrl(shareUrl: string): Promise<{ items: MediaItem[]; nextPageToken: string | null } | null> {
  try {
    const res = await fetch(shareUrl, { headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();

    const { sid, bl } = extractSessionParams(html);
    const ds1 = parseDs1(html);

    if (ds1 && ds1.items.length > 0) {
      let nextPageToken: string | null = null;
      if (ds1.ct && sid && bl) {
        const urlObj = new URL(shareUrl);
        const albumKey = urlObj.searchParams.get("key") ?? "";
        const albumToken = ds1.albumToken ?? urlObj.pathname.split("/share/")[1]?.split("?")[0] ?? "";
        nextPageToken = encodePageState({ albumToken, albumKey, ct: ds1.ct, sid, bl, url: shareUrl });
      }
      return { items: ds1.items, nextPageToken };
    }

    const fallback = extractCdnUrls(html);
    return fallback.length > 0 ? { items: fallback, nextPageToken: null } : null;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shareUrl = searchParams.get("shareUrl");
  const albumId = searchParams.get("albumId");
  const pageToken = searchParams.get("pageToken");

  const targetUrl = shareUrl ?? (albumId ? `https://photos.google.com/album/${albumId}` : null);

  if (!targetUrl) {
    return NextResponse.json({ error: "missing_param" }, { status: 400 });
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  if (pageToken) {
    const state = decodePageState(pageToken);
    if (!state) {
      return NextResponse.json({ error: "invalid_page_token" }, { status: 400 });
    }
    const result = await fetchNextPage(state);
    if (!result) {
      return NextResponse.json(
        { error: "pagination_failed", message: "無法載入更多照片" },
        { status: 502 },
      );
    }
    const nextPageToken = result.nextCt
      ? encodePageState({ ...state, ct: result.nextCt })
      : null;
    return NextResponse.json({ mediaItems: result.items, nextPageToken }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  const parsed = parseAlbumUrl(targetUrl);

  if (parsed.type === "short_url") {
    return NextResponse.json(
      {
        error: "short_url",
        message:
          "photos.app.goo.gl 短連結無法在伺服器端解析。請從瀏覽器網址列複製完整連結（https://photos.google.com/share/...），再更新旅程設定。",
      },
      { status: 400 },
    );
  }

  if (parsed.type === "unknown") {
    return NextResponse.json({ error: "unresolvable", message: "無法識別此連結格式" }, { status: 400 });
  }

  const result = await scrapeShareUrl(parsed.url);
  if (!result) {
    return NextResponse.json(
      { error: "scrape_failed", message: "無法讀取相簿內容，請確認分享設定為「任何人可查看」" },
      { status: 502 },
    );
  }

  return NextResponse.json({ mediaItems: result.items, nextPageToken: result.nextPageToken }, {
    headers: { "Cache-Control": "no-store" },
  });
}
