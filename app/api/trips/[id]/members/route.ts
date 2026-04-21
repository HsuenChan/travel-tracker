import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: trip } = await supabase
    .from("trips")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serviceClient = createServiceClient();

  const { data: memberRows } = await serviceClient
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", id);

  const memberUserIds = memberRows?.map((m) => m.user_id) ?? [];
  const allUserIds = [...new Set([trip.user_id, ...memberUserIds])];

  const userInfos = await Promise.all(
    allUserIds.map(async (uid) => {
      const { data } = await serviceClient.auth.admin.getUserById(uid);
      const u = data.user;
      return {
        user_id: uid,
        name: u?.user_metadata?.full_name ?? u?.email?.split("@")[0] ?? uid,
        email: u?.email ?? "",
        avatar_url: (u?.user_metadata?.avatar_url as string) ?? null,
        is_owner: uid === trip.user_id,
      };
    })
  );

  userInfos.sort((a, b) => Number(b.is_owner) - Number(a.is_owner));

  return NextResponse.json({ members: userInfos });
}
