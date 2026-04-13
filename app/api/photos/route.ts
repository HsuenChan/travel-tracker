import { type NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google-oauth";

const PHOTOS_BASE = "https://photoslibrary.googleapis.com/v1";

/** Follow a Google Photos share URL and extract the underlying album ID. */
async function resolveShareUrlToAlbumId(shareUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shareUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    // Final URL after all redirects, e.g.:
    //   https://photos.google.com/album/{id}
    //   https://photos.google.com/lr/album/{id}
    //   https://photos.google.com/u/0/album/{id}
    const match = res.url.match(/\/album\/([^/?&#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get("albumId");
  const shareUrl = searchParams.get("shareUrl");
  const pageToken = searchParams.get("pageToken");

  // ── shareUrl mode: resolve share link → album ID → media items ──────────
  if (shareUrl) {
    const resolvedId = await resolveShareUrlToAlbumId(shareUrl);
    if (!resolvedId) {
      return NextResponse.json({ error: "Could not resolve album from URL" }, { status: 400 });
    }
    const body: Record<string, unknown> = { albumId: resolvedId, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(`${PHOTOS_BASE}/mediaItems:search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  }

  // ── albumId mode: list media items in a known album ──────────────────────
  if (albumId) {
    const body: Record<string, unknown> = { albumId, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(`${PHOTOS_BASE}/mediaItems:search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  }

  // ── no params: list all albums ───────────────────────────────────────────
  const res = await fetch(`${PHOTOS_BASE}/albums?pageSize=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}
