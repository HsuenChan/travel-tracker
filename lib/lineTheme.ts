/**
 * LINE Flex 的配色。
 *
 * 聊天室背景通常是淺色，而 Flex 不會跟著使用者的深淺色主題變 —— 顏色是寫死的。所以這裡刻意
 * 用偏暖的深灰而不是 App 那組近黑：純黑卡片貼在淺色對話裡像一張截圖，暖深灰才像一則訊息。
 */
export const LINE_THEME = {
  card: "#232326",
  header: "#2b2b30",
  line: "#33333a",
  title: "#f4f4f5",
  body: "#e8e8ea",
  muted: "#8b8b93",
  /** 金額、時間欄這類要跳出來的值；比按鈕底色淺一階，小字才讀得清楚 */
  accent: "#b9a8f5",
  subtle: "#2b2b30",
  button: "#a78bfa",
  buttonQuiet: "#35353c",
} as const;

type Action = { type: string; label: string; uri?: string; data?: string };

/**
 * 卡片上的按鈕。
 *
 * 主要按鈕用 secondary 而不是 primary：Flex 的 button 不能指定文字顏色，primary 固定白字，
 * 而白字在 violet-400 上只有 2.72:1。secondary 的字是深色，同一個底色變成 6.65:1。
 * quiet 的那顆反過來 —— 深灰底配 primary 的白字才讀得到。
 */
export function lineButton(action: Action, opts: { quiet?: boolean; flex?: number } = {}) {
  return {
    type: "button",
    action,
    style: opts.quiet ? "primary" : "secondary",
    color: opts.quiet ? LINE_THEME.buttonQuiet : LINE_THEME.button,
    height: "sm",
    ...(opts.flex !== undefined ? { flex: opts.flex } : {}),
  };
}

export const uriAction = (label: string, uri: string) => ({ type: "uri", label, uri });
export const postbackAction = (label: string, data: string) => ({ type: "postback", label, data });
