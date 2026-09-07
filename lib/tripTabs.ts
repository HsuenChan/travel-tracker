/**
 * 旅程分頁的順序與名稱。
 *
 * enabled_tabs（這趟要顯示哪些分頁）與 shared_tabs（分享連結要露出哪些分頁）存的都是這裡的 key，
 * 所以分享範圍設定、分享頁與後端驗證共用同一份，不用各自維護一張對照表。
 */
export const TRIP_TABS = [
  { key: "transport", label: "路線" },
  { key: "itinerary", label: "行程" },
  { key: "expenses", label: "費用" },
  { key: "photos", label: "照片" },
  { key: "notes", label: "筆記" },
  { key: "souvenirs", label: "伴手禮" },
  { key: "gear", label: "裝備" },
];

export const TRIP_TAB_KEYS = TRIP_TABS.map((t) => t.key);

export const TRIP_TAB_LABEL: Record<string, string> = Object.fromEntries(
  TRIP_TABS.map((t) => [t.key, t.label])
);

/**
 * 這條分享連結實際看得到的分頁。
 *
 * shared_tabs 沒設定過就沿用這趟啟用的分頁 —— 旅程裡關掉的分頁本來就不該從分享連結漏出去；
 * 兩者都沒有（早期建立的旅程）才退回全部，維持既有連結的可見範圍。
 */
export function resolveSharedTabs(
  sharedTabs: string[] | null | undefined,
  enabledTabs: string[] | null | undefined
): string[] {
  const chosen = sharedTabs?.length ? sharedTabs : enabledTabs?.length ? enabledTabs : TRIP_TAB_KEYS;
  return chosen.filter((t) => TRIP_TAB_KEYS.includes(t));
}
