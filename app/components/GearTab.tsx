"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Typography, Checkbox, Input, InputNumber, Button, App, Modal, Select, Skeleton, Upload, Tooltip } from "antd";
import PillButton from "./PillButton";
import { motion } from "framer-motion";
import { DeleteOutlined, EditOutlined, PictureOutlined, CloseOutlined, LoadingOutlined } from "@ant-design/icons";
import { PlusIcon, CarabinerIcon, GridIcon, MenuListIcon, ArchiveIcon, TrashIcon, UploadIcon, InfoIcon, EditIcon } from "@/app/components/Icons";
import type { GearScope } from "@/lib/gear";

type ViewMode = "card" | "list";
type WeightRole = "base" | "worn" | "consumable";

/** 顯示方式是個人閱讀習慣，不分旅程 */
const VIEW_KEY = "travel_gear_view";

/** 勾掉後項目會沉到底部，用位移動畫讓使用者看得到它跑去哪 */
const LAYOUT_TRANSITION = { type: "tween" as const, duration: 0.6, ease: [0.2, 0, 0, 1] as const };

const UNTAGGED = "未分類";

/**
 * 重量身份：固定三態，不可自訂。
 * 基準重量的定義就是「總重 − 穿著 − 消耗」，開放自訂命名的話這個算式就沒有依據。
 */
/** 打包的兩種大種類（DB 值仍是 personal / group，只有顯示文案用「公裝」）。個人裝備只有自己看得到 —— 打包清單裡可能有不想給別人看的私人用品。 */
const SCOPES: { value: GearScope; label: string; hint: string }[] = [
  { value: "personal", label: "個人", hint: "只有你看得到，別的隊友不會看到這件" },
  { value: "group", label: "公裝", hint: "全隊共用，所有旅伴都看得到，可以分配攜帶者" },
];

const ROLES: { value: WeightRole; label: string; hint: string }[] = [
  { value: "base", label: "基準", hint: "揹在背包裡、不會變少的裝備" },
  { value: "worn", label: "穿著", hint: "穿在身上、不算進背包重量" },
  { value: "consumable", label: "消耗", hint: "食物、水、瓦斯，會越揹越輕" },
];

const TAG_PALETTE = ["#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#fb923c", "#22d3ee", "#c084fc", "#a3e635"];
const UNTAGGED_COLOR = "#71717a";

