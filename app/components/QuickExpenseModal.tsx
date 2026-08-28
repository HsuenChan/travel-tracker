"use client";

import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select, Button, App } from "antd";
import dayjs from "dayjs";
import { EXPENSE_CATEGORIES, itineraryCategoryToExpense } from "@/lib/expenseCategories";

interface LinkedItem {
  id: string;
  title: string;
  date: string;
  category: string | null;
}

interface Props {
  open: boolean;
  tripId: string;
  item: LinkedItem | null;
  people: string[];
  currency: string;
  currencies: string[];
  saving: boolean;
  onClose: () => void;
  /** 回傳 true 代表儲存成功（由父層負責 setSaving 與重抓費用） */
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}

export default function QuickExpenseModal({
  open, tripId, item, people, currency, currencies, saving, onClose, onSubmit,
}: Props) {
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    if (!open || !item) return;
    const lastPayer = typeof window !== "undefined"
      ? localStorage.getItem(`travel_expense_last_payer_${tripId}`)
      : null;
    form.resetFields();
    form.setFieldsValue({
      description: item.title,
      category: itineraryCategoryToExpense(item.category),
      currency,
      split_with: people,
      ...(lastPayer && people.includes(lastPayer) ? { paid_by: lastPayer } : {}),
    });
  }, [open, item?.id]);

  async function handleFinish(values: Record<string, unknown>) {
    if (!item) return;
    const ok = await onSubmit({
      tripId,
      itinerary_item_id: item.id,
      date: item.date,
      end_date: null,
      category: values.category ?? null,
      description: values.description,
      amount: values.amount,
      currency: values.currency ?? currency,
      paid_by: values.paid_by ?? null,
      split_with: values.split_with ?? [],
      notes: values.notes ?? null,
    });
    if (!ok) return;
    if (values.paid_by) {
      localStorage.setItem(`travel_expense_last_payer_${tripId}`, values.paid_by as string);
    }
    message.success("已記一筆費用");
    onClose();
  }

  return (
    <Modal
      title="記一筆費用"
      open={open}
      onCancel={onClose}
      afterClose={() => form.resetFields()}
      footer={null}
      width={440}
      centered
    >
      {item && (
        <div className="mt-3 mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5">
          <div className="text-zinc-500 text-[11px] mb-0.5">關聯行程</div>
          <div className="text-zinc-200 text-sm font-medium truncate">{item.title}</div>
          <div className="text-zinc-500 text-[11px] mt-0.5">
            {dayjs(item.date).format("YYYY/MM/DD")} · 費用會記在這一天
          </div>
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={handleFinish} disabled={saving}>
        <Form.Item name="description" label="費用名稱" rules={[{ required: true, message: "請輸入費用名稱" }]}>
          <Input placeholder="例如：門票" />
        </Form.Item>
        <Form.Item name="category" label="類型">
          <Select placeholder="選擇類型" allowClear options={EXPENSE_CATEGORIES} />
        </Form.Item>
        <div className="flex gap-3">
          <Form.Item name="amount" label="金額" rules={[{ required: true, message: "請輸入金額" }]} className="flex-1">
            <InputNumber min={0} precision={2} placeholder="0.00" inputMode="decimal" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="貨幣" className="w-36">
            <Select placeholder={currency} options={currencies.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
        </div>
        {people.length > 0 && (
          <>
            <Form.Item name="paid_by" label="付款人">
              <Select placeholder="選擇付款人" allowClear options={people.map((p) => ({ value: p, label: p }))} />
            </Form.Item>
            <Form.Item name="split_with" label="分攤成員">
              <Select mode="multiple" placeholder="選擇分攤成員" options={people.map((p) => ({ value: p, label: p }))} />
            </Form.Item>
          </>
        )}
        <Form.Item name="notes" label="備註">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item className="!mb-0 !mt-2">
          <Button type="primary" htmlType="submit" block loading={saving}>
            新增費用
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
