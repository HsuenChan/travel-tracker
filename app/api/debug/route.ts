import { createOAuthClient, SCOPES } from "@/lib/google-oauth";
import { cookies } from "next/headers";

export async function GET() {
  const client = createOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  const cookieStore = await cookies();
  const hasAccessToken = !!cookieStore.get("google_access_token");
  const hasRefreshToken = !!cookieStore.get("google_refresh_token");

  // Check token info
  let tokenInfo = null;
  const accessToken = cookieStore.get("google_access_token")?.value;
  if (accessToken) {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    );
    tokenInfo = await res.json();
  }

  return Response.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    hasSheetsId: !!process.env.GOOGLE_SHEETS_ID,
    hasAccessToken,
    hasRefreshToken,
    tokenScopes: tokenInfo?.scope ?? null,
    requestedScopes: SCOPES,
    authUrl,
  });
}
