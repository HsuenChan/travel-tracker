"use client";

import { useState, useEffect } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col, Select } from "antd";
import dayjs from "dayjs";

import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface CurrencyOption {
  value: string;
  label: string;
}

export default function AddTripModal({ onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  };

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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      title="新增旅程"
      open
      onCancel={onClose}
      footer={null}
      width={600}
      styles={{ wrapper: { paddingBottom: 32 } }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="mt-4 cute-form"
        initialValues={{ currency: ["TWD"] }}
      >
        <Form.Item name="name" label="旅程名稱" rules={[{ required: true, message: "請輸入旅程名稱" }]}>
          <Input placeholder="例如：日本春季旅行" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="startDate" label="出發日期">
              <DatePicker className="w-full" placeholder="選擇日期" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label="結束日期">
              <DatePicker className="w-full" placeholder="選擇日期" />
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
          <ReactQuill
             theme="snow"
             modules={quillModules}
             placeholder="這趟旅程的心得或備忘..."
             className="custom-quill"
           />
        </Form.Item>

        <Form.Item
          name="photoAlbumId"
          label="Google Photos 相簿連結"
          extra="在 Google Photos 相簿內點「分享」→「建立連結」取得網址"
        >
          <Input placeholder="https://photos.app.goo.gl/..." />
        </Form.Item>

        <Form.Item className="!mb-0 !mt-6">
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            loading={saving}
            className="!rounded-full !h-12 !text-base !font-bold bg-linear-to-r from-[#8b5cf6] to-[#d946ef] border-none shadow-[0_8px_25px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-all"
          >
            儲存旅程
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
