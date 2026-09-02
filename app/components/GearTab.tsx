"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Typography, Checkbox, Input, Button, App, Modal, Select, Skeleton, Upload } from "antd";
import PillButton from "./PillButton";
import { motion } from "framer-motion";
import { DeleteOutlined, EditOutlined, PictureOutlined, CloseOutlined, LoadingOutlined } from "@ant-design/icons";
import { PlusIcon, BackpackIcon, GridIcon, MenuListIcon } from "@/app/components/Icons";

type ViewMode = "card" | "list";
type WeightRole = "base" | "worn" | "consumable";

/** 顯示方式是個人閱讀習慣，不分旅程 */
const VIEW_KEY = "travel_gear_view";

/** 勾掉後項目會沉到底部，用位移動畫讓使用者看得到它跑去哪 */
const LAYOUT_TRANSITION = { type: "tween" as const, duration: 0.6, ease: [0.2, 0, 0, 1] as const };

/**
 * 登山裝備九宮格（來自登山安全講座的分類法）。
 * 只是預設值：tag 本身完全自由，這九項的作用是「一件都沒帶的分類也會出現在分類格」，
 * 讓漏帶的那一格自己浮出來。
 */
const PRESET_TAGS = ["背包", "飲水", "食物", "雨具", "電子", "醫藥", "衣著", "鞋襪", "緊急避難"];

const UNTAGGED = "未分類";

/**
 * 重量身份：固定三態，不可自訂。
 * 基準重量的定義就是「總重 − 穿著 − 消耗」，開放自訂命名的話這個算式就沒有依據。
 */
const ROLES: { value: WeightRole; label: string; hint: string }[] = [
  { value: "base", label: "基準", hint: "揹在背包裡、不會變少的裝備" },
  { value: "worn", label: "穿著", hint: "穿在身上、不算進背包重量" },
  { value: "consumable", label: "消耗", hint: "食物、水、瓦斯，會越揹越輕" },
];

const TAG_PALETTE = ["#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#fb923c", "#22d3ee", "#c084fc", "#a3e635"];
const UNTAGGED_COLOR = "#71717a";