/** 由名稱雜湊取色：同一個分類每次進來顏色一致，不需要維護任何對照表 */
function tagColor(tag: string): string {
  if (tag === UNTAGGED) return UNTAGGED_COLOR;
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 9973;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

function fmtWeight(g: number): string {
  if (!g) return "0 g";
  if (g >= 1000) return `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg`;
  return `${Math.round(g)} g`;
}

/** 裝備櫃是 user 層級的，跨旅程共用；沒有 trip_id 與打勾狀態 */
interface ClosetItem {
  id: string;
  name: string;
  notes?: string | null;
  image_url?: string | null;
  category?: string | null;
  weight_g?: number | null;
  qty: number;
  weight_role: WeightRole;
}

/** /api/gear/import 只負責解析，回傳這個形狀讓使用者先看過再決定寫進哪裡 */
interface ParsedRow {
  name: string;
  notes: string | null;
  category: string | null;
  weight_g: number | null;
  qty: number;
  weight_role: WeightRole;
}

export interface GearItem {
  id: string;
  name: string;
  notes?: string;
  image_url?: string;
  category?: string | null;
  /** personal 只有 owner 看得到（RLS 擋）；group 全隊共用 */
  scope: GearScope;
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
  initialItems,
}: {
  tripId: string;
  people?: string[];
  readOnly?: boolean;
  /** 唯讀分享頁用：RLS 只放行旅程成員，資料由 /api/share/[token] 帶進來 */
  initialItems?: GearItem[];
}) {
  const [items, setItems] = useState<GearItem[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newScope, setNewScope] = useState<GearScope>("personal");
  const [newWeight, setNewWeight] = useState<number | null>(null);
  const [newUnit, setNewUnit] = useState<"g" | "kg">("g");
  const [categorySearch, setCategorySearch] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
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
  const [alsoSaveToCloset, setAlsoSaveToCloset] = useState(false);
  const [closetOpen, setClosetOpen] = useState(false);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetLoading, setClosetLoading] = useState(false);
  const [selectedClosetIds, setSelectedClosetIds] = useState<Set<string>>(new Set());
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; skipped: number; totalWeight: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
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

  useEffect(() => {
    restoreViewMode();
    if (initialItems) {
      setItems(initialItems);
      setLoading(false);
    } else {
      load(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, initialItems]);

  // Modal 狀態進 URL：手機返回鍵可關閉，行為與行程/費用一致
  useEffect(() => {
    if (readOnly) return;
    if (urlModal === "addGear" || urlModal === "editGear") setForceClosed(false);
    if (urlModal === "editGear" && editingItem) {
      setNewName(editingItem.name);
      setNewNotes(editingItem.notes || "");
      setNewImageUrl(editingItem.image_url || "");
      setNewCategory(editingItem.category ?? null);
      setNewScope(editingItem.scope ?? "personal");
      const w = Number(editingItem.weight_g ?? 0);
      // 1kg 以上用 kg 顯示，免得看到一長串公克
      if (editingItem.weight_g == null) { setNewWeight(null); setNewUnit("g"); }
      else if (w >= 1000) { setNewWeight(w / 1000); setNewUnit("kg"); }
      else { setNewWeight(w); setNewUnit("g"); }
      setNewQty(editingItem.qty ?? 1);
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
    setNewCategory(null);
    setNewScope("personal");
    setNewWeight(null);
    setNewUnit("g");
    setNewQty(1);
    setNewRole("base");
    setNewAssignedTo(undefined);
    setAlsoSaveToCloset(false);
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
    // InputNumber 已經擋掉負數與非數字，這裡只要處理「留空＝還沒秤」與單位換算
    const weight_g = newWeight === null ? null : (newUnit === "kg" ? newWeight * 1000 : newWeight);
    const qty = Math.max(1, Math.round(newQty || 1));

    setSaving(true);
    const payload = {
      name: newName,
      notes: newNotes,
      image_url: newImageUrl,
      category: newCategory,
      scope: newScope,
      // 個人裝備一律不帶攜帶者，即使 state 因為某個路徑殘留也不會寫進資料庫
      assigned_to: newScope === "group" ? (newAssignedTo ?? null) : null,
      weight_g,
      qty,
      weight_role: newRole,
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

    if (!res.ok) {
      setSaving(false);
      message.error(editingItem ? "儲存失敗" : "新增失敗");
      return;
    }

    // 存入裝備櫃失敗不該讓這次新增看起來像沒成功，所以只提示、不中斷
    if (alsoSaveToCloset) {
      const closetRes = await fetch(`/api/gear/closet`, {
        method: "POST",
        body: JSON.stringify({ name: newName, notes: newNotes, image_url: newImageUrl, category: newCategory, weight_g, qty, weight_role: newRole }),
      });
      if (!closetRes.ok) message.warning("已加入清單，但存入裝備櫃失敗");
    }

    setSaving(false);
    closeModal();
    load();
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

  async function loadCloset() {
    setClosetLoading(true);
    const res = await fetch("/api/gear/closet");
    if (res.ok) {
      const data = await res.json();
      setClosetItems(data.items);
    } else {
      message.error("裝備櫃讀取失敗");
    }
    setClosetLoading(false);
  }

  function openCloset() {
    if (readOnly) return;
    setClosetOpen(true);
    setSelectedClosetIds(new Set());
    setParsed(null);
    setImportUrl("");
    loadCloset();
  }

  /** 裝備櫃套用與 CSV 匯入共用同一條批次新增路徑 */
  async function addRowsToTrip(rows: ParsedRow[] | Omit<ClosetItem, "id">[]) {
    if (rows.length === 0) return;
    setBusy(true);
    const res = await fetch(`/api/gear`, {
      method: "POST",
      body: JSON.stringify({ tripId, items: rows }),
    });
    setBusy(false);
    if (!res.ok) {
      message.error("加入清單失敗");
      return;
    }
    const data = await res.json();
    message.success(`已加入 ${data.inserted} 件裝備`);
    setClosetOpen(false);
    setParsed(null);
    load();
  }

  async function saveRowsToCloset(rows: ParsedRow[]) {
    if (rows.length === 0) return;
    setBusy(true);
    const res = await fetch(`/api/gear/closet`, {
      method: "POST",
      body: JSON.stringify({ items: rows }),
    });
    setBusy(false);
    if (!res.ok) {
      message.error("存入裝備櫃失敗");
      return;
    }
    const data = await res.json();
    message.success(
      data.duplicates
        ? `已存入 ${data.inserted} 件，${data.duplicates} 件已經在櫃子裡`
        : `已存入 ${data.inserted} 件`
    );
    setParsed(null);
    loadCloset();
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) {
      message.error("請貼上 LighterPack 清單連結");
      return;
    }
    setImporting(true);
    const res = await fetch(`/api/gear/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: importUrl }),
    });
    setImporting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      message.error(err.error === "Unrecognised LighterPack link" ? "看不出這是 LighterPack 連結" : "匯入失敗，請改用匯出的 CSV 檔");
      return;
    }
    setParsed(await res.json());
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/gear/import`, { method: "POST", body: fd });
    setImporting(false);
    if (!res.ok) {
      message.error("這個 CSV 解析不出裝備資料");
      return;
    }
    setParsed(await res.json());
  }

  function handleDeleteClosetItem(item: ClosetItem) {
    modal.confirm({
      title: `從裝備櫃移除「${item.name}」？`,
      content: "已經加進旅程清單的那一份不會被刪除",
      okText: "移除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setClosetItems((prev) => prev.filter(i => i.id !== item.id));
        setSelectedClosetIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        await fetch(`/api/gear/closet`, { method: "DELETE", body: JSON.stringify({ id: item.id }) });
      },
    });
  }

  /**
   * 刪整個分類：把該標籤從所有裝備上移除，裝備本身保留。
   * 若那是某件裝備唯一的標籤，它會落到「未分類」。
   */
  function handleDeleteTag(tag: string, count: number) {
    modal.confirm({
      title: `刪除分類「${tag}」？`,
      content: `${count} 件裝備會移除這個標籤，裝備本身不會被刪除；只掛這一個標籤的會變成「未分類」。`,
      okText: "刪除分類",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setDeletingTag(tag);
        try {
          const res = await fetch(`/api/gear/categories`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId, category: tag }),
          });
          if (!res.ok) throw new Error();
          const data = await res.json();
          if (tagFilter === tag) setTagFilter(null);
          await load();
          message.success(`已刪除分類「${tag}」（影響 ${data.updated} 件）`);
        } catch {
          message.error("刪除分類失敗，請再試一次");
        } finally {
          setDeletingTag(null);
        }
      },
    });
  }

  /** 改名：把該分類底下所有裝備的 category 一起換掉 */
  async function handleRenameTag(tag: string) {
    const next = renameDraft.trim();
    if (!next || next === tag) { setRenamingTag(null); return; }
    setRenamingTag(tag);
    try {
      const res = await fetch(`/api/gear/categories`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, category: tag, renameTo: next }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (tagFilter === tag) setTagFilter(next);
      await load();
      message.success(`已改名為「${next}」（影響 ${data.updated} 件）`);
    } catch {
      message.error("改名失敗，請再試一次");
    } finally {
      setRenamingTag(null);
      setRenameDraft("");
    }
  }

  /** 一件裝備一個分類 —— 重量帳上不能重複計算，所以分類是單選而不是自由標籤陣列 */
  function primaryTag(item: GearItem): string {
    return item.category || UNTAGGED;
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

  /** 分類格：只列實際用到的分類，照重量由多到少 */
  const gridCells = useMemo(() =>
    Array.from(stats.byTag.entries())
      .sort((a, b) => b[1].weight - a[1].weight || b[1].count - a[1].count),
  [stats]);

  const visibleItems = items
    .filter(item => !tagFilter || primaryTag(item) === tagFilter)
    .sort((a, b) => Number(a.is_checked) - Number(b.is_checked));

  const packed = items.filter(i => i.is_checked).length;

  return (
    <div className="flex flex-col gap-4 mx-auto pb-10">
      <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
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
            <PillButton onClick={openCloset} aria-label="我的裝備櫃" className="px-3! sm:px-4!">
              <ArchiveIcon size={13} />
              <span className="hidden sm:inline">裝備櫃</span>
            </PillButton>
          )}
          {!readOnly && (
            <PillButton onClick={openAdd}>
              <PlusIcon size={13} />
              新增裝備
            </PillButton>
          )}
        </div>
      </div>

      {/* 狀態列：重量與打包進度合併成一塊。
          原本的分類占比條拿掉了 —— 它的資訊重複在下面的分類 chip 上，而且與打包進度條
          外觀相似、語意無關，兩條相鄰容易誤讀。 */}
      {items.length > 0 && (() => {
        const pct = Math.round((packed / items.length) * 100);
        return (
          <div
            className="rounded-2xl border border-white/[0.08] p-3.5 flex flex-col gap-2.5"
            style={{ background: 'radial-gradient(ellipse at 12% 0%, rgba(139,92,246,0.10) 0%, transparent 62%), rgba(255,255,255,0.03)' }}
          >
            <div className="flex items-baseline justify-between gap-x-4 gap-y-1.5 flex-wrap">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-zinc-50 text-[20px] leading-none font-bold tabular-nums">{fmtWeight(stats.total)}</span>
                <span className="text-zinc-500 text-[11px]">總重</span>
                <span className="flex items-baseline gap-2.5 text-[12px] tabular-nums">
                  {ROLES.map(r => (
                    <Tooltip key={r.value} title={r.hint} trigger={["hover", "click"]}>
                      <span className="text-zinc-400 cursor-help">
                        {r.label}
                        <InfoIcon size={9} className="inline-block ml-0.5 -translate-y-px opacity-60" />
                        <span className="text-zinc-200 font-semibold ml-1">
                          {fmtWeight(r.value === "base" ? stats.base : r.value === "worn" ? stats.worn : stats.consumable)}
                        </span>
                      </span>
                    </Tooltip>
                  ))}
                </span>
                {stats.unweighed > 0 && (
                  <span className="text-zinc-600 text-[11px]">· {stats.unweighed} 件未秤</span>
                )}
              </div>
              <span className="text-zinc-500 text-xs tabular-nums shrink-0">已打包 {packed} / {items.length}　{pct}%</span>
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

      {/* 分類：一行可橫向捲動的 chip（32px 高，符合觸控下限），點一下篩選 */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto pb-1 -mb-1">
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="h-8 px-3 rounded-full text-xs font-medium shrink-0 border border-violet-500/40 bg-violet-500/[0.12] text-violet-300 hover:text-violet-200 transition-colors cursor-pointer"
              >
                顯示全部
              </button>
            )}
            {gridCells.map(([tag, v]) => {
              const active = tagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(active ? null : tag)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-full text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer border ${active
                    ? "border-violet-500/40 bg-violet-500/[0.12] text-zinc-100"
                    : "border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:border-white/20"
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tagColor(tag) }} />
                  {tag}
                  <span className="text-zinc-500 tabular-nums">{fmtWeight(v.weight)}</span>
                </button>
              );
            })}
          </div>
          {!readOnly && gridCells.some(([tag]) => tag !== UNTAGGED) && (
            <button
              onClick={() => setManageOpen(true)}
              className="h-8 px-3 rounded-full text-xs shrink-0 border border-white/[0.08] bg-white/[0.04] text-zinc-500 hover:text-zinc-200 hover:border-white/20 transition-colors cursor-pointer"
            >
              管理
            </button>
          )}
        </div>
      )}

      <Modal
        title={editingItem ? "編輯裝備" : "新增裝備"}
        open={showModal}
        onCancel={closeModal}
        afterClose={resetForm}
        footer={null}
        destroyOnHidden
        centered
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
                <InputNumber
                  min={0}
                  step={newUnit === "kg" ? 0.1 : 1}
                  placeholder="留空＝還沒秤"
                  value={newWeight}
                  onChange={v => setNewWeight(v)}
                  className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! h-10!"
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
              <InputNumber
                min={1}
                step={1}
                precision={0}
                value={newQty}
                onChange={v => setNewQty(v ?? 1)}
                className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! h-10!"
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
            <Typography.Text className="text-zinc-400 text-sm">個人 / 公裝</Typography.Text>
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
              {SCOPES.map(sc => (
                <button
                  key={sc.value}
                  type="button"
                  onClick={() => {
                    setNewScope(sc.value);
                    // 個人裝備沒有「分配給誰」這回事，切過去就清掉
                    if (sc.value === "personal") setNewAssignedTo(undefined);
                  }}
                  aria-pressed={newScope === sc.value}
                  className={`flex-1 h-8 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${newScope === sc.value ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
            <span className="text-zinc-600 text-[11px]">{SCOPES.find(sc => sc.value === newScope)?.hint}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">分類</Typography.Text>
            {/* 單選：一件裝備一個分類，重量帳上才不會重複計算。仍可自由輸入新分類。 */}
            <Select
              allowClear
              showSearch
              placeholder="選擇或輸入分類（例如：技術裝備）"
              value={newCategory ?? undefined}
              onChange={(v) => setNewCategory(v ?? null)}
              className="cute-select"
              options={
                Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[]))
                  .map(c => ({ value: c, label: c }))
              }
              // 輸入不存在的分類時直接建立
              filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
              onSearch={(v) => setCategorySearch(v)}
              notFoundContent={
                categorySearch.trim()
                  ? <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setNewCategory(categorySearch.trim())}
                      className="text-violet-300 text-[13px] hover:text-violet-200 cursor-pointer px-1 py-0.5"
                    >
                      建立「{categorySearch.trim()}」
                    </button>
                  : <span className="text-zinc-600 text-[12px]">還沒有分類</span>
              }
            />
          </div>

          {/* 只有公裝需要分配攜帶者；個人裝備本來就是自己揹 */}
          {newScope === "group" && people.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Typography.Text className="text-zinc-400 text-sm">攜帶者 (可選)</Typography.Text>
              <Select
                allowClear
                showSearch
                placeholder="選擇由哪位隊友攜帶"
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

          <Checkbox
            checked={alsoSaveToCloset}
            onChange={(e) => setAlsoSaveToCloset(e.target.checked)}
            className="mt-1"
          >
            <span className="text-zinc-400 text-[13px]">同時存入我的裝備櫃（下趟可直接套用）</span>
          </Checkbox>

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

      <Modal
        title="我的裝備櫃"
        open={closetOpen}
        onCancel={() => setClosetOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        width={560}
        // globals.css 讓 .ant-modal-body 自己捲；這個彈窗要「只有清單捲」，所以關掉外層捲動。
        // paddingBottom 要自己帶上：這裡的 styles.body 會蓋掉 providers 的全域設定。
        styles={{ body: { maxHeight: "none", overflow: "visible", paddingBottom: 16 } }}
      >
        {/* 扣掉標題列與上下內距後的可用高度，讓彈窗上下都留得下空白，不會頂到視窗邊緣 */}
        <div className="flex flex-col gap-4 mt-6 max-h-[calc(100vh-200px)]">
          {/* LighterPack 沒有公開 API，兩條路都留：官方匯出的 CSV 檔（穩），或分享連結（方便） */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-300 text-[13px] font-medium">從 LighterPack 匯入</span>
              <Upload
                accept=".csv,text/csv"
                showUploadList={false}
                disabled={importing}
                beforeUpload={(file) => { handleImportFile(file); return false; }}
              >
                <button
                  type="button"
                  disabled={importing}
                  className="inline-flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200 hover:underline underline-offset-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                >
                  <UploadIcon size={12} />
                  {importing ? "解析中" : "上傳 CSV"}
                </button>
              </Upload>
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="貼上 lighterpack.com/r/xxxxxx"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onPressEnter={handleImportUrl}
                className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-9!"
              />
              <PillButton onClick={handleImportUrl} disabled={importing} className="h-9! shrink-0">解析</PillButton>
            </div>
            <span className="text-zinc-600 text-[11px] leading-relaxed">
              LighterPack 沒有公開 API，連結是靠它的 CSV 匯出網址讀取的。讀不到時請在 LighterPack 用 Share → Export to CSV 匯出檔案再上傳。
            </span>
          </div>

          {/* 先看過解析結果再決定寫進哪裡：欄位對不上時不會直接灌一堆垃圾進清單 */}
          {parsed && (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.08] p-3.5 flex flex-col gap-2 shrink-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-zinc-100 text-[13px] font-medium">解析到 {parsed.rows.length} 件</span>
                <span className="text-zinc-200 text-[13px] font-semibold tabular-nums">{fmtWeight(parsed.totalWeight)}</span>
              </div>
              <div className="text-zinc-400 text-[12px] leading-relaxed">
                {parsed.rows.slice(0, 5).map(r => r.name).join("、")}
                {parsed.rows.length > 5 ? ` …等 ${parsed.rows.length} 件` : ""}
              </div>
              {parsed.skipped > 0 && (
                <span className="text-zinc-500 text-[11px]">有 {parsed.skipped} 列沒有名稱，已略過</span>
              )}
              <div className="flex gap-2 mt-1">
                <PillButton variant="primary" disabled={busy} onClick={() => addRowsToTrip(parsed.rows)}>加入這趟清單</PillButton>
                <PillButton disabled={busy} onClick={() => saveRowsToCloset(parsed.rows)}>存入裝備櫃</PillButton>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-zinc-500 text-xs">裝備櫃（{closetItems.length} 件）</span>
              {closetItems.length > 0 && (
                <button
                  onClick={() => setSelectedClosetIds(
                    selectedClosetIds.size === closetItems.length
                      ? new Set()
                      : new Set(closetItems.map(i => i.id))
                  )}
                  className="text-violet-300 text-xs hover:text-violet-200 transition-colors cursor-pointer"
                >
                  {selectedClosetIds.size === closetItems.length ? "取消全選" : "全選"}
                </button>
              )}
            </div>

            {closetLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} title={false} />
            ) : closetItems.length === 0 ? (
              <div className="py-8 px-6 rounded-xl border border-dashed border-white/10 text-center text-zinc-500 text-[13px] leading-relaxed">
                櫃子還是空的。新增裝備時勾「同時存入我的裝備櫃」，或從上面匯入 LighterPack 清單。
              </div>
            ) : (
              <div className="flex flex-col gap-1 flex-1 min-h-[120px] overflow-y-auto pr-1">
                {closetItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2"
                  >
                    <Checkbox
                      checked={selectedClosetIds.has(item.id)}
                      onChange={() => setSelectedClosetIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                        return next;
                      })}
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-[13px] text-zinc-100 truncate">{item.name}</span>
                      {item.qty > 1 && <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">×{item.qty}</span>}
                      {item.category && [item.category].map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-md border shrink-0"
                          style={{ color: tagColor(tag), borderColor: `${tagColor(tag)}40`, background: `${tagColor(tag)}1a` }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[12px] text-zinc-400 tabular-nums shrink-0">
                      {item.weight_g == null ? "—" : fmtWeight(Number(item.weight_g))}
                    </span>
                    <button
                      onClick={() => handleDeleteClosetItem(item)}
                      aria-label="從裝備櫃移除"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PillButton
              variant="primary"
              disabled={selectedClosetIds.size === 0 || busy}
              onClick={() => addRowsToTrip(
                closetItems
                  .filter(i => selectedClosetIds.has(i.id))
                  .map(i => ({
                    name: i.name,
                    notes: i.notes ?? null,
                    image_url: i.image_url ?? null,
                    category: i.category ?? null,
                    weight_g: i.weight_g ?? null,
                    qty: i.qty,
                    weight_role: i.weight_role,
                  }))
              )}
              className="w-full h-10! mt-1 shrink-0"
            >
              加入這趟清單{selectedClosetIds.size > 0 ? `（${selectedClosetIds.size}）` : ""}
            </PillButton>
          </div>
        </div>
      </Modal>

      <Modal
        title="管理分類"
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        width={420}
      >
        <div className="flex flex-col gap-2 mt-6">
          <div className="text-zinc-500 text-[12px] leading-relaxed">
改名會把該分類底下所有裝備一起改掉；刪除只是把分類清空，裝備本身會留著。
          </div>
          <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto pr-1">
            {gridCells.map(([tag, v]) => {
              const untagged = tag === UNTAGGED;
              return (
                <div
                  key={tag}
                  className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tagColor(tag) }} />
                  {renamingTag === tag && deletingTag === null ? (
                    <Input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onPressEnter={() => handleRenameTag(tag)}
                      onBlur={() => { setRenamingTag(null); setRenameDraft(""); }}
                      className="rounded-lg! border-white/10! focus:border-violet-500! bg-white/5! text-white! h-7! flex-1"
                    />
                  ) : (
                    <span className={`text-[13px] truncate flex-1 min-w-0 ${untagged ? "text-zinc-500" : "text-zinc-100"}`}>
                      {tag}
                    </span>
                  )}
                  <span className="text-[12px] text-zinc-500 tabular-nums shrink-0">{v.count} 件</span>
                  {untagged ? (
                    // 「未分類」是沒有分類的裝備被歸出來的，不是真的分類，沒有東西可改可刪
                    <span className="text-[11px] text-zinc-600 shrink-0 w-14 text-center">—</span>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setRenamingTag(tag); setRenameDraft(tag); }}
                        disabled={deletingTag !== null}
                        aria-label={`重新命名分類 ${tag}`}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <EditIcon size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag, v.count)}
                        disabled={deletingTag !== null}
                        aria-label={`刪除分類 ${tag}`}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {deletingTag === tag ? <LoadingOutlined style={{ fontSize: 12 }} /> : <TrashIcon size={13} />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
            <CarabinerIcon size={32} stroke="#8b5cf6" strokeWidth={1.5} />
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

/** 分類 / 公裝標記 / 重量身份 / 揹負者：卡片與列表共用，兩邊顯示規則不會走鐘 */
function GearMeta({ item }: { item: GearItem }) {
  const dim = item.is_checked;
  const role = ROLES.find(r => r.value === item.weight_role);
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {item.scope === "group" && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border shrink-0 ${dim ? 'text-zinc-600 border-zinc-700/50' : 'text-amber-300 border-amber-500/25 bg-amber-500/10'}`}>
          公裝
        </span>
      )}
      {item.category && [item.category].map(tag => (
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
