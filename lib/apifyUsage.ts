/**
 * Apify 這個週期用掉多少。
 *
 * 免費方案是每月 $5、用完直接停止服務而不是超收 —— 停掉的時候畫面只會說「讀取失敗」，
 * 不會有人聯想到是額度。所以這個數字要看得到。
 *
 * 注意週期是從帳號開通日起算，不是日曆月。
 */

const LIMITS_URL = "https://api.apify.com/v2/users/me/limits";

export interface ApifyUsage {
  usedUsd: number;
  maxUsd: number;
  cycleStart: string | null;
  cycleEnd: string | null;
}

export async function fetchApifyUsage(): Promise<ApifyUsage | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(LIMITS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json())?.data;
    const used = Number(data?.current?.monthlyUsageUsd);
    const max = Number(data?.limits?.maxMonthlyUsageUsd);
    if (!Number.isFinite(used) || !Number.isFinite(max)) return null;
    return {
      usedUsd: used,
      maxUsd: max,
      cycleStart: data?.monthlyUsageCycle?.startAt ?? null,
      cycleEnd: data?.monthlyUsageCycle?.endAt ?? null,
    };
  } catch {
    // 拿不到用量不該讓整頁壞掉，那一塊不顯示就好
    return null;
  }
}
