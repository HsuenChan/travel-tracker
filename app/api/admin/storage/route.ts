import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/adminAuth";
import { actorFrom, logChange } from "@/lib/activityLog";
import {
  findOrphans, pathFromPublicUrl, summarise, formatBytes, type StoredFile,
} from "@/lib/storageUsage";

const BUCKET = "itinerary-images";
const PAGE = 100;

/**
 * bucket 裡的所有檔案。
 *
 * Storage 的 list 只列一層，而檔案是放在 <tripId>/<uuid>.webp 底下的，所以要先列出資料夾
 * 再逐個進去。每一層都要翻頁 —— 一趟照片多的旅程很容易超過一頁，只讀第一頁會把後面的檔案
 * 全部誤判成「不存在」，那正好是最危險的方向。
 */
async function listAllFiles(service: SupabaseClient): Promise<StoredFile[]> {
  const files: StoredFile[] = [];

  const listPage = async (prefix: string, offset: number) =>
    service.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });

  const folders: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await listPage("", offset);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    // 資料夾沒有 id，檔案才有 —— Supabase 就是用這個區分的
    for (const entry of data) {
      if (entry.id === null) folders.push(entry.name);
    }
    if (data.length < PAGE) break;
  }

  for (const folder of folders) {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await listPage(folder, offset);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      for (const entry of data) {
        if (entry.id === null) continue;
        files.push({
          path: `${folder}/${entry.name}`,
          bytes: (entry.metadata?.size as number) ?? 0,
          createdAt: entry.created_at ?? new Date().toISOString(),
        });
      }
      if (data.length < PAGE) break;
    }
  }

  return files;
}

/** 還有行程指向的檔案路徑 */
async function referencedPaths(service: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await service
    .from("itinerary_items")
    .select("image_urls")
    .not("image_urls", "is", null);
  if (error) throw new Error(error.message);

  const paths = new Set<string>();
  for (const row of data ?? []) {
    for (const url of (row.image_urls as string[] | null) ?? []) {
      const path = pathFromPublicUrl(url);
      if (path) paths.add(path);
    }
  }
  return paths;
}

export async function GET() {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const service = createServiceClient();
  try {
    const [files, referenced] = await Promise.all([
      listAllFiles(service),
      referencedPaths(service),
    ]);
    const orphans = findOrphans(files, referenced);
    return NextResponse.json({ stats: summarise(files, orphans) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read storage" },
      { status: 500 }
    );
  }
}

/**
 * 清掉沒有人引用的檔案。
 *
 * 刪除的判定在這裡重算一次，不吃前端傳來的清單 —— 使用者看到統計到按下按鈕之間可能過了幾分鐘，
 * 拿當時的快照去刪，會刪到那段時間內新上傳的圖。
 */
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

    // Storage 的 remove 一次收一批，切成小批才不會撞到請求大小限制
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
