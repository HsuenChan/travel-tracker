import type { Instrumentation } from "next";

/**
 * 伺服器端未捕捉例外的收集點。
 *
 * onRequestError 收得到 route handler、Server Component 與 Server Action 真正拋出來的
 * 錯誤 —— 比在每支 API 包 try/catch 好的地方是不會漏，之後新增的 API 自動被涵蓋。
 *
 * 收不到的是 `return NextResponse.json({ error }, { status: 500 })` 那種：那不是例外
 * 而是正常回應。要涵蓋的話得在那些地方另外補，這裡刻意不做 —— 真正需要有人去看的是
 * 當機，不是預期中的驗證失敗。
 */

/** 同一支路由、同一個訊息，這段時間內只記一筆 */
const DEDUPE_MS = 5 * 60_000;

/** 標頭裡只留查得上用場的兩個，其餘（含 cookie、authorization）一律不碰 */
function pick(headers: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = headers[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const error = err as Error & { digest?: string };
    const message = error.message || String(err);
    const routePath = context.routePath ?? null;

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };

    /*
      去重。一支壞掉的 API 被前端輪詢就是幾千筆一模一樣的錯誤，不擋的話這一頁讀不了，
      真正需要注意的其他錯誤也會被洗掉。
    */
    const since = new Date(Date.now() - DEDUPE_MS).toISOString();
    const query = new URLSearchParams({
      select: "id",
      limit: "1",
      created_at: `gte.${since}`,
      message: `eq.${message}`,
      route_path: routePath === null ? "is.null" : `eq.${routePath}`,
    });
    const recent = await fetch(`${url}/rest/v1/api_errors?${query}`, { headers });
    if (recent.ok) {
      const rows = (await recent.json()) as unknown[];
      if (rows.length > 0) return;
    }

    await fetch(`${url}/rest/v1/api_errors`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: request.path,
        method: request.method ?? null,
        route_path: routePath,
        route_type: context.routeType ?? null,
        message,
        // stack 會揭露伺服器路徑與程式結構，所以 api_errors 開了 RLS 且不給任何 policy
        stack: error.stack ?? null,
        digest: error.digest ?? null,
        ip: pick(request.headers, "x-forwarded-for"),
        user_agent: pick(request.headers, "user-agent"),
      }),
    });
  } catch {
    /*
      這裡絕對不能往外丟。onRequestError 本身壞掉的話，使用者看到的會從「某支 API 出錯」
      變成「整個請求以更難懂的方式失敗」—— 把觀測工具變成故障來源是最糟的結果。
    */
  }
};
