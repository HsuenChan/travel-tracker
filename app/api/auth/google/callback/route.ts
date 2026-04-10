import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createOAuthClient } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?auth=error", request.url));
  }

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  const cookieStore = await cookies();
  const secureCookie = process.env.NODE_ENV === "production";

  if (tokens.access_token) {
    const maxAge = tokens.expiry_date
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
      : 3600;
    cookieStore.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: secureCookie,
      maxAge,
      path: "/",
    });
  }

  if (tokens.refresh_token) {
    cookieStore.set("google_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: secureCookie,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }

  return NextResponse.redirect(new URL("/?auth=success", request.url));
}
