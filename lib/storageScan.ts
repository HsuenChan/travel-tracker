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

/**
 * 還有人指向的檔案路徑。
 *
 * 四張表都用同一個 bucket —— 行程照片、伴手禮、旅程裝備、個人裝備櫃走的是同一支
 * /api/itinerary/upload。漏掉任何一張，那張表的圖片就會被判成孤兒清掉。
 */
const IMAGE_SOURCES: { table: string; column: string; isArray: boolean }[] = [
  { table: "itinerary_items", column: "image_urls", isArray: true },
  { table: "souvenirs", column: "image_url", isArray: false },
  { table: "gear_items", column: "image_url", isArray: false },
  { table: "gear_closet", column: "image_url", isArray: false },
];

export async function referencedPaths(service: SupabaseClient): Promise<Set<string>> {
  const paths = new Set<string>();

  for (const src of IMAGE_SOURCES) {
    const { data, error } = await service
      .from(src.table)
      .select(src.column)
      .not(src.column, "is", null);

    /*
      查不到就整個中止，不是跳過。

      少一張表的參照，那張表的圖就會被當成沒人用而刪掉 —— 清理是不可逆的，
      寧可讓管理員看到錯誤，也不要在資料不完整的情況下算出一份孤兒清單。
    */
    if (error) throw new Error(`讀取 ${src.table} 的圖片參照失敗：${error.message}`);

    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const value = row[src.column];
      const urls = src.isArray ? ((value as string[] | null) ?? []) : [value as string | null];
      for (const url of urls) {
        const path = url ? pathFromPublicUrl(url) : null;
        if (path) paths.add(path);
      }
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

