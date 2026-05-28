import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Resolve the set of user ids that belong to a trip (owner + collaborators).
async function getTripUserIds(
  service: ReturnType<typeof createServiceClient>,
  tripId: string,
  ownerId: string
) {
  const { data: memberRows } = await service
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId);
  const ids = (memberRows ?? [])
    .map((m) => m.user_id as string | null)
    .filter((x): x is string => !!x);
  return new Set<string>([ownerId, ...ids]);
}

// GET: list member-name bindings for a trip, with resolved Google account info.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: trip } = await service.from("trips").select("user_id").eq("id", id).single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tripUserIds = await getTripUserIds(service, id, trip.user_id);
  if (!tripUserIds.has(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows } = await service
    .from("member_links")
    .select("person_name, user_id")
    .eq("trip_id", id);

  const boundUserIds = [...new Set((rows ?? []).map((r) => r.user_id).filter((x): x is string => !!x))];
  const infoById = new Map<string, { name: string; email: string; avatar_url: string | null }>();
  await Promise.all(
    boundUserIds.map(async (uid) => {
      const { data } = await service.auth.admin.getUserById(uid);
      const u = data.user;
      infoById.set(uid, {
        name: (u?.user_metadata?.full_name as string) ?? u?.email?.split("@")[0] ?? uid,
        email: u?.email ?? "",
        avatar_url: (u?.user_metadata?.avatar_url as string) ?? null,
      });
    })
  );

  const links = (rows ?? []).map((r) => ({
    person_name: r.person_name as string,
    user_id: (r.user_id as string | null) ?? null,
    ...(r.user_id ? infoById.get(r.user_id) : { name: null, email: null, avatar_url: null }),
  }));

  return NextResponse.json({ links });
}

// POST: bind a split-bill member name to a Google account.
// Owner can bind any trip name to any trip user (or clear with user_id=null).
// A non-owner trip member may only claim an unbound name as themselves.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const personName = typeof body?.person_name === "string" ? body.person_name.trim() : "";
  const targetUserId = typeof body?.user_id === "string" ? body.user_id : null;
  if (!personName) return NextResponse.json({ error: "Missing person_name" }, { status: 400 });

  const service = createServiceClient();

  const { data: trip } = await service.from("trips").select("user_id, people").eq("id", id).single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const people: string[] = trip.people ?? [];
  if (!people.includes(personName)) {
    return NextResponse.json({ error: "person_name is not a member of this trip" }, { status: 400 });
  }

  const isOwner = trip.user_id === user.id;
  const tripUserIds = await getTripUserIds(service, id, trip.user_id);
  if (!tripUserIds.has(user.id)) {
    return NextResponse.json({ error: "Not a member of this trip" }, { status: 403 });
  }

  let boundUserId: string | null;
  if (isOwner) {
    // Owner: bind to any trip user, or clear when targetUserId is null.
    if (targetUserId && !tripUserIds.has(targetUserId)) {
      return NextResponse.json({ error: "Target user is not part of this trip" }, { status: 400 });
    }
    boundUserId = targetUserId;
  } else {
    // Non-owner: self-claim only — can only bind to themselves.
    if (targetUserId && targetUserId !== user.id) {
      return NextResponse.json({ error: "You can only claim a member as yourself" }, { status: 403 });
    }
    // The name must not already be claimed by someone else.
    const { data: existing } = await service
      .from("member_links")
      .select("user_id")
      .eq("trip_id", id)
      .eq("person_name", personName)
      .maybeSingle();
    if (existing?.user_id && existing.user_id !== user.id) {
      return NextResponse.json({ error: "This member is already claimed" }, { status: 409 });
    }
    boundUserId = user.id;
  }

  const { error } = await service
    .from("member_links")
    .upsert(
      { trip_id: id, person_name: personName, user_id: boundUserId },
      { onConflict: "trip_id,person_name" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE: remove a binding. Owner only (Phase 1).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const personName = searchParams.get("person_name");
  if (!personName) return NextResponse.json({ error: "Missing person_name" }, { status: 400 });

  const service = createServiceClient();

  const { data: trip } = await service.from("trips").select("user_id").eq("id", id).single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trip.user_id !== user.id) {
    return NextResponse.json({ error: "Only owner can unbind members" }, { status: 403 });
  }

  await service.from("member_links").delete().eq("trip_id", id).eq("person_name", personName);

  return NextResponse.json({ success: true });
}
