"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useRef, useState } from "react";
import { Modal, Form, Input, Select, DatePicker, TimePicker, Button, Row, Col, AutoComplete, App, Tag, Space, Typography } from "antd";
// Space is used in the batch confirm segment list
import { UploadOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { AIRPORT_COORDS } from "@/lib/airports";
import { TRANSPORT_OPTIONS, toTransportKey } from "@/lib/transport";
import VehicleIconChip from "@/app/components/VehicleIconChip";
import { FileIcon } from "@/app/components/Icons";
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
  arrivalDate: string;
  arrivalTime: string;
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
    await fetchWithAuth("/api/segments", {
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
        arrivalDate: values.arrivalDate ? (values.arrivalDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        arrivalTime: values.arrivalTime ? (values.arrivalTime as typeof dayjs.prototype).format("HH:mm") : "",
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
      await fetchWithAuth("/api/segments", {
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
          arrivalDate: seg.arrivalDate,
          arrivalTime: seg.arrivalTime,
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
      if (seg.arrivalDate) filled.arrivalDate = dayjs(seg.arrivalDate);
      if (seg.arrivalTime) filled.arrivalTime = dayjs(seg.arrivalTime, "HH:mm");
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
      const res = await fetchWithAuth("/api/parse-flight", { method: "POST", body: formData });
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
        className="hidden!"
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
        className="w-full mb-4"
        disabled={parsing}
      >
        {parsing ? "AI 解析中…" : (
          <span className="inline-flex items-center gap-1.5">
            <FileIcon size={13} />
            從圖片 / PDF 匯入航班資訊
          </span>
        )}
      </Button>
    </>
  );

  // Batch confirm view
  if (parsedSegments && parsedSegments.length > 1) {
    return (
      <Modal
        title="匯入多段航程"
        open={true}
        onCancel={onClose}
        footer={null}
        width={520}
        centered={true}
      >
        {importButton}
        <Typography.Text type="secondary" className="block mb-3">
          偵測到 {parsedSegments.length} 段航班，確認後一次新增：
        </Typography.Text>
        <div className="flex flex-col gap-2 mb-4">
          {parsedSegments.map((seg, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.07] rounded-[14px] px-[14px] py-2.5"
            >
              <Space wrap>
                <VehicleIconChip type={seg.type || "飛機"} size={28} />
                <Typography.Text strong className="text-zinc-100">
                  {seg.from || "?"}{seg.fromIata && ` (${seg.fromIata})`}
                  {" → "}
                  {seg.to || "?"}{seg.toIata && ` (${seg.toIata})`}
                </Typography.Text>
              </Space>
              <div className="mt-1">
                <Space size={4} wrap>
                  {seg.date && <Tag color="geekblue">出發 {seg.date}{seg.time && ` ${seg.time}`}</Tag>}
                  {(seg.arrivalDate || seg.arrivalTime) && (
                    <Tag color="purple">抵達{seg.arrivalDate ? ` ${seg.arrivalDate}` : ""}{seg.arrivalTime && ` ${seg.arrivalTime}`}</Tag>
                  )}
                  {seg.flightNo && <Tag color="purple">{seg.flightNo}</Tag>}
                  {seg.aircraft && <Tag color="cyan">{seg.aircraft}</Tag>}
                </Space>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
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
    <Modal
      title="新增交通段落"
      open={true}
      onCancel={onClose}
      footer={null}
      width={540}
      centered={true}
    >
      {importButton}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ type: "飛機" }}
        disabled={saving || parsing}
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

        <Form.Item className="!mb-0 !mt-6">
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={saving}
            className="!rounded-full !h-12 !text-base !font-bold bg-linear-to-r from-[#8b5cf6] to-[#d946ef] border-none shadow-[0_8px_25px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-all"
          >
            新增段落
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
