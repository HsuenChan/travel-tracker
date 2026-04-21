"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect, useMemo } from "react";
import {
  Button, Modal, Form, Input, DatePicker, Select, InputNumber,
  Dropdown, Typography, Tabs, Skeleton,
} from "antd";
import { EditOutlined, DeleteOutlined, MoreOutlined } from "@ant-design/icons";
import { PlusIcon, CreditCardIcon, CategoryBadge, CategoryIcon } from "@/app/components/Icons";
import dayjs from "dayjs";
import {
  PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Expense {
  id: string;
  trip_id: string;
  date: string | null;
  category: string | null;
  description: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  split_with: string[];
  notes: string | null;
}

interface Props {
  tripId: string;
  people: string[];
  currency: string;
  currencies: string[];
}

interface CurrencyOption {
  value: string;
  label: string;
}

const EXPENSE_CATEGORIES = [
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

function calculateSettlement(expenses: Expense[], people: string[]) {
  const balances: Record<string, number> = {};
  people.forEach((p) => { balances[p] = 0; });

  expenses.forEach((exp) => {
    if (!exp.paid_by || !exp.split_with || exp.split_with.length === 0) return;
    const perPerson = Number(exp.amount) / exp.split_with.length;
    exp.split_with.forEach((p) => {
      if (balances[p] === undefined) balances[p] = 0;
      balances[p] -= perPerson;
    });
    if (balances[exp.paid_by] === undefined) balances[exp.paid_by] = 0;
    balances[exp.paid_by] += Number(exp.amount);
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

const FALLBACK_CURRENCIES: CurrencyOption[] = [
  "TWD", "USD", "EUR", "JPY", "KRW", "HKD", "SGD", "THB", "GBP", "AUD", "CNY", "MYR",
].map((code) => ({ value: code, label: code }));

export default function ExpensesTab({ tripId, people, currency, currencies }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

  const watchedAmount = Form.useWatch("amount", form);
  const watchedCurrency = Form.useWatch("currency", form);

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

  async function fetchExpenses() {
    const cacheKey = `travel_expenses_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setExpenses(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }
    const res = await fetchWithAuth(`/api/expenses?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses);
      localStorage.setItem(cacheKey, JSON.stringify(data.expenses));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchExpenses();
  }, [tripId]);

  async function handleSave(values: Record<string, unknown>) {
    setSaving(true);
    const payload = {
      tripId,
      date: values.date ? (values.date as typeof dayjs.prototype).format("YYYY-MM-DD") : null,
      category: values.category ?? null,
      description: values.description,
      amount: values.amount,
      currency: values.currency ?? currency,
      paid_by: values.paid_by ?? null,
      split_with: values.split_with ?? [],
      notes: values.notes ?? null,
    };

    if (editingExpense) {
      await fetchWithAuth("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingExpense.id, ...payload }),
      });
    } else {
      await fetchWithAuth("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    closeModal();
    fetchExpenses();
  }

  async function handleDelete(id: string) {
    await fetchWithAuth("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchExpenses();
  }

  function openEdit(exp: Expense) {
    setEditingExpense(exp);
    form.setFieldsValue({
      date: exp.date ? dayjs(exp.date) : null,
      category: exp.category,
      description: exp.description,
      amount: exp.amount,
      currency: exp.currency,
      paid_by: exp.paid_by,
      split_with: exp.split_with,
      notes: exp.notes,
    });
    setShowModal(true);
  }

  function openAdd() {
    setEditingExpense(null);
    form.resetFields();
    form.setFieldsValue({ currency, split_with: people });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingExpense(null);
    form.resetFields();
  }

  const convertedTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + toBaseCurrency(Number(e.amount), e.currency, currency, rates), 0),
    [expenses, rates, currency]
  );

  const filteredExpenses = useMemo(
    () => categoryFilter ? expenses.filter((e) => e.category === categoryFilter) : expenses,
    [expenses, categoryFilter]
  );

  const usedCategories = useMemo(
    () => [...new Set(expenses.map((e) => e.category).filter(Boolean))] as string[],
    [expenses]
  );

  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    expenses.forEach((e) => {
      const key = e.category ?? "other";
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += toBaseCurrency(Number(e.amount), e.currency, currency, rates);
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
  }, [expenses, rates, currency]);

  const dailyStats = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      if (!e.date) return;
      map[e.date] = (map[e.date] ?? 0) + toBaseCurrency(Number(e.amount), e.currency, currency, rates);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date: dayjs(date).format("MM/DD"),
        total: Math.round(total * 100) / 100,
      }));
  }, [expenses, rates, currency]);

  const personStats = useMemo(() => {
    const map: Record<string, number> = {};
    people.forEach((p) => { map[p] = 0; });
    expenses.forEach((e) => {
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
  }, [expenses, rates, currency, people]);

  const { balances, transactions } = useMemo(
    () => calculateSettlement(expenses, people),
    [expenses, people]
  );

  const listContent = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Typography.Text strong className="text-zinc-100 text-[15px]">費用列表</Typography.Text>
          {expenses.length > 0 && (
            <Typography.Text className="text-zinc-500 text-[13px]">
              ≈ {currency} {convertedTotal.toFixed(0)}
            </Typography.Text>
          )}
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
        >
          <PlusIcon size={12} />
          新增費用
        </button>
      </div>

      {usedCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer border ${categoryFilter === null
              ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
              : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/20"
              }`}
          >
            全部
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
              className={`h-7 px-2.5 rounded-full text-xs font-medium transition-all cursor-pointer border inline-flex items-center gap-1 ${categoryFilter === cat
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/20"
                }`}
            >
              <CategoryIcon category={cat} size={10} />
              {CATEGORY_MAP[cat] ?? cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-[14px] py-4">
              <Skeleton active paragraph={{ rows: 1, width: "50%" }} title={{ width: "30%" }} />
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-10 pb-8 bg-[#111113] border border-dashed border-[#27272a] rounded-xl">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/[0.07] flex items-center justify-center">
            <CreditCardIcon size={22} stroke="#3f3f46" strokeWidth={1.5} />
          </div>
          <Typography.Text className="text-zinc-600 text-sm">還沒有費用記錄</Typography.Text>
          <button
            onClick={openAdd}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-3 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <PlusIcon size={12} />
            新增第一筆費用
          </button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-zinc-600 text-center py-8 text-sm">此類別沒有費用</div>
      ) : (
        filteredExpenses.map((exp) => (
          <div key={exp.id} className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-[14px] py-3 mb-2">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Typography.Text strong className="text-zinc-100 text-sm">{exp.description}</Typography.Text>
                  {exp.category && <CategoryBadge category={exp.category} />}
                  {exp.date && (
                    <span className="text-zinc-600 text-xs">{exp.date}</span>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap items-center">
                  <Typography.Text strong className="text-blue-400 text-[15px]">
                    {exp.currency} {Number(exp.amount).toFixed(2)}
                  </Typography.Text>
                  {exp.currency !== currency && rates && (
                    <span className="text-zinc-600 text-xs">
                      ≈ {currency} {toBaseCurrency(Number(exp.amount), exp.currency, currency, rates).toFixed(0)}
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
                  <div className="text-zinc-600 text-xs mt-1">{exp.notes}</div>
                )}
              </div>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "edit", icon: <EditOutlined />, label: "編輯", onClick: () => openEdit(exp) },
                    { type: "divider" },
                    {
                      key: "delete", icon: <DeleteOutlined />, label: "刪除", danger: true,
                      onClick: () => Modal.confirm({
                        title: "確定刪除這筆費用？",
                        okText: "刪除", okType: "danger", cancelText: "取消",
                        onOk: () => handleDelete(exp.id),
                      }),
                    },
                  ],
                }}
              >
                <button className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300 transition-colors cursor-pointer shrink-0 ml-1">
                  <MoreOutlined />
                </button>
              </Dropdown>
            </div>
          </div>
        ))
      )}
    </>
  );

  const statsContent = (
    <>
      {expenses.length === 0 ? (
        <div className="text-zinc-600 text-center py-12 text-sm">新增費用後才能查看統計</div>
      ) : (
        <>
          {/* Total card */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4 mb-4 flex items-center justify-between">
            <div>
              <div className="text-zinc-500 text-xs mb-1">總花費</div>
              <div className="text-[26px] font-bold text-zinc-100 leading-none">
                {currency} {convertedTotal.toFixed(0)}
              </div>
            </div>
            <div className="text-zinc-600 text-[11px] text-right leading-relaxed">
              {rates ? <>已換算為 {currency}<br />匯率即時更新</> : "載入匯率中..."}
            </div>
          </div>

          {/* Pie + category cards */}
          <div className="flex gap-3 mb-4 items-stretch">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 flex flex-col items-center justify-center w-[148px] flex-shrink-0">
              <div className="text-zinc-500 text-[11px] mb-2 self-start">類別佔比</div>
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie
                    data={categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
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
                          <div className="text-blue-400">{currency} {Number(payload[0].value).toFixed(0)}</div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
              {categoryStats.map((cat) => (
                <div key={cat.category} className="bg-white/[0.03] border border-white/[0.07] rounded-[12px] px-3 py-2 flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-zinc-300 text-xs font-medium leading-none">{cat.label}</div>
                    <div className="text-zinc-600 text-[10px] mt-0.5">{cat.count} 筆</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-zinc-200 text-xs font-semibold leading-none">{currency} {cat.total.toFixed(0)}</div>
                    <div className="text-zinc-600 text-[10px] mt-0.5">{convertedTotal > 0 ? Math.round((cat.total / convertedTotal) * 100) : 0}%</div>
                  </div>
                </div>
              ))}
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
                          <div className="font-semibold text-blue-400">{currency} {Number(payload[0].value).toFixed(0)}</div>
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
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-zinc-500 text-[11px] mb-3">每人花費</div>
              {personStats.map((p, i) => {
                const pct = convertedTotal > 0 ? p.total / convertedTotal : 0;
                return (
                  <div key={p.name} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-zinc-300 text-xs font-medium">{p.name}</span>
                      <span className="text-zinc-200 text-xs font-semibold">{currency} {p.total.toFixed(0)}</span>
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
        </>
      )}
    </>
  );

  const settlementContent = (
    <>
      <Typography.Text strong className="text-zinc-100 text-[15px] block mb-4">
        結算
      </Typography.Text>
      {people.length === 0 ? (
        <div className="text-zinc-600 text-center py-8">
          請先在旅程編輯中加入分帳成員
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
                    {bal >= 0 ? "+" : ""}{bal.toFixed(2)} {currency}
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
              {transactions.map((t, i) => (
                <div key={i} className="bg-[#18181b] border border-[#27272a] rounded-[10px] px-[14px] py-2.5 mb-2">
                  <span className="text-blue-400 font-semibold">{t.from}</span>
                  <span className="text-zinc-500"> 付給 </span>
                  <span className="text-teal-400 font-semibold">{t.to}</span>
                  <span className="text-zinc-500">：</span>
                  <span className="text-violet-400 font-semibold">{currency} {t.amount.toFixed(2)}</span>
                </div>
              ))}
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
        items={[
          { key: "list", label: "費用列表", children: listContent },
          { key: "stats", label: "統計", children: statsContent },
          { key: "settlement", label: "結算", children: settlementContent },
        ]}
      />

      <Modal
        title={editingExpense ? "編輯費用" : "新增費用"}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={480}
        styles={{ wrapper: { paddingBottom: 32 } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          <Form.Item name="description" label="費用名稱" rules={[{ required: true, message: "請輸入費用名稱" }]}>
            <Input placeholder="例如：晚餐" />
          </Form.Item>
          <Form.Item name="category" label="類型">
            <Select placeholder="選擇類型" allowClear options={EXPENSE_CATEGORIES} />
          </Form.Item>
          <Form.Item name="date" label="日期">
            <DatePicker className="w-full" />
          </Form.Item>
          <div className="flex gap-3">
            <Form.Item
              name="amount"
              label="金額"
              rules={[{ required: true, message: "請輸入金額" }]}
              className="flex-1"
            >
              <InputNumber min={0} precision={2} placeholder="0.00" style={{ width: "100%" }} />
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
            <Button type="primary" htmlType="submit" block loading={saving}>
              {editingExpense ? "儲存變更" : "新增費用"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
