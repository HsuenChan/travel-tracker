import { google } from "googleapis";
import { cookies } from "next/headers";

export const SCOPES = [
  "https://www.googleapis.com/auth/photoslibrary.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value;
  const refreshToken = cookieStore.get("google_refresh_token")?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const client = await getAuthenticatedClient();
  if (!client) return null;

  const result = await client.getAccessToken();
  return result.token ?? null;
}
