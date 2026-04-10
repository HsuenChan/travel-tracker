import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const hasToken =
    !!cookieStore.get("google_access_token") ||
    !!cookieStore.get("google_refresh_token");
  return NextResponse.json({ authenticated: hasToken });
}
