/**
 * LINE 的主動推播。
 *
 * 和 webhook 的 replyMessage 不同：那個要 replyToken、只能回應使用者剛送出的訊息，
 * 而且有效期只有幾十秒。cron 要在沒有人開口的時候發訊息，只能走 push。
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function tripUrl(tripId: string, tab?: string): string {
  return `${APP_BASE_URL}/trips/${tripId}${tab ? `?tab=${tab}` : ""}`;
}

export interface PushResult {
  ok: boolean;
  status: number;
  detail?: string;
}

/** 推一則訊息到某個聊天室（群組、個人皆可，to 就是 webhook 裡的 chatId） */
export async function pushMessage(to: string, messages: object[]): Promise<PushResult> {
  if (!CHANNEL_ACCESS_TOKEN) return { ok: false, status: 0, detail: "no_access_token" };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (res.ok) return { ok: true, status: res.status };
  return { ok: false, status: res.status, detail: (await res.text()).slice(0, 300) };
}

/** 抓使用者傳來的圖片原始檔（收據辨識用） */
export async function fetchMessageContent(messageId: string): Promise<Buffer | null> {
  if (!CHANNEL_ACCESS_TOKEN) return null;
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
