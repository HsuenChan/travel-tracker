"use client";

import { useState } from "react";
import { Modal, Form, Input, Select, DatePicker, TimePicker, Button, Row, Col, AutoComplete } from "antd";
import { AIRPORT_COORDS } from "@/lib/airports";
import { TRANSPORT_OPTIONS, toTransportKey } from "@/lib/transport";
import dayjs from "dayjs";

const AIRPORT_OPTIONS = Object.entries(AIRPORT_COORDS).map(([iata, info]) => ({
  value: iata,
  label: `${iata} — ${info.city}`,
}));

interface Segment {
  ID: string;
  "Trip ID": string;
  Order: string;
  From: string;
  "From IATA": string;
  To: string;
  "To IATA": string;
  Type: string;
  Date: string;
  Time: string;
  "Flight No": string;
  Aircraft: string;
}

interface Props {
  segment: Segment;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditSegmentModal({ segment, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState(segment.Type || "飛機");

  async function handleSubmit(values: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/segments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: segment.ID,
        from: values.from,
        fromIata: (values.fromIata as string) ?? "",
        to: values.to,
        toIata: (values.toIata as string) ?? "",
        type: values.type,
        date: values.date ? (values.date as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        time: values.time ? (values.time as typeof dayjs.prototype).format("HH:mm") : "",
        flightNo: values.flightNo ?? "",
        aircraft: values.aircraft ?? "",
      }),
    });
    setSaving(false);
    onSaved();
  }

  const initialValues = {
    type: segment.Type || "飛機",
    from: segment.From,
    fromIata: segment["From IATA"],
    to: segment.To,
    toIata: segment["To IATA"],
    date: segment.Date ? dayjs(segment.Date) : undefined,
    time: segment.Time ? dayjs(segment.Time, "HH:mm") : undefined,
    flightNo: segment["Flight No"],
    aircraft: segment.Aircraft,
  };

  return (
    <Modal title="編輯交通段落" open onCancel={onClose} footer={null} width={540} styles={{ wrapper: { paddingBottom: 32 } }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={initialValues}
        style={{ marginTop: 16 }}
      >
        <Form.Item name="type" label="交通方式">
          <Select options={TRANSPORT_OPTIONS} onChange={setType} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="from" label="出發地" rules={[{ required: true, message: "請輸入出發地" }]}>
              <Input placeholder="例如：台北、台北松山" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="to" label="目的地" rules={[{ required: true, message: "請輸入目的地" }]}>
              <Input placeholder="例如：伊斯坦堡" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="fromIata" label="出發機場 IATA">
              <AutoComplete
                options={AIRPORT_OPTIONS}
                filterOption={(input, option) =>
                  option?.value.toLowerCase().includes(input.toLowerCase()) ||
                  (option?.label as string).toLowerCase().includes(input.toLowerCase())
                }
                placeholder="例如：TSA"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="toIata" label="抵達機場 IATA">
              <AutoComplete
                options={AIRPORT_OPTIONS}
                filterOption={(input, option) =>
                  option?.value.toLowerCase().includes(input.toLowerCase()) ||
                  (option?.label as string).toLowerCase().includes(input.toLowerCase())
                }
                placeholder="例如：IST"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="date" label="出發日期">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="time" label="出發時間">
              <TimePicker style={{ width: "100%" }} format="HH:mm" />
            </Form.Item>
          </Col>
        </Row>

        {toTransportKey(type) === "plane" && (
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="flightNo" label="航班號">
                <Input placeholder="例如：CI 061" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="aircraft" label="機型">
                <Input placeholder="例如：A350-900" />
              </Form.Item>
            </Col>
          </Row>
        )}

        {toTransportKey(type) === "train" && (
          <Form.Item name="flightNo" label="車次">
            <Input placeholder="例如：X2000" />
          </Form.Item>
        )}

        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
          <Button type="primary" htmlType="submit" block loading={saving}>
            儲存變更
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
