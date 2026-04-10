"use client";

import { useRef, useState } from "react";
import { Modal, Form, Input, Select, DatePicker, TimePicker, Button, Row, Col, AutoComplete, App, Tag, Space, Typography } from "antd";
// Space is used in the batch confirm segment list
import { UploadOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { AIRPORT_COORDS } from "@/lib/airports";
import { TRANSPORT_OPTIONS, toTransportKey, VEHICLE_ICON } from "@/lib/transport";
import dayjs from "dayjs";

const AIRPORT_OPTIONS = Object.entries(AIRPORT_COORDS).map(([iata, info]) => ({
  value: iata,
  label: `${iata} — ${info.city}`,
}));

interface ParsedSegment {
  type: string;
  from: string;
  to: string;
  fromIata: string;
  toIata: string;
  date: string;
  time: string;
  flightNo: string;
  aircraft: string;
}

interface Props {
  tripId: string;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddSegmentModal({ tripId, nextOrder, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [type, setType] = useState("飛機");
  const [parsedSegments, setParsedSegments] = useState<ParsedSegment[] | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { message } = App.useApp();

  async function handleSubmit(values: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        order: nextOrder,
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

  async function handleBatchSave() {
    if (!parsedSegments) return;
    setBatchSaving(true);
    for (let i = 0; i < parsedSegments.length; i++) {
      const seg = parsedSegments[i];
      await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          order: nextOrder + i,
          from: seg.from,
          fromIata: seg.fromIata,
          to: seg.to,
          toIata: seg.toIata,
          type: seg.type || "飛機",
          date: seg.date,
          time: seg.time,
          flightNo: seg.flightNo,
          aircraft: seg.aircraft,
        }),
      });
    }
    setBatchSaving(false);
    onSaved();
  }

  async function processParseResponse(res: Response) {
    if (!res.ok) {
      const err = await res.json();
      message.error(err.error ?? "解析失敗");
      return;
    }
    const data = await res.json();
    const segments: ParsedSegment[] = Array.isArray(data) ? data : [data];
    if (segments.length === 1) {
      const seg = segments[0];
      const filled: Record<string, unknown> = {};
      if (seg.type) { filled.type = seg.type; setType(seg.type); }
      if (seg.from) filled.from = seg.from;
      if (seg.to) filled.to = seg.to;
      if (seg.fromIata) filled.fromIata = seg.fromIata;
      if (seg.toIata) filled.toIata = seg.toIata;
      if (seg.date) filled.date = dayjs(seg.date);
      if (seg.time) filled.time = dayjs(seg.time, "HH:mm");
      if (seg.flightNo) filled.flightNo = seg.flightNo;
      if (seg.aircraft) filled.aircraft = seg.aircraft;
      form.setFieldsValue(filled);
      message.success("已填入航班資訊，請確認後送出");
    } else {
      setParsedSegments(segments);
      message.success(`找到 ${segments.length} 段航程，確認後批量新增`);
    }
  }

  async function handleFileImport(file: File) {
    setParsing(true);
    setParsedSegments(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-flight", { method: "POST", body: formData });
      await processParseResponse(res);
    } catch {
      message.error("解析失敗，請稍後再試");
    } finally {
      setParsing(false);
    }
  }

  const importButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileImport(file);
          e.target.value = "";
        }}
      />
      <Button
        icon={<UploadOutlined />}
        onClick={() => fileInputRef.current?.click()}
        loading={parsing}
        style={{ width: "100%", marginBottom: 16 }}
        disabled={parsing}
      >
        {parsing ? "AI 解析中…" : "📄 從圖片 / PDF 匯入航班資訊"}
      </Button>
    </>
  );

  // Batch confirm view
  if (parsedSegments && parsedSegments.length > 1) {
    return (
      <Modal title="匯入多段航程" open onCancel={onClose} footer={null} width={520} styles={{ wrapper: { marginBottom: 32 } }}>
        {importButton}
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          偵測到 {parsedSegments.length} 段航班，確認後一次新增：
        </Typography.Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {parsedSegments.map((seg, i) => (
            <div
              key={i}
              style={{ background: "#1c1c1e", border: "1px solid #2c2c2e", borderRadius: 8, padding: "10px 14px" }}
            >
              <Space wrap>
                <span style={{ fontSize: 16 }}>{VEHICLE_ICON[toTransportKey(seg.type || "飛機")]}</span>
                <Typography.Text strong style={{ color: "#f4f4f5" }}>
                  {seg.from || "?"}{seg.fromIata && ` (${seg.fromIata})`}
                  {" → "}
                  {seg.to || "?"}{seg.toIata && ` (${seg.toIata})`}
                </Typography.Text>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Space size={4} wrap>
                  {seg.date && <Tag color="geekblue">{seg.date}{seg.time && ` ${seg.time}`}</Tag>}
                  {seg.flightNo && <Tag color="purple">{seg.flightNo}</Tag>}
                  {seg.aircraft && <Tag color="cyan">{seg.aircraft}</Tag>}
                </Space>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            block
            loading={batchSaving}
            onClick={handleBatchSave}
          >
            批量新增 {parsedSegments.length} 段航班
          </Button>
          <Button block onClick={() => setParsedSegments(null)}>
            返回手動填寫
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="新增交通段落" open onCancel={onClose} footer={null} width={540} styles={{ wrapper: { marginBottom: 32 } }}>
      {importButton}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ type: "飛機" }}
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
            新增段落
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
