import { type NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { fetchMessageContent } from "@/lib/linePush";
import {
  handleChatImage, handleChatPostback, handleChatText, isNumberReply,
  type ChatContext,
} from "@/lib/lineChat";

/**
 * LINE 的 webhook 入口。
 *
 * 這裡只做 LINE 專屬的事：驗簽、判斷有沒有被 @、把訊息送回去。要回什麼由 lib/lineChat 決定，
 * 後台的模擬器呼叫的是同一批函式。
 */

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const BOT_USER_ID = process.env.LINE_BOT_USER_ID ?? "";

type Mentionee = { index: number; length: number; userId: string; type: string };
type LineEvent = {
  type: string;
  replyToken?: string;
  source: { type?: "user" | "group" | "room"; userId: string; groupId?: string; roomId?: string };
  message?: { type: string; id?: string; text?: string; mention?: { mentionees: Mentionee[] } };
  postback?: { data: string };
};

function verifySignature(body: string, signature: string): boolean {
  return crypto.createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64") === signature;
}

async function replyMessage(replyToken: string, messages: object[]) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
}

function chatId(event: LineEvent): string {
  return event.source.groupId ?? event.source.roomId ?? event.source.userId;
}

function isBotMentioned(message: NonNullable<LineEvent["message"]>): boolean {
  if (!BOT_USER_ID) return true;
  return message.mention?.mentionees.some((m) => m.userId === BOT_USER_ID) ?? false;
}

function stripMentions(text: string, mentionees: Mentionee[]): string {
  const sorted = [...mentionees].sort((a, b) => b.index - a.index);
  let result = text;
  for (const m of sorted) result = result.slice(0, m.index) + result.slice(m.index + m.length);
  return result.trim();
}

async function handleEvent(event: LineEvent) {
  const replyToken = event.replyToken!;
  const isGroup = !!(event.source.groupId ?? event.source.roomId);
  const ctx: ChatContext = { chatId: chatId(event), userId: event.source.userId, isGroup };

  const send = async (messages: object[]) => {
    if (messages.length > 0) await replyMessage(replyToken, messages);
  };

  if (event.type === "postback" && event.postback) {
    await send(await handleChatPostback(ctx, event.postback.data));
    return;
  }

  if (event.type !== "message") return;

  if (event.message?.type === "image") {
    const messageId = event.message.id;
    if (!messageId) return;
    await send(await handleChatImage(ctx, () => fetchMessageContent(messageId)));
    return;
  }

  if (event.message?.type !== "text" || !event.message.text) return;

  const rawText = event.message.text.trim();
  // 群組裡沒 @ 到就當作不是在跟 bot 說話；純數字是選平分對象的回覆，那個不該還要 @
  if (isGroup && !isNumberReply(rawText) && !isBotMentioned(event.message)) return;

  const text = isGroup && !isNumberReply(rawText)
    ? stripMentions(event.message.text, event.message.mention?.mentionees ?? [])
    : rawText;

  await send(await handleChatText(ctx, text));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!verifySignature(body, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const payload = JSON.parse(body);
  await Promise.all((payload.events as LineEvent[]).map(handleEvent));
  return NextResponse.json({ ok: true });
}
