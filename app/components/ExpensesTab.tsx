"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Form, Input, DatePicker, Select, InputNumber, Popconfirm, Space, Typography, Tag, Tabs, Skeleton } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

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
}

interface CurrencyOption {
  value: string;
  label: string;
}

const EXPENSE_CATEGORIES = [
  { value: "transport", label: "🚗 交通" },
  { value: "hotel", label: "🏨 住宿" },
  { value: "food", label: "🍜 餐飲" },
  { value: "attraction", label: "🎡 景點" },
  { value: "shopping", label: "🛍️ 購物" },
  { value: "activity", label: "🏄 活動" },
  { value: "other", label: "📌 其他" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

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
  { value: "TWD", label: "TWD - New Taiwan Dollar" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "KRW", label: "KRW - South Korean Won" },
  { value: "HKD", label: "HKD - Hong Kong Dollar" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "THB", label: "THB - Thai Baht" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "MYR", label: "MYR - Malaysian Ringgit" },
];

export default function ExpensesTab({ tripId, people, currency }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>(FALLBACK_CURRENCIES);

  useEffect(() => {
    fetch("https://openexchangerates.org/api/currencies.json")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setCurrencyOptions(
          Object.entries(data).map(([code, name]) => ({ value: code, label: `${code} - ${name}` }))
        );
      })
      .catch(() => {});
  }, []);

  async function fetchExpenses() {
    setLoading(true);
    const res = await fetch(`/api/expenses?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses);
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
      await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingExpense.id, ...payload }),
      });
    } else {
      await fetch("/api/expenses", {
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
    await fetch("/api/expenses", {
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

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const { balances, transactions } = calculateSettlement(expenses, people);

  const listContent = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Typography.Text strong className="text-zinc-100 text-[15px]">費用列表</Typography.Text>
          {expenses.length > 0 && (
            <Typography.Text className="text-zinc-500 text-[13px]">
              共 {currency} {total.toFixed(2)}
            </Typography.Text>
          )}
        </div>
        <Button icon={<PlusOutlined />} size="small" onClick={openAdd}>新增費用</Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-[14px] py-4">
              <Skeleton active paragraph={{ rows: 1, width: "50%" }} title={{ width: "30%" }} />
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-10 pb-8 bg-[#111113] border border-dashed border-[#27272a] rounded-xl">
          <span className="text-4xl">💸</span>
          <Typography.Text className="text-zinc-600 text-sm">還沒有費用記錄</Typography.Text>
          <Button size="small" icon={<PlusOutlined />} onClick={openAdd} className="mt-1">
            新增第一筆費用
          </Button>
        </div>
      ) : (
        expenses.map((exp) => (
          <div key={exp.id} className="bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl px-[14px] py-3 mb-2">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Typography.Text strong className="text-zinc-100 text-sm">{exp.description}</Typography.Text>
                  {exp.category && (
                    <Tag className="!rounded-md !m-0 !text-xs">
                      {CATEGORY_MAP[exp.category] ?? exp.category}
                    </Tag>
                  )}
                  {exp.date && (
                    <span className="text-zinc-600 text-xs">{exp.date}</span>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap items-center">
                  <Typography.Text strong className="text-blue-400 text-[15px]">
                    {exp.currency} {Number(exp.amount).toFixed(2)}
                  </Typography.Text>
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
              <Space size={2} className="shrink-0 ml-2">
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(exp)} />
                <Popconfirm
                  title="確定刪除這筆費用？"
                  onConfirm={() => handleDelete(exp.id)}
                  okText="刪除" cancelText="取消" okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          </div>
        ))
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
                  <span className="text-red-400 font-semibold">{t.from}</span>
                  <span className="text-zinc-500"> 付給 </span>
                  <span className="text-green-400 font-semibold">{t.to}</span>
                  <span className="text-zinc-500">：</span>
                  <span className="text-blue-400 font-semibold">{currency} {t.amount.toFixed(2)}</span>
                </div>
              ))}
            </>
          ) : (
            expenses.length > 0 && (
              <div className="text-green-400 text-center py-6 text-[15px]">
                大家都平了 🎉
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
        defaultActiveKey="list"
        items={[
          { key: "list", label: "費用列表", children: listContent },
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
              <InputNumber className="w-full" min={0} precision={2} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="currency" label="貨幣" className="w-40">
              <Select
                showSearch
                placeholder={currency}
                options={currencyOptions}
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </div>
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
          <Form.Item name="notes" label="備注">
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
