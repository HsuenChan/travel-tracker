import { NextResponse } from "next/server";
import { createOAuthClient, SCOPES } from "@/lib/google-oauth";

export async function GET() {
  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  return NextResponse.redirect(url);
}
