"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

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
  id: string;
  trip_id: string;
  order: number;
  from_city: string;
  from_iata: string;
  to_city: string;
  to_iata: string;
  type: string;
  date: string;
  time: string;
  arrival_date: string | null;
  arrival_time: string | null;
  flight_no: string;
  aircraft: string;
}

interface Props {
  segment: Segment;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditSegmentModal({ segment, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState(segment.type || "飛機");

  async function handleSubmit(values: Record<string, unknown>) {
    setSaving(true);
    await fetchWithAuth("/api/segments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: segment.id,
        from: values.from,
        fromIata: (values.fromIata as string) ?? "",
        to: values.to,
        toIata: (values.toIata as string) ?? "",
        type: values.type,
        date: values.date ? (values.date as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        time: values.time ? (values.time as typeof dayjs.prototype).format("HH:mm") : "",
        arrivalDate: values.arrivalDate ? (values.arrivalDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        arrivalTime: values.arrivalTime ? (values.arrivalTime as typeof dayjs.prototype).format("HH:mm") : "",
        flightNo: values.flightNo ?? "",
        aircraft: values.aircraft ?? "",
      }),
    });
    setSaving(false);
    onSaved();
  }

  const initialValues = {
    type: segment.type || "飛機",
    from: segment.from_city,
    fromIata: segment.from_iata,
    to: segment.to_city,
    toIata: segment.to_iata,
    date: segment.date ? dayjs(segment.date) : undefined,
    time: segment.time ? dayjs(segment.time, "HH:mm") : undefined,
    arrivalDate: segment.arrival_date ? dayjs(segment.arrival_date) : undefined,
    arrivalTime: segment.arrival_time ? dayjs(segment.arrival_time, "HH:mm") : undefined,
    flightNo: segment.flight_no,
    aircraft: segment.aircraft,
  };

  return (
    <Modal
      title="編輯交通段落"
      open={true}
      onCancel={onClose}
      footer={null}
      width={540}
      centered={true}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={initialValues}
        className="mt-4"
      >
        <Form.Item name="type" label="交通方式">
          <Select options={TRANSPORT_OPTIONS} onChange={setType} />
        </Form.Item>

        {/* Departure block */}
        <div className="border border-blue-500/30 rounded-xl px-3 pt-3 pb-1 mb-2">
          <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">出發</div>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="from" label="城市" rules={[{ required: true, message: "請輸入出發地" }]}>
                <Input placeholder="例如：台北、台北松山" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="fromIata" label="機場 IATA">
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
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="date" label="日期">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="time" label="時間">
                <TimePicker className="w-full" format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Arrow separator */}
        <div className="flex items-center justify-center text-zinc-600 text-lg my-1 select-none">↓</div>

        {/* Arrival block */}
        <div className="border border-violet-500/30 rounded-xl px-3 pt-3 pb-1 mb-3">
          <div className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider mb-2">抵達</div>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="to" label="城市" rules={[{ required: true, message: "請輸入目的地" }]}>
                <Input placeholder="例如：伊斯坦堡" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="toIata" label="機場 IATA">
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
            <Col span={14}>
              <Form.Item name="arrivalDate" label="日期">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="arrivalTime" label="時間（當地）">
                <TimePicker className="w-full" format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
        </div>

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

        <Form.Item className="!mb-0 !mt-2">
          <Button type="primary" htmlType="submit" block loading={saving}>
            儲存變更
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
