import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrphans, pathFromPublicUrl, summarise, type StoredFile } from "@/lib/storageUsage";

export const BUCKET = "itinerary-images";
export const PAGE = 100;

/** 每一層都要翻頁：只讀第一頁會把後面的檔案誤判成沒有人引用，那是最危險的方向 */
export async function listAllFiles(service: SupabaseClient): Promise<StoredFile[]> {
  const files: StoredFile[] = [];

  const listPage = async (prefix: string, offset: number) =>
    service.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });

  const folders: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await listPage("", offset);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    // 資料夾沒有 id，檔案才有
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

export async function referencedPaths(service: SupabaseClient): Promise<Set<string>> {
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

export async function storageStats(service: SupabaseClient) {
  const [files, referenced] = await Promise.all([
    listAllFiles(service),
    referencedPaths(service),
  ]);
  return summarise(files, findOrphans(files, referenced));
}

