"use client";

import { useState } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col } from "antd";
import dayjs from "dayjs";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AddTripModal({ onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

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
      width={520}
      styles={{ wrapper: { paddingBottom: 32 } }}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="旅程名稱" rules={[{ required: true, message: "請輸入旅程名稱" }]}>
          <Input placeholder="例如：日本春季旅行" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="startDate" label="出發日期">
              <DatePicker style={{ width: "100%" }} placeholder="選擇日期" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label="結束日期">
              <DatePicker style={{ width: "100%" }} placeholder="選擇日期" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="countries" label="國家 / 地區">
          <Input placeholder="例如：日本、韓國" />
        </Form.Item>

        <Form.Item name="notes" label="備注">
          <Input.TextArea rows={3} placeholder="這趟旅程的心得或備忘..." />
        </Form.Item>

        <Form.Item
          name="photoAlbumId"
          label="Google Photos 相簿連結"
          extra="在 Google Photos 相簿內點「分享」→「建立連結」取得網址"
        >
          <Input placeholder="https://photos.app.goo.gl/..." />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
          <Button type="primary" htmlType="submit" block loading={saving}>
            儲存旅程
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
