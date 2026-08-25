"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Button, Modal, Form, Input, DatePicker, Select, InputNumber,
  Typography, Tabs, Skeleton, Switch, App, Popover,
} from "antd";
import { EditOutlined, DeleteOutlined, CheckOutlined, CameraOutlined } from "@ant-design/icons";
import { PlusIcon, CoinIcon, CategoryBadge } from "@/app/components/Icons";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";
import {
  PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Expense {
  id: string;
  trip_id: string;
  date: string | null;
  end_date: string | null;
  category: string | null;
  description: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  split_with: string[];
  notes: string | null;
  created_at: string;
}

interface Props {
  tripId: string;
  people: string[];
  currency: string;
  currencies: string[];
  readOnly?: boolean;
  initialExpenses?: Expense[];
  /** 旅程結束日：已結束時子分頁預設進「統計」 */
  tripEndDate?: string | null;
}

const EXPENSE_CATEGORIES = [
  { value: "flight", label: "機票" },
  { value: "transport", label: "交通" },
  { value: "hotel", label: "住宿" },
  { value: "food", label: "餐飲" },
  { value: "attraction", label: "景點" },
  { value: "shopping", label: "購物" },
  { value: "activity", label: "活動" },
  { value: "other", label: "其他" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

const CATEGORY_COLORS: Record<string, string> = {
  flight: "#0ea5e9",
  transport: "#3b82f6",
  hotel: "#8b5cf6",
  food: "#f59e0b",
  attraction: "#10b981",
  shopping: "#ec4899",
  activity: "#f97316",
  other: "#71717a",
};

const PERSON_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#f97316"];

function toBaseCurrency(
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

function calculateSettlement(
  expenses: Expense[],
  people: string[],
  toBase: (amount: number, currency: string) => number
) {
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

  const transactions: { from: string; to: string; amount: number }[] = [];
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

export default function ExpensesTab({ tripId, people, currency, currencies, readOnly, initialExpenses, tripEndDate }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses || []);
  const [form] = Form.useForm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Modal state derived from URL (only when not read-only)
  const urlModal = searchParams.get("modal");
  const urlExpenseId = searchParams.get("expenseId");
  const [forceClosed, setForceClosed] = useState(false);
  const showModal = !readOnly && !forceClosed && (urlModal === "addExpense" || urlModal === "editExpense");
  const editingExpense = useMemo<Expense | null>(() => {
    if (urlModal !== "editExpense" || !urlExpenseId) return null;
    return expenses.find(e => e.id === urlExpenseId) ?? null;
  }, [urlModal, urlExpenseId, expenses]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [paidByFilter, setPaidByFilter] = useState<string[]>([]);
  const [statsCategoryFilter, setStatsCategoryFilter] = useState<string[]>([]);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [statsMemberFilter, setStatsMemberFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [paidTransactions, setPaidTransactions] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string[]>([]);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const continueAfterSave = useRef(false);
  const pushedModalRef = useRef(false);
  const [loadError, setLoadError] = useState(false);

  const { modal, message } = App.useApp();
  const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

  const watchedAmount = Form.useWatch("amount", form);
  const watchedCurrency = Form.useWatch("currency", form);
  const isRange = Form.useWatch("isRange", form);

  const convertedPreview = useMemo(() => {
    if (!watchedAmount || !watchedCurrency || watchedCurrency === currency || !rates) return null;
    return toBaseCurrency(Number(watchedAmount), watchedCurrency, currency, rates);
  }, [watchedAmount, watchedCurrency, currency, rates]);

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((data: { rates: Record<string, number> }) => setRates(data.rates))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const cacheKey = `travel_settlement_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) setPaidTransactions(new Set(JSON.parse(cached)));
    if (cached && Date.now() - Number(localStorage.getItem(`${cacheKey}:ts`) || 0) < 60_000) return;
    fetch(`/api/expenses/settlement?tripId=${tripId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { keys: string[] } | null) => {
        if (data?.keys) {
          setPaidTransactions(new Set(data.keys));
          localStorage.setItem(cacheKey, JSON.stringify(data.keys));
          localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
        }
      })
      .catch(() => { });
  }, [tripId, readOnly]);

  async function fetchExpenses(force = true) {
    const cacheKey = `travel_expenses_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setExpenses(JSON.parse(cached));
      setLoading(false);
    }
    // 60 秒內的快取視為新鮮：切分頁重新掛載時不重打 API
    if (!force && cached && Date.now() - Number(localStorage.getItem(`${cacheKey}:ts`) || 0) < 60_000) {
      setLoading(false);
      return;
    }
    if (!cached) setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/expenses?tripId=${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
        localStorage.setItem(cacheKey, JSON.stringify(data.expenses));
        localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
        setLoadError(false);
      } else if (!cached) {
        setLoadError(true);
      }
    } catch {
      if (!cached) setLoadError(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (initialExpenses) {
      setExpenses(initialExpenses);
      setLoading(false);
    } else {
      fetchExpenses(false);
    }
  }, [tripId, initialExpenses]);

  async function handleReceiptUpload(file: File) {
    setParsingReceipt(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetchWithAuth("/api/parse-receipt", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error ?? "收據解析失敗");
        return;
      }
      const data = await res.json();
      const filled: Record<string, unknown> = {};
      if (data.description) filled.description = data.description;
      if (data.category) filled.category = data.category;
      if (data.amount) filled.amount = Number(data.amount);
      if (data.currency) filled.currency = data.currency;
      if (data.date) filled.date = dayjs(data.date);
      if (data.notes) filled.notes = data.notes;
      form.setFieldsValue(filled);
      message.success("已解析收據，請確認後送出");
    } catch {
      message.error("收據解析失敗，請稍後再試");
    } finally {
      setParsingReceipt(false);
    }
  }

  async function handleSave(values: Record<string, unknown>) {
    const keepOpen = continueAfterSave.current;
    continueAfterSave.current = false;
    setSaving(true);
    let startDate = null;
    let endDate = null;

    if (values.isRange) {
      if (values.startDate) startDate = (values.startDate as dayjs.Dayjs).format("YYYY-MM-DD");
      if (values.endDate) endDate = (values.endDate as dayjs.Dayjs).format("YYYY-MM-DD");
    } else if (values.date) {
      startDate = (values.date as dayjs.Dayjs).format("YYYY-MM-DD");
    }

    const payload = {
      tripId,
      date: startDate || dayjs().format("YYYY-MM-DD"),
      end_date: endDate,
      category: values.category ?? null,
      description: values.description,
      amount: values.amount,
      currency: values.currency ?? currency,
      paid_by: values.paid_by ?? null,
      split_with: values.split_with ?? [],
      notes: values.notes ?? null,
    };

    try {
      const res = editingExpense
        ? await fetchWithAuth("/api/expenses", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingExpense.id, ...payload }),
          })
        : await fetchWithAuth("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        message.error("儲存失敗，請再試一次");
        return;
      }
      message.success(editingExpense ? "已更新費用" : "已新增費用");
      if (values.paid_by) {
        localStorage.setItem(`travel_expense_last_payer_${tripId}`, values.paid_by as string);
      }
      if (!editingExpense && keepOpen) {
        form.resetFields();
        form.setFieldsValue({
          currency: values.currency ?? currency,
          split_with: values.split_with ?? people,
          date: values.date ?? dayjs(),
          startDate: values.startDate ?? dayjs(),
          ...(values.paid_by ? { paid_by: values.paid_by } : {}),
        });
      } else {
        closeModal();
      }
      fetchExpenses();
    } catch {
      message.error("儲存失敗，請檢查網路連線");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const deleted = expenses.find((e) => e.id === id);
    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        message.error("刪除失敗，請再試一次");
        return;
      }
      fetchExpenses();
      if (deleted) {
        const key = `undo-expense-${id}`;
        message.success({
          key,
          duration: 5,
          content: (
            <span>
              已刪除「{deleted.description}」
              <button
                type="button"
                onClick={() => { message.destroy(key); restoreExpense(deleted); }}
                className="ml-2 text-violet-500 font-medium underline cursor-pointer"
              >
                復原
              </button>
            </span>
          ),
        });
      } else {
        message.success("已刪除費用");
      }
    } catch {
      message.error("刪除失敗，請檢查網路連線");
    }
  }

  async function restoreExpense(exp: Expense) {
    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          date: exp.date,
          end_date: exp.end_date,
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          currency: exp.currency,
          paid_by: exp.paid_by,
          split_with: exp.split_with,
          notes: exp.notes,
        }),
      });
      if (!res.ok) throw new Error();
      message.success("已復原");
      fetchExpenses();
    } catch {
      message.error("復原失敗，請再試一次");
    }
  }

  function togglePaid(txKey: string, isPaid: boolean) {
    setPaidTransactions((prev) => {
      const next = new Set(prev);
      if (isPaid) next.delete(txKey); else next.add(txKey);
      return next;
    });
    if (readOnly) return;
    fetchWithAuth("/api/expenses/settlement", {
      method: isPaid ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, pairKey: txKey }),
    })
      .then((res) => { if (!res.ok) throw new Error(); })
      .catch(() => {
        setPaidTransactions((prev) => {
          const next = new Set(prev);
          if (isPaid) next.add(txKey); else next.delete(txKey);
          return next;
        });
        message.error("繳清狀態儲存失敗，請再試一次");
      });
  }

  // Populate form when URL-driven modal opens
  useEffect(() => {
    if (readOnly) return;
    if (urlModal === "addExpense" || urlModal === "editExpense") setForceClosed(false);
    if (urlModal === "editExpense" && editingExpense) {
      form.setFieldsValue({
        isRange: !!editingExpense.end_date,
        date: editingExpense.date && !editingExpense.end_date ? dayjs(editingExpense.date) : null,
        startDate: editingExpense.date ? dayjs(editingExpense.date) : null,
        endDate: editingExpense.end_date ? dayjs(editingExpense.end_date) : null,
        category: editingExpense.category,
        description: editingExpense.description,
        amount: editingExpense.amount,
        currency: editingExpense.currency,
        paid_by: editingExpense.paid_by,
        split_with: editingExpense.split_with,
        notes: editingExpense.notes,
      });
    } else if (urlModal === "addExpense") {
      form.resetFields();
      const lastPayer = localStorage.getItem(`travel_expense_last_payer_${tripId}`);
      form.setFieldsValue({
        currency,
        split_with: people,
        date: dayjs(),
        startDate: dayjs(),
        ...(lastPayer && people.includes(lastPayer) ? { paid_by: lastPayer } : {}),
      });
    }
  }, [urlModal, editingExpense?.id]);

  function openEdit(exp: Expense) {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "editExpense");
    p.set("expenseId", exp.id);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function openAdd() {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "addExpense");
    p.delete("expenseId");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function closeModal() {
    if (readOnly) return;
    setForceClosed(true);
    if (pushedModalRef.current) {
      pushedModalRef.current = false;
      router.back();
      return;
    }
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.delete("modal");
    p.delete("expenseId");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const fmtAmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTotal = (n: number) => Math.round(n).toLocaleString("en-US");

  // 個人視角一律以「分攤份」為口徑：只看他有分攤的費用，金額取 amount / 分攤人數
  const statsBaseExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (statsMemberFilter && !e.split_with.includes(statsMemberFilter)) return false;
      return true;
    });
  }, [expenses, statsMemberFilter]);

  const statsFilteredExpenses = useMemo(() => {
    if (statsCategoryFilter.length === 0) return statsBaseExpenses;
    return statsBaseExpenses.filter(e => statsCategoryFilter.includes(e.category ?? ""));
  }, [statsBaseExpenses, statsCategoryFilter]);

  const convertedTotal = useMemo(
    () => statsFilteredExpenses.reduce((sum, e) => {
      const amount = toBaseCurrency(Number(e.amount), e.currency, currency, rates);
      if (statsMemberFilter) {
        if (!e.split_with.includes(statsMemberFilter) || e.split_with.length === 0) return sum;
        return sum + (amount / e.split_with.length);
      }
      return sum + amount;
    }, 0),
    [statsFilteredExpenses, rates, currency, statsMemberFilter]
  );

  const availableDates = useMemo(
    () => [...new Set(expenses.map(e => e.date).filter(Boolean))].sort() as string[],
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (categoryFilter.length > 0 && !categoryFilter.includes(e.category ?? "")) return false;
      if (paidByFilter.length > 0 && !paidByFilter.includes(e.paid_by ?? "")) return false;
      if (dateFilter.length > 0 && !dateFilter.includes(e.date ?? "")) return false;
      return true;
    });
  }, [expenses, categoryFilter, paidByFilter, dateFilter]);

  const usedPaidBy = useMemo(
    () => [...new Set(expenses.map(e => e.paid_by).filter(Boolean))] as string[],
    [expenses]
  );

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) =>
      sum + toBaseCurrency(Number(e.amount), e.currency, currency, rates), 0),
    [filteredExpenses, rates, currency]
  );

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let valA: any, valB: any;

      if (sortBy === "amount") {
        valA = toBaseCurrency(Number(a.amount), a.currency, currency, rates);
        valB = toBaseCurrency(Number(b.amount), b.currency, currency, rates);
      } else if (sortBy === "date") {
        valA = a.date || "";
        valB = b.date || "";
      } else {
        // created_at
        valA = a.created_at || "";
        valB = b.created_at || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredExpenses, sortBy, sortOrder, rates, currency]);

  const usedCategories = useMemo(
    () => [...new Set(expenses.map((e) => e.category).filter(Boolean))] as string[],
    [expenses]
  );

  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    statsBaseExpenses.forEach((e) => {
      const amount = toBaseCurrency(Number(e.amount), e.currency, currency, rates);
      let share = amount;
      if (statsMemberFilter) {
        if (!e.split_with.includes(statsMemberFilter)) return;
        share = amount / e.split_with.length;
      }

      const key = e.category ?? "other";
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += share;
      map[key].count += 1;
    });
    return Object.entries(map)
      .map(([cat, { total, count }]) => ({
        category: cat,
        label: CATEGORY_MAP[cat] ?? cat,
        total,
        count,
        color: CATEGORY_COLORS[cat] ?? "#71717a",
      }))
      .sort((a, b) => b.total - a.total);
  }, [statsBaseExpenses, rates, currency, statsMemberFilter]);

  const dailyStats = useMemo(() => {
    const map: Record<string, number> = {};
    statsFilteredExpenses.forEach((e) => {
      if (!e.date) return;
      const amount = toBaseCurrency(Number(e.amount), e.currency, currency, rates);
      let share = amount;
      if (statsMemberFilter) {
        if (!e.split_with.includes(statsMemberFilter)) return;
        share = amount / e.split_with.length;
      }

      if (e.end_date) {
        const start = dayjs(e.date);
        const end = dayjs(e.end_date);
        const days = end.diff(start, "day") + 1;
        if (days > 0) {
          const dailyAmount = share / days;
          for (let i = 0; i < days; i++) {
            const d = start.add(i, "day").format("YYYY-MM-DD");
            map[d] = (map[d] ?? 0) + dailyAmount;
          }
        }
      } else {
        map[e.date] = (map[e.date] ?? 0) + share;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date: dayjs(date).format("MM/DD"),
        total: Math.round(total * 100) / 100,
      }));
  }, [statsFilteredExpenses, rates, currency, statsMemberFilter]);

  const personStats = useMemo(() => {
    const map: Record<string, number> = {};
    people.forEach((p) => { map[p] = 0; });
    statsFilteredExpenses.forEach((e) => {
      if (!e.split_with || e.split_with.length === 0) return;
      const share = toBaseCurrency(Number(e.amount), e.currency, currency, rates) / e.split_with.length;
      e.split_with.forEach((p) => {
        if (map[p] === undefined) map[p] = 0;
        map[p] += share;
      });
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [statsFilteredExpenses, rates, currency, people]);

  const { balances, transactions } = useMemo(
    () => calculateSettlement(expenses, people, (amt, cur) => toBaseCurrency(amt, cur, currency, rates)),
    [expenses, people, currency, rates]
  );
  const settlementNeedsRates = !rates && expenses.some((e) => e.currency !== currency);

  const listContent = (
    <>
      <div className="my-4 flex items-center justify-between">
        {/* Sort Controls */}
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-full px-2 h-7">
          <Select
            variant="borderless"
            size="small"
            value={sortBy}
            onChange={setSortBy}
            className="text-[11px] !w-[100px] opacity-80"
            options={[
              { value: "created_at", label: "新增時間" },
              { value: "date", label: "消費日期" },
              { value: "amount", label: "金額" },
            ]}
          />
          <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            aria-label={sortOrder === "asc" ? "改為降冪排序" : "改為升冪排序"}
            className="relative w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer after:absolute after:-inset-3 after:content-['']"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
        {!readOnly && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <PlusIcon size={12} />
            新增費用
          </button>
        )}
      </div>

      {availableDates.length > 0 && (() => {
        const VISIBLE = 5;
        const visibleDates = availableDates.slice(0, VISIBLE);
        const overflowDates = availableDates.slice(VISIBLE);
        const chipClass = (isActive: boolean) =>
          `h-7 px-3 rounded-full text-[12px] font-medium transition-all duration-150 border cursor-pointer ${isActive
            ? "bg-white/[0.1] border-white/20 text-zinc-100"
            : "bg-transparent border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:border-white/15"
          }`;
        const toggleDate = (date: string) =>
          setDateFilter(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
          );
        return (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {visibleDates.map((date) => (
              <button key={date} onClick={() => toggleDate(date)} className={chipClass(dateFilter.includes(date))}>
                {dayjs(date).format("M/D")}
              </button>
            ))}
            {(overflowDates.length > 0 || dateFilter.length > 0) && (
              <Popover
                trigger="click"
                placement="bottomLeft"
                content={
                  <div className="flex flex-wrap gap-1.5 max-w-[240px] p-1">
                    {overflowDates.map((date) => (
                      <button key={date} onClick={() => toggleDate(date)} className={chipClass(dateFilter.includes(date))}>
                        {dayjs(date).format("M/D")}
                      </button>
                    ))}
                    <button onClick={() => setDateFilter([])} className={chipClass(false)}>
                      取消選擇
                    </button>
                  </div>
                }
              >
                <button className={chipClass(overflowDates.some(d => dateFilter.includes(d)))}>
                  +{overflowDates.length}
                </button>
              </Popover>
            )}
          </div>
        );
      })()}

      <div className="flex gap-2 mb-4">
        <Select
          mode="multiple"
          className="flex-1"
          placeholder="篩選類別"
          allowClear
          value={categoryFilter}
          onChange={(vals: string[]) =>
            setCategoryFilter(vals.includes("__all__") ? usedCategories : vals)
          }
          options={[
            { value: "__all__", label: "全選" },
            ...usedCategories.map(c => ({ value: c, label: CATEGORY_MAP[c] ?? c })),
          ]}
          maxTagCount="responsive"
        />
        {usedPaidBy.length > 0 && (
          <Select
            mode="multiple"
            className="flex-1"
            placeholder="篩選付款人"
            allowClear
            value={paidByFilter}
            onChange={(vals: string[]) =>
              setPaidByFilter(vals.includes("__all__") ? usedPaidBy : vals)
            }
            options={[...usedPaidBy.map(p => ({ value: p, label: p }))]}
            maxTagCount="responsive"
          />
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-[14px] py-4">
              <Skeleton active paragraph={{ rows: 1, width: "50%" }} title={{ width: "30%" }} />
            </div>
          ))}
        </div>
      ) : loadError && expenses.length === 0 ? (
        <div className="text-center py-14 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="text-zinc-300 text-sm font-medium mb-1">費用載入失敗</div>
          <div className="text-zinc-500 text-xs mb-4">請檢查網路連線後重試</div>
          <button
            onClick={() => fetchExpenses()}
            className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-4 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            重新載入
          </button>
        </div>
      ) : expenses.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-12 pb-10 rounded-2xl border border-white/[0.06]"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(20,184,166,0.06) 0%, transparent 65%), rgba(9,9,11,0.6)' }}
        >
          <div
            className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center"
            style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.18)' }}
          >
            <CoinIcon size={26} stroke="#14b8a6" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Typography.Text className="text-zinc-300 text-sm font-medium">還沒有費用記錄</Typography.Text>
            <Typography.Text className="text-zinc-600 text-xs">掌握每一筆開銷，旅行更安心。</Typography.Text>
          </div>
          {!readOnly && (
            <button
              onClick={openAdd}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
            >
              <PlusIcon size={12} />
              新增第一筆費用
            </button>
          )}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-zinc-400 text-center py-8 text-sm">此條件沒有費用</div>
      ) : (
        <>
          <div className="flex justify-end mb-2">
            <span className="text-zinc-500 text-xs">
              {filteredExpenses.length} 筆{(categoryFilter.length > 0 || paidByFilter.length > 0 || dateFilter.length > 0) ? "（篩選中）" : ""} ≈ <span className="font-money">{currency} {fmtTotal(filteredTotal)}</span>
            </span>
          </div>
          <AnimatePresence initial={false}>
            {sortedExpenses.map((exp) => (
              <motion.div
                key={exp.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-[14px] py-3 mb-2"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Typography.Text strong className="text-zinc-100 text-sm">{exp.description}</Typography.Text>
                      {exp.category && <CategoryBadge category={exp.category} />}
                      {exp.date && (
                        <span className="text-zinc-400 text-xs">
                          {exp.date} {exp.end_date ? `→ ${exp.end_date}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 flex-wrap items-center">
                      <Typography.Text strong className="font-money text-blue-400 text-[15px]">
                        {exp.currency} {fmtAmt(Number(exp.amount))}
                      </Typography.Text>
                      {exp.currency !== currency && rates && (
                        <span className="font-money text-zinc-400 text-xs">
                          ≈ {currency} {fmtTotal(toBaseCurrency(Number(exp.amount), exp.currency, currency, rates))}
                        </span>
                      )}
                      {exp.paid_by && (
                        <span className="text-zinc-500 text-xs">由 {exp.paid_by} 付款</span>
                      )}
                      {exp.split_with && exp.split_with.length > 0 && (
                        <span className="text-zinc-500 text-xs">分攤：{exp.split_with.join("、")}</span>
                      )}
                    </div>
                    {exp.notes && (
                      <div className="text-zinc-400 text-xs mt-1">{exp.notes}</div>
                    )}
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      <button
                        aria-label="編輯費用"
                        onClick={() => openEdit(exp)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        <EditOutlined style={{ fontSize: 13 }} />
                      </button>
                      <button
                        aria-label="刪除費用"
                        onClick={() => modal.confirm({
                          title: `確定刪除「${exp.description}」？`,
                          okText: "刪除", okType: "danger", cancelText: "取消",
                          onOk: () => handleDelete(exp.id),
                        })}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <DeleteOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </>
      )}
    </>
  );

  const addButton = !readOnly && (
    <button
      onClick={openAdd}
      className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
    >
      <PlusIcon size={12} />
      新增費用
    </button>
  );

  const statsContent = (
    <>
      <div className="flex justify-between items-center my-4 gap-2">
        {addButton || <span />}
        <Select
          className="w-36"
          placeholder="視角：所有人"
          allowClear
          value={statsMemberFilter}
          onChange={setStatsMemberFilter}
          options={people.map(p => ({ value: p, label: p }))}
        />
      </div>

      {expenses.length === 0 ? (
        <div className="text-zinc-400 text-center py-12 text-sm">新增費用後才能查看統計</div>
      ) : (
        <>
          {/* Total card */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4 mb-4 flex items-center justify-between">
            <div>
              <div className="text-zinc-500 text-xs mb-1">
                總花費{(statsCategoryFilter.length > 0 || statsMemberFilter) ? "（篩選中）" : ""}
              </div>
              <div className="text-[26px] font-bold text-zinc-100 leading-none">
                <span className="font-money">{currency} {fmtTotal(convertedTotal)}</span>
              </div>
            </div>
            <div className="text-zinc-400 text-[11px] text-right leading-relaxed">
              {rates ? <>已換算為 {currency}<br />匯率即時更新</> : "載入匯率中..."}
            </div>
          </div>

          {/* Pie + category cards */}
          <div className="flex gap-3 mb-4 items-stretch">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 hidden md:flex flex-col items-center justify-center md:w-[400px] flex-shrink-0">
              <div className="text-zinc-500 text-[11px] mb-2 self-start">類別佔比</div>
              <div className="w-full h-[110px] md:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      cx="50%"
                      cy="50%"
                      innerRadius="38%"
                      outerRadius="68%"
                      dataKey="total"
                      nameKey="label"
                      strokeWidth={0}
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
                            <div className="font-semibold text-zinc-200 mb-0.5">{payload[0].name}</div>
                            <div className="font-money text-blue-400">{currency} {Number(payload[0].value).toFixed(0)}</div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {(() => {
                const pieTotal = categoryStats.reduce((s, c) => s + c.total, 0);
                const anySelected = statsCategoryFilter.length > 0;
                return (
                  <>
                    {/* 單一堆疊比例條：一眼看出佔比 */}
                    <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-white/[0.05]">
                      {categoryStats.map((cat) => {
                        const pct = pieTotal > 0 ? (cat.total / pieTotal) * 100 : 0;
                        const dimmed = anySelected && !statsCategoryFilter.includes(cat.category);
                        return (
                          <div
                            key={cat.category}
                            className="h-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: cat.color, opacity: dimmed ? 0.25 : 0.9 }}
                          />
                        );
                      })}
                    </div>
                    {/* 類別卡：兩欄緊湊排列 */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {categoryStats.map((cat) => {
                        const isSelected = statsCategoryFilter.includes(cat.category);
                        const pct = pieTotal > 0 ? Math.round((cat.total / pieTotal) * 100) : 0;
                        return (
                          <button
                            key={cat.category}
                            onClick={() => setStatsCategoryFilter(prev =>
                              prev.includes(cat.category) ? prev.filter(c => c !== cat.category) : [...prev, cat.category]
                            )}
                            className={`rounded-[12px] px-2.5 py-2 cursor-pointer transition-all text-left border ${isSelected
                              ? "bg-white/[0.06]"
                              : anySelected
                                ? "bg-white/[0.02] border-white/[0.05] opacity-40"
                                : "bg-white/[0.03] border-white/[0.07]"
                              }`}
                            style={isSelected ? { borderColor: `${cat.color}70` } : undefined}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-zinc-300 text-xs font-medium truncate flex-1">{cat.label}</span>
                              <span className="text-zinc-400 text-[10px] shrink-0">{pct}%</span>
                            </div>
                            <div className="font-money text-zinc-200 text-xs font-semibold mt-1">{currency} {fmtTotal(cat.total)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Daily bar chart */}
          {dailyStats.length > 1 && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 mb-4">
              <div className="text-zinc-500 text-[11px] mb-3">每日消費</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyStats} margin={{ top: 0, right: 4, left: -16, bottom: 0 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
                          <div className="text-zinc-400 mb-0.5">{label}</div>
                          <div className="font-money font-semibold text-blue-400">{currency} {fmtTotal(Number(payload[0].value))}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[5, 5, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-person spending */}
          {people.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 mb-4">
              <div className="text-zinc-500 text-[11px] mb-3">每人花費</div>
              {personStats.map((p, i) => {
                const pct = convertedTotal > 0 ? p.total / convertedTotal : 0;
                return (
                  <div key={p.name} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-zinc-300 text-xs font-medium">{p.name}</span>
                      <span className="font-money text-zinc-200 text-xs font-semibold">{currency} {fmtTotal(p.total)}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct * 100}%`,
                          backgroundColor: PERSON_COLORS[i % PERSON_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filtered expense items */}
          <div>
            <div className="text-zinc-500 text-[11px] mb-2">
              費用明細（{statsFilteredExpenses.length} 筆）
            </div>
            {statsFilteredExpenses
              .slice()
              .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
              .map(exp => {
                const converted = toBaseCurrency(Number(exp.amount), exp.currency, currency, rates);
                return (
                  <div key={exp.id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-zinc-200 text-sm font-medium">{exp.description}</span>
                        {exp.category && <CategoryBadge category={exp.category} />}
                      </div>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        {exp.date && <span className="text-zinc-400 text-[11px]">{exp.date}</span>}
                        {exp.paid_by && <span className="text-zinc-400 text-[11px]">{exp.paid_by} 付</span>}
                        {exp.split_with?.length > 0 && (
                          <span className="text-zinc-400 text-[11px]">{exp.split_with.join("、")} 分攤</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-money text-blue-400 text-sm font-semibold">{exp.currency} {fmtAmt(Number(exp.amount))}</div>
                      {exp.currency !== currency && rates && (
                        <div className="text-zinc-400 text-[11px]">≈ {currency} {fmtTotal(converted)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </>
  );

  const settlementContent = (
    <>
      <div className="flex justify-between items-center my-4 gap-2">
        <Typography.Text strong className="text-zinc-100 text-[15px]">
          結算
        </Typography.Text>
        {addButton}
      </div>
      {people.length === 0 ? (
        <div className="text-zinc-400 text-center py-8">
          請先在旅程編輯中加入分帳成員
        </div>
      ) : settlementNeedsRates ? (
        <div className="text-zinc-400 text-center py-8">
          匯率載入中，稍候即可顯示換算後的結算金額…
        </div>
      ) : (
        <>
          <div className="mb-6">
            <Typography.Text className="text-zinc-500 text-[13px] block mb-2.5">
              各人餘額
            </Typography.Text>
            {people.map((p) => {
              const bal = balances[p] ?? 0;
              return (
                <div key={p} className="flex justify-between items-center py-2 border-b border-[#27272a]">
                  <Typography.Text className="text-zinc-200">{p}</Typography.Text>
                  <Typography.Text className={`font-semibold ${bal >= 0 ? "text-green-400" : "text-red-400"}`}>
                    <span className="font-money">{bal >= 0 ? "+" : ""}{bal.toFixed(2)} {currency}</span>
                  </Typography.Text>
                </div>
              );
            })}
          </div>

          {transactions.length > 0 ? (
            <>
              <Typography.Text className="text-zinc-500 text-[13px] block mb-2.5">
                應付款項
              </Typography.Text>
              {transactions.map((t, i) => {
                // key 含金額：結算金額一變，舊的繳清標記自動失效，不會誤導
                const txKey = `${t.from}→${t.to}:${t.amount.toFixed(2)}`;
                const isPaid = paidTransactions.has(txKey);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between bg-[#18181b] border rounded-[10px] px-[14px] py-2.5 mb-2 transition-all duration-200 ${isPaid ? "border-green-900/40 opacity-40" : "border-[#27272a]"}`}
                  >
                    <span className={isPaid ? "line-through" : ""}>
                      <span className="text-blue-400 font-semibold">{t.from}</span>
                      <span className="text-zinc-500"> 付給 </span>
                      <span className="text-teal-400 font-semibold">{t.to}</span>
                      <span className="text-zinc-500">：</span>
                      <span className="font-money text-violet-400 font-semibold">{currency} {t.amount.toFixed(2)}</span>
                    </span>
                    <button
                      aria-label={isPaid ? "取消繳清標記" : "標記為已繳清"}
                      onClick={() => togglePaid(txKey, isPaid)}
                      className={`relative ml-3 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer after:absolute after:-inset-2.5 after:content-[''] ${isPaid ? "bg-green-500/20 border-green-500/50 text-green-400" : "border-zinc-600 text-zinc-600 hover:border-zinc-400 hover:text-zinc-300"}`}
                    >
                      {isPaid && <CheckOutlined style={{ fontSize: 11 }} />}
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            expenses.length > 0 && (
              <div className="text-green-400 text-center py-6 text-[15px]">
                大家都平了
              </div>
            )
          )}
        </>
      )}
    </>
  );

  return (
    <>
      <Tabs
        className="expenses-tabs"
        defaultActiveKey={tripEndDate && dayjs().format("YYYY-MM-DD") > tripEndDate ? "stats" : "list"}
        renderTabBar={(props, DefaultTabBar) => (
          <div className="sticky top-[64px] z-30 bg-[#09090b]/60 backdrop-blur-md pt-1 md:bg-transparent md:backdrop-blur-none md:relative md:top-0 md:z-0">
            <DefaultTabBar {...props} style={{ marginBottom: 0 }} />
          </div>
        )}
        items={[
          { key: "list", label: "費用列表", children: listContent },
          { key: "stats", label: "統計", children: statsContent },
          { key: "settlement", label: "結算", children: settlementContent },
        ]}
      />

      <Modal
        title={editingExpense ? "編輯費用" : "新增費用"}
        afterClose={() => form.resetFields()}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={480}
        centered={true}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4" disabled={saving || parsingReceipt}>
          {!editingExpense && (
            <>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden!"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReceiptUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                icon={<CameraOutlined />}
                onClick={() => receiptInputRef.current?.click()}
                loading={parsingReceipt}
                disabled={parsingReceipt}
                className="w-full mb-4"
              >
                {parsingReceipt ? "AI 解析收據中…" : "拍照 / 上傳收據自動填入"}
              </Button>
            </>
          )}
          <Form.Item name="description" label="費用名稱" rules={[{ required: true, message: "請輸入費用名稱" }]}>
            <Input placeholder="例如：晚餐" />
          </Form.Item>
          <Form.Item name="category" label="類型">
            <Select placeholder="選擇類型" allowClear options={EXPENSE_CATEGORIES} />
          </Form.Item>
          <div className="flex items-center justify-between mb-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <div className="flex flex-col">
              <span className="text-zinc-200 text-sm font-medium">跨日費用分攤</span>
              <span className="text-zinc-500 text-[11px]">將金額平均分配到選中的每一天</span>
            </div>
            <Form.Item name="isRange" valuePropName="checked" noStyle>
              <Switch checkedChildren="ON" unCheckedChildren="OFF" />
            </Form.Item>
          </div>

          {!isRange ? (
            <Form.Item name="date" label="日期">
              <DatePicker className="w-full" />
            </Form.Item>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="startDate" label="開始日期" rules={[{ required: true, message: "請選擇" }]}>
                <DatePicker className="w-full" placeholder="開始" />
              </Form.Item>
              <Form.Item name="endDate" label="結束日期" rules={[{ required: true, message: "請選擇" }]}>
                <DatePicker className="w-full" placeholder="結束" />
              </Form.Item>
            </div>
          )}
          <div className="flex gap-3">
            <Form.Item
              name="amount"
              label="金額"
              rules={[{ required: true, message: "請輸入金額" }]}
              className="flex-1"
            >
              <InputNumber min={0} precision={2} placeholder="0.00" inputMode="decimal" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="currency" label="貨幣" className="w-40">
              <Select
                placeholder={currency}
                options={currencyOptions}
              />
            </Form.Item>
          </div>
          {convertedPreview !== null && (
            <div className="text-zinc-500 text-xs -mt-2 mb-3 pl-1">
              ≈ {currency} {convertedPreview.toFixed(2)}
            </div>
          )}
          {people.length > 0 && (
            <>
              <Form.Item name="paid_by" label="付款人">
                <Select
                  placeholder="選擇付款人"
                  allowClear
                  options={people.map((p) => ({ value: p, label: p }))}
                />
              </Form.Item>
              <Form.Item name="split_with" label="分攤成員">
                <Select
                  mode="multiple"
                  placeholder="選擇分攤成員"
                  options={people.map((p) => ({ value: p, label: p }))}
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item className="!mb-0 !mt-2">
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" block loading={saving}>
                {editingExpense ? "儲存變更" : "新增費用"}
              </Button>
              {!editingExpense && (
                <Button
                  block
                  loading={saving}
                  onClick={() => { continueAfterSave.current = true; form.submit(); }}
                >
                  儲存並繼續
                </Button>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
