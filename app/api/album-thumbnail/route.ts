import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const albumUrl = searchParams.get("url");

  if (!albumUrl) {
    return NextResponse.json({ thumbnail: null });
  }

  try {
    const res = await fetch(albumUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    const html = await res.text();

    const match =
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);

    // Try og:image
    const ogMatch =
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);

    // Try Google CDN image URLs embedded in the page
    const cdnMatch = html.match(/https:\/\/lh\d+\.googleusercontent\.com\/[^"'\s)>]+/);

    return NextResponse.json({
      thumbnail: ogMatch?.[1] ?? cdnMatch?.[0] ?? null,
      debug: {
        finalUrl: res.url,
        htmlSnippet: html.slice(0, 500),
        hasOgImage: !!ogMatch,
        hasCdnUrl: !!cdnMatch,
      },
    });
  } catch (e) {
    return NextResponse.json({ thumbnail: null, error: String(e) });
  }
}
