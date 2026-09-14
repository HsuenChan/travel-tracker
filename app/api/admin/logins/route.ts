import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0);

  const { data, error } = await createServiceClient()
    .from("activity_log")
    .select("*")
    .eq("kind", "auth")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    events: data ?? [],
    nextOffset: (data?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null,
  });
}
