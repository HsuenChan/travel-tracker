"use client";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { useState, useEffect, useRef } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col, Select } from "antd";
import { PlaneIcon, PhotoIcon, CalendarIcon, CreditCardIcon, NotepadIcon, LocationIcon, GiftIcon } from "@/app/components/Icons";

import dayjs from "dayjs";

import QuillEditor from "@/app/components/QuillEditor";

const ALL_TABS = [
  { key: "transport", label: "路線", icon: <PlaneIcon size={18} /> },
  { key: "itinerary", label: "行程", icon: <CalendarIcon size={18} /> },
  { key: "expenses", label: "費用", icon: <CreditCardIcon size={18} /> },
  { key: "photos", label: "照片", icon: <PhotoIcon size={18} /> },
  { key: "notes", label: "筆記", icon: <NotepadIcon size={18} /> },
  { key: "souvenirs", label: "伴手禮", icon: <GiftIcon size={18} /> },
];

interface Props {
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
  countryCode?: string;
}

export default function AddTripModal({ onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [destQuery, setDestQuery] = useState("");
  const [destOptions, setDestOptions] = useState<DestOption[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  // Map from destination name → coords, accumulated across searches
  const destCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const destCodesRef = useRef<Record<string, string>>({});

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
          results.forEach((r) => { if (r.countryCode) destCodesRef.current[r.value] = r.countryCode; });;
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
    const uniqueCodes = [...new Set(destNames.map(n => destCodesRef.current[n]).filter(Boolean))];
    const country_codes = uniqueCodes.join(",");

    await fetchWithAuth("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        startDate: values.startDate ? (values.startDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        endDate: values.endDate ? (values.endDate as typeof dayjs.prototype).format("YYYY-MM-DD") : "",
        countries,
        destinations,
        country_codes,
        notes: values.notes ?? "",
        photoAlbumId: values.photoAlbumId ?? "",
        people: values.people ?? [],
        currency: Array.isArray(values.currency) ? values.currency.join(",") : (values.currency || "TWD"),
        enabledTabs: (values.enabledTabs as string[]) ?? ALL_TABS.map(t => t.key),
      }),
    });
    setSaving(false);
    onSaved();
  }

  // Build options for the Select: search results (selected values auto-render as tags)
  const selectOptions = destOptions.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Modal
      title="新增旅程"
      open
      onCancel={onClose}
      footer={null}
      width={600}
      centered={true}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="mt-4 cute-form"
        initialValues={{ currency: ["TWD"], enabledTabs: ALL_TABS.map(t => t.key) }}
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

        <Form.Item
          name="enabledTabs"
          label="顯示的分頁"
          extra="選擇這趟旅程要顯示哪些功能分頁"
        >
          <Select
            mode="multiple"
            placeholder="選擇要顯示的分頁"
          >
            {ALL_TABS.map(t => (
              <Select.Option key={t.key} value={t.key}>
                <div className="flex items-center gap-2">
                  {t.icon} {t.label}
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="notes" label="備註">
          <QuillEditor placeholder="這趟旅程的心得或備忘..." />
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
