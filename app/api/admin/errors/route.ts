import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";

const PAGE_SIZE = 50;

/** 伺服器端未捕捉例外，新的在前面。表還沒建好時回空清單而不是錯誤頁 */
export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0);

  const { data, error } = await createServiceClient()
    .from("api_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ errors: null, nextOffset: null });

  return NextResponse.json({
    errors: data ?? [],
    nextOffset: (data?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null,
  });
}
