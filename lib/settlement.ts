/**
 * 分帳結算。
 *
 * 抽出來給費用分頁與 LINE 推播共用 —— 兩邊各算一次的話，群組裡收到的金額
 * 遲早會和 App 上看到的對不起來，而那是最不能出錯的數字。
 */

export interface SettlementExpense {
  amount: number;
  currency: string;
  paid_by?: string | null;
  split_with?: string[] | null;
}

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
}

/** 匯率表是以 USD 為基準的 rates；拿不到就原值不換 */
export function toBaseCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> | null
): number {
  if (!rates || fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

export function computeSettlement(
  expenses: SettlementExpense[],
  people: string[],
  toBase: (amount: number, currency: string) => number
): { balances: Record<string, number>; transactions: SettlementTransaction[] } {
  const balances: Record<string, number> = {};
  people.forEach((p) => { balances[p] = 0; });

  expenses.forEach((exp) => {
    if (!exp.paid_by || !exp.split_with || exp.split_with.length === 0) return;
    const baseAmount = toBase(Number(exp.amount), exp.currency);
    const perPerson = baseAmount / exp.split_with.length;
    exp.split_with.forEach((p) => {
      if (balances[p] === undefined) balances[p] = 0;
      balances[p] -= perPerson;
    });
    if (balances[exp.paid_by] === undefined) balances[exp.paid_by] = 0;
    balances[exp.paid_by] += baseAmount;
  });

  const cred = Object.entries(balances)
    .filter(([, v]) => v > 0.005)
    .map(([name, amt]) => ({ name, amt }))
    .sort((a, b) => b.amt - a.amt);
  const debt = Object.entries(balances)
    .filter(([, v]) => v < -0.005)
    .map(([name, amt]) => ({ name, amt: -amt }))
    .sort((a, b) => b.amt - a.amt);

  const transactions: SettlementTransaction[] = [];
  let i = 0, j = 0;
  while (i < cred.length && j < debt.length) {
    const transfer = Math.min(cred[i].amt, debt[j].amt);
    transactions.push({ from: debt[j].name, to: cred[i].name, amount: transfer });
    cred[i].amt -= transfer;
    debt[j].amt -= transfer;
    if (cred[i].amt < 0.005) i++;
    if (debt[j].amt < 0.005) j++;
  }

  return { balances, transactions };
}

/** 結算列的去重鍵，和費用分頁的繳清標記共用同一個格式 */
export function settlementPairKey(t: SettlementTransaction): string {
  return `${t.from}→${t.to}:${t.amount.toFixed(2)}`;
}

/** 伺服器端取匯率；拿不到就回 null，換算會退回原幣別的數字 */
export async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.rates as Record<string, number>) ?? null;
  } catch {
    return null;
  }
}
