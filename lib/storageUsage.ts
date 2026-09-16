/** Supabase 免費方案的 Storage 上限 */
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

/** 上傳到按下儲存之間，檔案暫時沒有任何行程指向；這段時間內不算孤兒 */
export const ORPHAN_MIN_AGE_MS = 24 * 3600_000;

export interface StoredFile {
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

/** 資料庫存的是 public URL（可能帶 #pos= 後綴），Storage 認的是路徑 */
export function pathFromPublicUrl(url: string): string | null {
  const clean = url.split("#")[0];
  const marker = "/itinerary-images/";
  const i = clean.indexOf(marker);
  if (i === -1) return null;
  const path = clean.slice(i + marker.length);
  return path ? decodeURIComponent(path) : null;
}

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
