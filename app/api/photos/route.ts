import { type NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google-oauth";

const PHOTOS_BASE = "https://photoslibrary.googleapis.com/v1";

export async function GET(request: NextRequest) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get("albumId");

  if (!albumId) {
    // List all albums
    const res = await fetch(`${PHOTOS_BASE}/albums?pageSize=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  }

  // List media items in a specific album
  const res = await fetch(`${PHOTOS_BASE}/mediaItems:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ albumId, pageSize: 100 }),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}
