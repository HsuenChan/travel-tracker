/** 費用分類：ExpensesTab 與行程內快速記帳共用，避免兩邊定義飄移 */
export const EXPENSE_CATEGORIES = [
  { value: "flight", label: "機票" },
  { value: "transport", label: "交通" },
  { value: "hotel", label: "住宿" },
  { value: "food", label: "餐飲" },
  { value: "attraction", label: "景點" },
  { value: "shopping", label: "購物" },
  { value: "activity", label: "活動" },
  { value: "other", label: "其他" },
];

export const EXPENSE_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  flight: "#0ea5e9",
  transport: "#3b82f6",
  hotel: "#8b5cf6",
  food: "#f59e0b",
  attraction: "#10b981",
  shopping: "#ec4899",
  activity: "#f97316",
  other: "#71717a",
};

/** 行程分類沒有 flight，其餘 value 與費用分類一致，可直接沿用 */
export function itineraryCategoryToExpense(category: string | null): string | null {
  if (!category) return null;
  return EXPENSE_CATEGORY_MAP[category] ? category : null;
}
