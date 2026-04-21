"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect, useRef } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col, Select } from "antd";
import dayjs from "dayjs";

import QuillEditor from "@/app/components/QuillEditor";

interface Destination {
  name: string;
  lat: number;
  lng: number;
}

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
  destinations?: Destination[] | null;
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

interface DestOption {
  value: string;
  label: string;
  lat: number;
  lng: number;
}

export default function EditTripModal({ trip, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [destQuery, setDestQuery] = useState("");
  const [destOptions, setDestOptions] = useState<DestOption[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const destCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});

  // Seed coord map from existing destinations
  useEffect(() => {
    if (trip.destinations) {
      trip.destinations.forEach((d) => {
        destCoordsRef.current[d.name] = { lat: d.lat, lng: d.lng };
      });
    }
  }, []);

  useEffect(() => {
    const CURRENCY_API = "https://openexchangerates.org/api/currencies.json";
    const TRANSLATION_API = "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-numbers-full/main/zh-Hant/currencies.json";
    Promise.all([
      fetch(CURRENCY_API).then((r) => r.json()),
      fetch(TRANSLATION_API).then((r) => r.json())
    ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(([currencyData, translationData]: [Record<string, string>, any]) => {
        const zhNames = translationData?.main?.["zh-Hant"]?.numbers?.currencies ?? {};
        const options = Object.entries(currencyData).map(([code, engName]) => {
          const chineseName = zhNames[code]?.displayName || engName;
          return {
            value: code,
            label: `${code} - ${chineseName}`,
          };
        });

        options.sort((a, b) => a.value.localeCompare(b.value));

        setCurrencyOptions(options);
      })
      .catch(() => {
        setCurrencyOptions([
          { value: "TWD", label: "TWD - 新台幣" },
          { value: "USD", label: "USD - 美元" },
          { value: "EUR", label: "EUR - 歐元" },
          { value: "JPY", label: "JPY - 日圓" },
          { value: "KRW", label: "KRW - 韓元" },
          { value: "HKD", label: "HKD - 港幣" },
          { value: "SGD", label: "SGD - 新加坡幣" },
          { value: "THB", label: "THB - 泰銖" },
          { value: "GBP", label: "GBP - 英鎊" },
          { value: "AUD", label: "AUD - 澳幣" },
          { value: "CNY", label: "CNY - 人民幣" },
          { value: "MYR", label: "MYR - 馬來西亞林吉特" },
        ]);
      });
  }, []);

  // Debounced destination search
  useEffect(() => {
    if (destQuery.length < 2) { setDestOptions([]); return; }
    const t = setTimeout(async () => {
      setDestSearching(true);
      try {
        const res = await fetch(`/api/search-destinations?q=${encodeURIComponent(destQuery)}`);
        if (res.ok) {
          const { results } = await res.json() as { results: DestOption[] };
          setDestOptions(results);
          results.forEach((r) => { destCoordsRef.current[r.value] = { lat: r.lat, lng: r.lng }; });
        }
      } finally {
        setDestSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [destQuery]);

  async function handleSubmit(values: Record<string, unknown>) {
    setSaving(true);

    const destNames: string[] = (values.destinations as string[]) ?? [];
    const destinations = destNames
      .filter((n) => destCoordsRef.current[n])
      .map((n) => ({ name: n, ...destCoordsRef.current[n] }));
    const countries = destNames.join("、");

    await fetchWithAuth("/api/sheets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: trip.id,
        name: values.name,
        startDate: values.startDate ? (values.startDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        endDate: values.endDate ? (values.endDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        countries,
        destinations,
        notes: values.notes ?? "",
        photoAlbumId: values.photoAlbumId ?? "",
        people: values.people ?? [],
        currency: Array.isArray(values.currency) ? values.currency.join(",") : (values.currency || "TWD"),
      }),
    });
    setSaving(false);
    onSaved();
  }

  // Initial destinations: prefer trip.destinations names; fall back to countries text
  const initialDestNames = trip.destinations?.length
    ? trip.destinations.map((d) => d.name)
    : trip.countries
      ? trip.countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
      : [];

  // Build options: current selected names (so they show as tags) + search results
  const selectOptions = [
    ...initialDestNames.map((n) => ({ value: n, label: n })),
    ...destOptions.filter((o) => !initialDestNames.includes(o.value)).map((o) => ({ value: o.value, label: o.label })),
  ].filter((opt, i, arr) => arr.findIndex((o) => o.value === opt.value) === i);

  return (
    <Modal
      title="編輯旅程"
      open
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="mt-4 cute-form"
        initialValues={{
          name: trip.name,
          startDate: trip.start_date ? dayjs(trip.start_date) : null,
          endDate: trip.end_date ? dayjs(trip.end_date) : null,
          destinations: initialDestNames,
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

        <Form.Item
          name="destinations"
          label="目的地"
          extra="輸入地區名稱搜尋（如「沖繩」、「澎湖」），可選多個地點"
        >
          <Select
            mode="multiple"
            showSearch
            filterOption={false}
            onSearch={setDestQuery}
            options={selectOptions}
            loading={destSearching}
            notFoundContent={
              destQuery.length < 2
                ? <span className="text-zinc-500 text-xs">請輸入至少 2 個字搜尋</span>
                : <span className="text-zinc-500 text-xs">找不到相符地點</span>
            }
            placeholder="搜尋地區..."
          />
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

        <Form.Item name="notes" label="備註">
          <QuillEditor />
        </Form.Item>

        <Form.Item
          name="photoAlbumId"
          label="Google Photos 相簿連結"
          extra="請從瀏覽器網址列複製完整連結（非 photos.app.goo.gl 短網址）"
        >
          <Input placeholder="https://photos.google.com/share/... 或 /album/..." />
        </Form.Item>

        <Form.Item className="!mb-0 !mt-6">
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={saving}
            className="!rounded-full !h-12 !text-base !font-bold bg-linear-to-r from-[#8b5cf6] to-[#d946ef] border-none shadow-[0_8px_25px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-all"
          >
            儲存變更
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
