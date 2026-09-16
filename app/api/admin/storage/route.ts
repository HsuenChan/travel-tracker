import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { actorFrom, logChange } from "@/lib/activityLog";
import { formatBytes } from "@/lib/storageUsage";
import { BUCKET, PAGE, listAllFiles, referencedPaths, storageStats } from "@/lib/storageScan";
import { findOrphans } from "@/lib/storageUsage";

export async function GET() {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  try {
    return NextResponse.json({ stats: await storageStats(createServiceClient()) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read storage" },
      { status: 500 }
    );
  }
}

/** 判定在這裡重算，不吃前端的清單：那份快照可能已經幾分鐘前，會刪到期間新上傳的圖 */
export async function DELETE(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const service = createServiceClient();
  try {
    const [files, referenced] = await Promise.all([
      listAllFiles(service),
      referencedPaths(service),
    ]);
    const orphans = findOrphans(files, referenced);

    if (orphans.length === 0) {
      return NextResponse.json({ removed: 0, freedBytes: 0 });
    }

    let removed = 0;
    let freedBytes = 0;
    for (let i = 0; i < orphans.length; i += PAGE) {
      const batch = orphans.slice(i, i + PAGE);
      const { error } = await service.storage.from(BUCKET).remove(batch.map((f) => f.path));
      if (error) throw new Error(error.message);
      removed += batch.length;
      freedBytes += batch.reduce((acc, f) => acc + f.bytes, 0);
    }

    await logChange({
      action: "delete",
      table: "storage_objects",
      actor: actorFrom(user),
      label: "圖片儲存空間清理",
      note: `清掉 ${removed} 個沒有人引用的檔案，釋放 ${formatBytes(freedBytes)}`,
      request,
    });

    return NextResponse.json({ removed, freedBytes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clean storage" },
      { status: 500 }
    );
  }
}
