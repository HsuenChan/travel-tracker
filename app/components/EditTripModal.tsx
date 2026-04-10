"use client";

import { useState } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col } from "antd";
import dayjs from "dayjs";

interface Trip {
  ID: string;
  Name: string;
  "Start Date": string;
  "End Date": string;
  Countries: string;
  Notes: string;
  "Photo Album ID": string;
}

interface Props {
  trip: Trip;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditTripModal({ trip, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/sheets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: trip.ID,
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
    <Modal title="編輯旅程" open onCancel={onClose} footer={null} width={520} styles={{ wrapper: { paddingBottom: 32 } }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
        initialValues={{
          name: trip.Name,
          startDate: trip["Start Date"] ? dayjs(trip["Start Date"]) : null,
          endDate: trip["End Date"] ? dayjs(trip["End Date"]) : null,
          countries: trip.Countries,
          notes: trip.Notes,
          photoAlbumId: trip["Photo Album ID"],
        }}
      >
        <Form.Item name="name" label="旅程名稱" rules={[{ required: true, message: "請輸入旅程名稱" }]}>
          <Input />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="startDate" label="出發日期">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label="結束日期">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="countries" label="國家 / 地區">
          <Input placeholder="例如：日本、韓國" />
        </Form.Item>

        <Form.Item name="notes" label="備注">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item name="photoAlbumId" label="Google Photos 相簿連結">
          <Input placeholder="https://photos.app.goo.gl/..." />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
          <Button type="primary" htmlType="submit" block loading={saving}>
            儲存變更
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
