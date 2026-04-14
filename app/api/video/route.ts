import { type NextRequest } from "next/server";

const ALLOWED_HOST = "lh3.googleusercontent.com";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("missing url", { status: 400 });
  }

  // Only proxy Google Photos CDN URLs
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (parsed.hostname !== ALLOWED_HOST) {
    return new Response("forbidden host", { status: 403 });
  }

  // Forward Range header so video seeking works
  const rangeHeader = request.headers.get("range");

  const upstream = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://photos.google.com/",
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`upstream: ${upstream.status}`, { status: upstream.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
  headers.set("Cache-Control", "public, max-age=3600");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
