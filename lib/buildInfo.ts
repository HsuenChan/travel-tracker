/**
 * 目前線上跑的是哪一版。
 *
 * 值由 next.config.ts 在 build 時寫死（Vercel 沒有「部署時刻」的環境變數，建置當下就是它）。
 * 本機開發時這些是空的，顯示成 dev。
 */

export interface BuildInfo {
  builtAt: Date | null;
  sha: string;
  shortSha: string;
  branch: string;
  env: string;
  commitUrl: string | null;
}

export function buildInfo(): BuildInfo {
  const raw = process.env.BUILD_TIME ?? "";
  const builtAt = raw ? new Date(raw) : null;
  const sha = process.env.COMMIT_SHA ?? "";
  const repo = process.env.REPO ?? "";

  return {
    builtAt: builtAt && !Number.isNaN(builtAt.getTime()) ? builtAt : null,
    sha,
    shortSha: sha.slice(0, 7),
    branch: process.env.COMMIT_REF ?? "",
    env: process.env.DEPLOY_ENV || "dev",
    commitUrl: repo && sha ? `https://github.com/${repo}/commit/${sha}` : null,
  };
}

const UNITS: [number, string][] = [
  [60, "秒"],
  [60, "分鐘"],
  [24, "小時"],
  [Infinity, "天"],
];

/** 和後台其他地方同一套說法：剛剛 / N 分鐘前 / N 天前 */
export function sinceBuild(at: Date, now = new Date()): string {
  let value = (now.getTime() - at.getTime()) / 1000;
  if (value < 45) return "剛剛";
  for (const [step, label] of UNITS) {
    if (value < step || step === Infinity) return `${Math.floor(value)} ${label}前`;
    value /= step;
  }
  return "";
}
