/**
 * 圖片儲存空間的統計與孤兒判定。
 *
 * 純函式，資料由 /api/admin/storage 撈好後傳進來 —— 「這張圖還有沒有人在用」的規則只有一個
 * 地方要讀，而不是散在列檔案與刪檔案兩段程式之間。
 */

/** Supabase 免費方案的 Storage 上限 */
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

/**
 * 剛上傳但還沒存檔的圖不算孤兒。
 *
 * 上傳是即時的、存檔是之後才按的，中間那段時間檔案確實沒有任何一筆行程指向它 ——
 * 這時候清掉，使用者按下儲存就會得到一張破圖。給足一天的緩衝。
 */
export const ORPHAN_MIN_AGE_MS = 24 * 3600_000;

export interface StoredFile {
  /** bucket 內的路徑，例如 <tripId>/<uuid>.webp */
  path: string;
  bytes: number;
  createdAt: string;
}

export interface StorageStats {
  totalBytes: number;
  totalFiles: number;
  orphanBytes: number;
  orphanFiles: number;
  limitBytes: number;
}

/**
 * 從公開網址取回 bucket 內的路徑。
 *
 * 資料庫存的是完整的 public URL（而且可能帶 #pos= 封面位置後綴），但 Storage 的 API 認的是
 * 路徑，兩邊要能對得起來才知道哪些檔案還有人用。
 */
export function pathFromPublicUrl(url: string): string | null {
  const clean = url.split("#")[0];
  const marker = "/itinerary-images/";
  const i = clean.indexOf(marker);
  if (i === -1) return null;
  const path = clean.slice(i + marker.length);
  return path ? decodeURIComponent(path) : null;
}

/** 沒有任何一筆行程指向、而且已經放超過緩衝期的檔案 */
export function findOrphans(
  files: StoredFile[],
  referencedPaths: Set<string>,
  now = Date.now()
): StoredFile[] {
  return files.filter(
    (f) =>
      !referencedPaths.has(f.path) &&
      now - new Date(f.createdAt).getTime() >= ORPHAN_MIN_AGE_MS
  );
}

export function summarise(files: StoredFile[], orphans: StoredFile[]): StorageStats {
  const sum = (list: StoredFile[]) => list.reduce((acc, f) => acc + f.bytes, 0);
  return {
    totalBytes: sum(files),
    totalFiles: files.length,
    orphanBytes: sum(orphans),
    orphanFiles: orphans.length,
    limitBytes: STORAGE_LIMIT_BYTES,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
