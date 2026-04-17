"use client";

import { useState, useEffect } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col, Select } from "antd";
import dayjs from "dayjs";

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  countries: string;
  notes: string;
  photo_album_id: string;
  people: string[] | null;
  currency: string | null;
}

interface Props {
  trip: Trip;
  onClose: () => void;
  onSaved: () => void;
}

interface CurrencyOption {
  value: string;
  label: string;
}

export default function EditTripModal({ trip, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);

  useEffect(() => {
    fetch("https://openexchangerates.org/api/currencies.json")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const options = Object.entries(data).map(([code, name]) => ({
          value: code,
          label: `${code} - ${name}`,
        }));
        setCurrencyOptions(options);
      })
      .catch(() => {
        setCurrencyOptions([
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
        ]);
      });
  }, []);

  async function handleSubmit(values: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/sheets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: trip.id,
        name: values.name,
        startDate: values.startDate ? (values.startDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        endDate: values.endDate ? (values.endDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        countries: values.countries ?? "",
        notes: values.notes ?? "",
        photoAlbumId: values.photoAlbumId ?? "",
        people: values.people ?? [],
        currency: Array.isArray(values.currency) ? values.currency.join(",") : (values.currency || "TWD"),
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title="編輯旅程"
      open
      onCancel={onClose}
      footer={null}
      width={520}
      styles={{ wrapper: { paddingBottom: 32 } }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="mt-4"
        initialValues={{
          name: trip.name,
          startDate: trip.start_date ? dayjs(trip.start_date) : null,
          endDate: trip.end_date ? dayjs(trip.end_date) : null,
          countries: trip.countries,
          notes: trip.notes,
          photoAlbumId: trip.photo_album_id,
          people: trip.people ?? [],
          currency: trip.currency ? trip.currency.split(",") : ["TWD"],
        }}
      >
        <Form.Item name="name" label="旅程名稱" rules={[{ required: true, message: "請輸入旅程名稱" }]}>
          <Input />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="startDate" label="出發日期">
              <DatePicker className="w-full" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label="結束日期">
              <DatePicker className="w-full" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="countries" label="國家 / 地區">
          <Input placeholder="例如：日本、韓國" />
        </Form.Item>

        <Form.Item name="people" label="分帳成員" extra="輸入名字後按 Enter 加入">
          <Select
            mode="tags"
            placeholder="輸入成員名字，按 Enter 確認"
            tokenSeparators={[","]}
            options={[]}
          />
        </Form.Item>

        <Form.Item name="currency" label="預設貨幣 (可多選)" extra="選擇一個或多個旅程中會用到的貨幣">
          <Select
            mode="multiple"
            showSearch
            placeholder="選擇貨幣"
            options={currencyOptions}
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item name="notes" label="備注">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item
          name="photoAlbumId"
          label="Google Photos 相簿連結"
          extra="請從瀏覽器網址列複製完整連結（非 photos.app.goo.gl 短網址）"
        >
          <Input placeholder="https://photos.google.com/share/... 或 /album/..." />
        </Form.Item>

        <Form.Item className="!mb-0 !mt-2">
          <Button type="primary" htmlType="submit" block loading={saving}>
            儲存變更
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