/** 預設分類用固定色，自訂 tag 用名稱雜湊取色：同一個 tag 每次進來顏色一致 */
function tagColor(tag: string): string {
  if (tag === UNTAGGED) return UNTAGGED_COLOR;
  const preset = PRESET_TAGS.indexOf(tag);
  if (preset >= 0) return TAG_PALETTE[preset % TAG_PALETTE.length];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 9973;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

function fmtWeight(g: number): string {
  if (!g) return "0 g";
  if (g >= 1000) return `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg`;
  return `${Math.round(g)} g`;
}

interface GearItem {
  id: string;
  name: string;
  notes?: string;
  image_url?: string;
  tags?: string[];
  weight_g?: number | null;
  qty: number;
  weight_role: WeightRole;
  assigned_to?: string | null;
  is_checked: boolean;
}

export default function GearTab({
  tripId,
  people = [],
  readOnly = false,
}: {
  tripId: string;
  people?: string[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [newUnit, setNewUnit] = useState<"g" | "kg">("g");
  const [newQty, setNewQty] = useState("1");
  const [newRole, setNewRole] = useState<WeightRole>("base");
  const [newAssignedTo, setNewAssignedTo] = useState<string | undefined>(undefined);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlModal = searchParams.get("modal");
  const urlGearId = searchParams.get("gearId");
  const [forceClosed, setForceClosed] = useState(false);
  const pushedModalRef = useRef(false);
  const showModal = !readOnly && !forceClosed && (urlModal === "addGear" || urlModal === "editGear");
  const editingItem = useMemo<GearItem | null>(() => {
    if (urlModal !== "editGear" || !urlGearId) return null;
    return items.find(i => i.id === urlGearId) ?? null;
  }, [urlModal, urlGearId, items]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [uploading, setUploading] = useState(false);
  const { message, modal } = App.useApp();

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tripId", tripId);
      const res = await fetch("/api/itinerary/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setNewImageUrl(data.url);
      } else {
        message.error("圖片上傳失敗，請再試一次");
      }
    } catch {
      message.error("圖片上傳失敗，請再試一次");
    } finally {
      setUploading(false);
    }
  }

  async function load(force = true) {
    const cacheKey = `travel_gear_${tripId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setItems(JSON.parse(cached));
      setLoading(false);
    }
    // 60 秒內的快取視為新鮮：切分頁重新掛載時不重打 API
    if (!force && cached && Date.now() - Number(localStorage.getItem(`${cacheKey}:ts`) || 0) < 60_000) {
      setLoading(false);
      return;
    }
    if (!cached) setLoading(true);

    const res = await fetch(`/api/gear?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      localStorage.setItem(cacheKey, JSON.stringify(data.items));
      localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
    }
    setLoading(false);
  }

  // 從 localStorage 還原顯示方式；SSR 沒有 localStorage，所以掛載後才套用
  function restoreViewMode() {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "card" || saved === "list") setViewMode(saved);
  }

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  useEffect(() => { restoreViewMode(); load(false); }, [tripId]);

  // Modal 狀態進 URL：手機返回鍵可關閉，行為與行程/費用一致
  useEffect(() => {
    if (readOnly) return;
    if (urlModal === "addGear" || urlModal === "editGear") setForceClosed(false);
    if (urlModal === "editGear" && editingItem) {
      setNewName(editingItem.name);
      setNewNotes(editingItem.notes || "");
      setNewImageUrl(editingItem.image_url || "");
      setNewTags(editingItem.tags || []);
      const w = Number(editingItem.weight_g ?? 0);
      // 1kg 以上用 kg 顯示，免得看到一長串公克
      if (editingItem.weight_g == null) { setNewWeight(""); setNewUnit("g"); }
      else if (w >= 1000) { setNewWeight(String(w / 1000)); setNewUnit("kg"); }
      else { setNewWeight(String(w)); setNewUnit("g"); }
      setNewQty(String(editingItem.qty ?? 1));
      setNewRole(editingItem.weight_role ?? "base");
      setNewAssignedTo(editingItem.assigned_to || undefined);
    } else if (urlModal === "addGear") {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlModal, editingItem?.id]);

  function resetForm() {
    setNewName("");
    setNewNotes("");
    setNewImageUrl("");
    setNewTags([]);
    setNewWeight("");
    setNewUnit("g");
    setNewQty("1");
    setNewRole("base");
    setNewAssignedTo(undefined);
  }

  function openAdd() {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "addGear");
    p.delete("gearId");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function openEdit(item: GearItem) {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "editGear");
    p.set("gearId", item.id);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function closeModal() {
    setForceClosed(true);
    if (pushedModalRef.current) {
      pushedModalRef.current = false;
      router.back();
      return;
    }
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.delete("modal");
    p.delete("gearId");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  async function handleSave() {
    if (!newName.trim()) {
      message.error("請輸入裝備名稱");
      return;
    }
    // 留空＝還沒秤，存 null；填了就換算成公克統一存
    const parsed = newWeight.trim() === "" ? null : Number(newWeight);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      message.error("重量請輸入 0 或正數");
      return;
    }
    const weight_g = parsed === null ? null : (newUnit === "kg" ? parsed * 1000 : parsed);
    const qty = Math.max(1, Math.round(Number(newQty) || 1));

    setSaving(true);
    const payload = {
      name: newName,
      notes: newNotes,
      image_url: newImageUrl,
      tags: newTags,
      weight_g,
      qty,
      weight_role: newRole,
      assigned_to: newAssignedTo ?? null,
    };

    let res;
    if (editingItem) {
      res = await fetch(`/api/gear`, {
        method: "PUT",
        body: JSON.stringify({ id: editingItem.id, ...payload }),
      });
    } else {
      res = await fetch(`/api/gear`, {
        method: "POST",
        body: JSON.stringify({ tripId, ...payload }),
      });
    }

    setSaving(false);
    if (res.ok) {
      closeModal();
      load();
    } else {
      message.error(editingItem ? "儲存失敗" : "新增失敗");
    }
  }

  async function handleToggle(item: GearItem) {
    if (readOnly) return;
    // optimistic，失敗回滾
    setItems((prev) => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    try {
      const res = await fetch(`/api/gear`, {
        method: "PUT",
        body: JSON.stringify({ id: item.id, is_checked: !item.is_checked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((prev) => prev.map(i => i.id === item.id ? { ...i, is_checked: item.is_checked } : i));
      message.error("狀態更新失敗，請再試一次");
    }
  }

  async function handleDelete(id: string) {
    if (readOnly) return;

    modal.confirm({
      title: "確定刪除這件裝備嗎？",
      content: "刪除後無法恢復",
      okText: "刪除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setItems((prev) => prev.filter(i => i.id !== id));
        await fetch(`/api/gear`, {
          method: "DELETE",
          body: JSON.stringify({ id }),
        });
      }
    });
  }

  /** 一件裝備只算進第一個 tag，否則多 tag 會重複計重、占比條加起來超過 100% */
  function primaryTag(item: GearItem): string {
    return item.tags?.[0] || UNTAGGED;
  }

  const stats = useMemo(() => {
    let total = 0, worn = 0, consumable = 0, unweighed = 0;
    const byTag = new Map<string, { weight: number; count: number }>();
    for (const item of items) {
      const qty = item.qty || 1;
      if (item.weight_g == null) unweighed += 1;
      const w = (Number(item.weight_g) || 0) * qty;
      total += w;
      if (item.weight_role === "worn") worn += w;
      else if (item.weight_role === "consumable") consumable += w;
      const tag = primaryTag(item);
      const cur = byTag.get(tag) ?? { weight: 0, count: 0 };
      byTag.set(tag, { weight: cur.weight + w, count: cur.count + qty });
    }
    return { total, worn, consumable, base: total - worn - consumable, unweighed, byTag };
  }, [items]);

  /** 分類格：有東西的照重量排前面，沒東西的預設分類排後面（虛線提示漏帶） */
  const gridCells = useMemo(() => {
    const used = Array.from(stats.byTag.entries())
      .sort((a, b) => b[1].weight - a[1].weight || b[1].count - a[1].count);
    const unused = PRESET_TAGS
      .filter(t => !stats.byTag.has(t))
      .map(t => [t, { weight: 0, count: 0 }] as [string, { weight: number; count: number }]);
    return [...used, ...unused];
  }, [stats]);

  const visibleItems = items
    .filter(item => !tagFilter || primaryTag(item) === tagFilter)
    .sort((a, b) => Number(a.is_checked) - Number(b.is_checked));

  const packed = items.filter(i => i.is_checked).length;

  return (
    <div className="flex flex-col gap-4 mx-auto pb-10">
      <div className="flex items-center justify-between px-1 gap-2">
        <Typography.Text strong className="text-zinc-100 text-[15px] shrink-0">裝備清單</Typography.Text>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-full p-0.5">
            {([
              { mode: "card" as const, label: "卡片檢視", icon: <GridIcon size={13} /> },
              { mode: "list" as const, label: "列表檢視", icon: <MenuListIcon size={13} /> },
            ]).map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => changeView(mode)}
                aria-label={label}
                aria-pressed={viewMode === mode}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${viewMode === mode
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                {icon}
              </button>
            ))}
          </div>
          {!readOnly && (
            <PillButton onClick={openAdd}>
              <PlusIcon size={13} />
              新增裝備
            </PillButton>
          )}
        </div>
      </div>

      {/* 重量總覽：總重為主，三態為輔；占比條依主分類切段 */}
      {items.length > 0 && (
        <div
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
          style={{ background: 'radial-gradient(ellipse at 12% 0%, rgba(139,92,246,0.10) 0%, transparent 62%), rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="text-zinc-500 text-[11px] mb-0.5">總重</div>
              <div className="text-zinc-50 text-[26px] leading-none font-bold tabular-nums">{fmtWeight(stats.total)}</div>
            </div>
            <div className="flex items-center gap-4">
              {([
                { label: "基準", value: stats.base },
                { label: "穿著", value: stats.worn },
                { label: "消耗", value: stats.consumable },
              ]).map(({ label, value }) => (
                <div key={label} className="text-right">
                  <div className="text-zinc-500 text-[11px] mb-0.5">{label}</div>
                  <div className="text-zinc-200 text-[15px] leading-none font-semibold tabular-nums">{fmtWeight(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {stats.total > 0 && (
            <div className="mt-3.5 h-2 rounded-full bg-white/[0.06] overflow-hidden flex">
              {Array.from(stats.byTag.entries())
                .filter(([, v]) => v.weight > 0)
                .sort((a, b) => b[1].weight - a[1].weight)
                .map(([tag, v]) => (
                  <div
                    key={tag}
                    title={`${tag} ${fmtWeight(v.weight)}`}
                    style={{ width: `${(v.weight / stats.total) * 100}%`, background: tagColor(tag) }}
                  />
                ))}
            </div>
          )}

          {stats.unweighed > 0 && (
            <div className="mt-2.5 text-zinc-500 text-[11px]">
              還有 {stats.unweighed} 件沒填重量，沒算進上面的數字
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (() => {
        const pct = Math.round((packed / items.length) * 100);
        return (
          <div className="px-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-xs">已打包 {packed} / {items.length}</span>
              <span className="text-zinc-600 text-xs">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* 分類格（九宮格）：點一下篩選；空的預設分類用虛線提示還沒帶東西 */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">分類（點一下篩選）</span>
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="text-violet-300 text-xs hover:text-violet-200 transition-colors cursor-pointer"
              >
                顯示全部
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
            {gridCells.map(([tag, v]) => {
              const empty = v.count === 0;
              const active = tagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => { if (!empty) setTagFilter(active ? null : tag); }}
                  disabled={empty}
                  aria-pressed={active}
                  className={`flex flex-col items-start gap-1 rounded-xl px-2.5 py-2 text-left transition-all ${empty
                    ? "border border-dashed border-white/[0.12] bg-transparent cursor-default"
                    : active
                      ? "border border-violet-500/40 bg-violet-500/[0.12] cursor-pointer"
                      : "border border-white/[0.08] bg-white/[0.04] hover:border-white/20 cursor-pointer"
                    }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 w-full">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: empty ? "transparent" : tagColor(tag), border: empty ? `1px dashed ${tagColor(tag)}80` : undefined }}
                    />
                    <span className={`text-[12px] font-medium truncate ${empty ? "text-zinc-600" : "text-zinc-200"}`}>{tag}</span>
                  </div>
                  <div className={`text-[11px] tabular-nums ${empty ? "text-zinc-700" : "text-zinc-500"}`}>
                    {empty ? "還沒帶" : `${v.count} 件 · ${fmtWeight(v.weight)}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        title={editingItem ? "編輯裝備" : "新增裝備"}
        open={showModal}
        onCancel={closeModal}
        afterClose={resetForm}
        footer={null}
        destroyOnHidden
      >
        <div className="flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">裝備名稱</Typography.Text>
            <Input
              placeholder="如：Osprey Exos 58 背包"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-10!"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Typography.Text className="text-zinc-400 text-sm">單件重量 (可選)</Typography.Text>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="留空＝還沒秤"
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-10!"
                />
                <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl p-0.5 shrink-0">
                  {(["g", "kg"] as const).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setNewUnit(u)}
                      aria-pressed={newUnit === u}
                      className={`w-9 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${newUnit === u ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 w-20">
              <Typography.Text className="text-zinc-400 text-sm">數量</Typography.Text>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-10!"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">重量身份</Typography.Text>
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setNewRole(r.value)}
                  aria-pressed={newRole === r.value}
                  className={`flex-1 h-8 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${newRole === r.value ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <span className="text-zinc-600 text-[11px]">{ROLES.find(r => r.value === newRole)?.hint}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">分類標籤 (Tags)</Typography.Text>
            <Select
              mode="tags"
              placeholder="輸入標籤後按 Enter (例如：背包、醫藥)"
              value={newTags}
              onChange={setNewTags}
              className="cute-select custom-tags-select"
              options={
                Array.from(new Set([...items.flatMap(i => i.tags || []), ...PRESET_TAGS])).map(tag => ({
                  value: tag,
                  label: tag
                }))
              }
            />
            <span className="text-zinc-600 text-[11px]">第一個標籤會用來算分類占比</span>
          </div>

          {people.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Typography.Text className="text-zinc-400 text-sm">由誰揹 (可選)</Typography.Text>
              <Select
                allowClear
                placeholder="團體裝備可指定隊友"
                value={newAssignedTo}
                onChange={(v) => setNewAssignedTo(v ?? undefined)}
                className="cute-select"
                options={people.map(p => ({ value: p, label: p }))}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">圖片 (可選)</Typography.Text>
            {newImageUrl ? (
              <div className="relative w-24 h-24">
                <img src={newImageUrl} alt="裝備圖片" className="w-full h-full object-cover rounded-xl border border-white/10" />
                <button
                  type="button"
                  aria-label="移除圖片"
                  onClick={() => setNewImageUrl("")}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 border border-white/[0.15] text-zinc-300 flex items-center justify-center hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <CloseOutlined style={{ fontSize: 10 }} />
                </button>
              </div>
            ) : (
              <Upload
                accept="image/*"
                showUploadList={false}
                disabled={uploading}
                beforeUpload={(file) => { handleImageUpload(file); return false; }}
              >
                <button
                  type="button"
                  className="w-24 h-24 rounded-xl border border-dashed border-white/[0.15] text-zinc-500 flex flex-col items-center justify-center gap-1 hover:border-white/30 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {uploading ? <LoadingOutlined /> : <PictureOutlined />}
                  <span className="text-[11px]">{uploading ? "上傳中" : "上傳"}</span>
                </button>
              </Upload>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">備註</Typography.Text>
            <Input.TextArea
              placeholder="型號、收納位置、替代方案..."
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! min-h-[80px]!"
            />
          </div>

          <Button
            type="primary"
            onClick={handleSave}
            loading={saving}
            className="w-full rounded-xl! bg-violet-500! text-white! hover:bg-violet-600! border-none! h-10! font-medium! mt-2! cursor-pointer"
          >
            {editingItem ? "儲存" : "加入清單"}
          </Button>
        </div>
      </Modal>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-white/5 bg-white/5 overflow-hidden">
              <div className="p-3 flex items-start gap-3">
                <div className="pt-0.5"><Skeleton.Avatar active shape="square" size={16} /></div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <Skeleton active paragraph={{ rows: 1, width: ['80%'] }} title={{ width: "50%" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-20 rounded-3xl border border-white/5 bg-white/2"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
            <BackpackIcon size={32} stroke="#8b5cf6" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <div className="text-zinc-200 font-medium mb-1">還沒有裝備清單</div>
            <div className="text-zinc-500 text-xs px-10">逐件記下要帶的東西與重量，出發前一格一格勾掉。</div>
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="py-12 rounded-2xl border border-white/5 bg-white/[0.02] text-center text-zinc-500 text-sm">
          「{tagFilter}」分類下沒有裝備
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-1.5">
          {visibleItems.map(item => (
            <motion.div
              key={item.id}
              layout
              transition={LAYOUT_TRANSITION}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-[background-color,border-color,opacity] duration-300 ${item.is_checked ? 'bg-white/[0.03] border-white/5 opacity-60' : 'bg-white/[0.06] border-white/10'}`}
            >
              <div onClick={(e) => { if (!readOnly) e.stopPropagation(); }}>
                <Checkbox
                  checked={item.is_checked}
                  onChange={() => handleToggle(item)}
                  disabled={readOnly}
                />
              </div>
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0" onClick={() => handleToggle(item)}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-medium truncate select-none ${item.is_checked ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                    {item.name}
                  </span>
                  {item.qty > 1 && (
                    <span className="text-[11px] text-zinc-500 shrink-0 tabular-nums">×{item.qty}</span>
                  )}
                  <GearMeta item={item} />
                </div>
                {item.notes && (
                  <div className={`text-xs mt-0.5 select-none line-clamp-2 leading-relaxed ${item.is_checked ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    {item.notes}
                  </div>
                )}
              </div>
              <span className={`text-[13px] tabular-nums shrink-0 ${item.is_checked ? 'text-zinc-600' : 'text-zinc-300'}`}>
                {item.weight_g == null ? "—" : fmtWeight(Number(item.weight_g) * (item.qty || 1))}
              </span>
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0 bg-black/30 backdrop-blur-[2px] rounded-full p-0.5">
                  <button
                    aria-label="編輯裝備"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:bg-black/25 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                  >
                    <EditOutlined style={{ fontSize: 13 }} />
                  </button>
                  <button
                    aria-label="刪除裝備"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-red-400 hover:bg-black/25 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  >
                    <DeleteOutlined style={{ fontSize: 13 }} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleItems.map(item => (
            <motion.div
              key={item.id}
              layout
              transition={LAYOUT_TRANSITION}
              className={`flex flex-col rounded-2xl border overflow-hidden relative transition-[background-color,border-color,opacity] duration-300 ${item.is_checked ? 'bg-white/5 border-white/5 opacity-60' : 'bg-white/10 border-white/10 shadow-lg'}`}
            >
              {/* Image Section（沒有圖片就不佔位） */}
              {item.image_url && (
                <div
                  className="w-full h-32 bg-zinc-800 relative cursor-pointer"
                  onClick={() => handleToggle(item)}
                >
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
                </div>
              )}

              {/* Content Section：沒有圖片時右側要讓開絕對定位的操作鈕 */}
              <div className={`p-3 flex items-start gap-3 ${!item.image_url && !readOnly ? "pr-[70px]" : ""}`}>
                <div className="pt-0.5" onClick={(e) => { if (!readOnly) e.stopPropagation(); }}>
                  <Checkbox
                    checked={item.is_checked}
                    onChange={() => handleToggle(item)}
                    disabled={readOnly}
                    className="scale-110"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col" onClick={() => handleToggle(item)}>
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className={`text-[15px] font-bold transition-colors select-none truncate ${item.is_checked ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                      {item.name}
                    </span>
                    {item.qty > 1 && (
                      <span className="text-[11px] text-zinc-500 shrink-0 tabular-nums">×{item.qty}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[13px] font-semibold tabular-nums ${item.is_checked ? 'text-zinc-600' : 'text-zinc-200'}`}>
                      {item.weight_g == null ? "未秤重" : fmtWeight(Number(item.weight_g) * (item.qty || 1))}
                    </span>
                    <GearMeta item={item} />
                  </div>
                  {item.notes && (
                    <span className={`text-[13px] mt-1.5 select-none line-clamp-2 leading-relaxed ${item.is_checked ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      {item.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions (Absolute Header) */}
              {!readOnly && (
                <div className="absolute top-2 right-2 flex gap-1 bg-black/30 backdrop-blur-[2px] rounded-full p-0.5">
                  <button
                    className="text-white hover:text-blue-400 transition-colors p-1.5 flex items-center justify-center rounded-full hover:bg-black/20 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                  >
                    <EditOutlined style={{ fontSize: '13px' }} />
                  </button>
                  <button
                    className="text-white hover:text-red-400 transition-colors p-1.5 flex items-center justify-center rounded-full hover:bg-black/20 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  >
                    <DeleteOutlined style={{ fontSize: '13px' }} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 標籤 / 重量身份 / 揹負者：卡片與列表共用，兩邊顯示規則不會走鐘 */
function GearMeta({ item }: { item: GearItem }) {
  const dim = item.is_checked;
  const role = ROLES.find(r => r.value === item.weight_role);
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {(item.tags || []).map(tag => (
        <span
          key={tag}
          className="text-[10px] px-1.5 py-0.5 rounded-md border shrink-0"
          style={dim
            ? { color: "#52525b", borderColor: "rgba(113,113,122,0.3)", background: "rgba(255,255,255,0.01)" }
            : { color: tagColor(tag), borderColor: `${tagColor(tag)}40`, background: `${tagColor(tag)}1a` }}
        >
          {tag}
        </span>
      ))}
      {item.weight_role !== "base" && role && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border shrink-0 ${dim ? 'text-zinc-600 border-zinc-700/50' : 'text-zinc-400 border-white/15 bg-white/[0.04]'}`}>
          {role.label}
        </span>
      )}
      {item.assigned_to && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border shrink-0 ${dim ? 'text-zinc-600 border-zinc-700/50' : 'text-sky-300 border-sky-500/25 bg-sky-500/10'}`}>
          {item.assigned_to}
        </span>
      )}
    </div>
  );
}
