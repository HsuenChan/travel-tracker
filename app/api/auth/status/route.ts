import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({
    authenticated: !!user,
    userId: user?.id ?? null,
    // 前端只用來決定要不要畫出後台入口；真正的門在 app/admin/layout.tsx
    isAdmin: !!user && !!process.env.ADMIN_USER_ID && user.id === process.env.ADMIN_USER_ID,
  });
}
