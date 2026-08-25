"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Typography, Checkbox, Input, Button, App, Modal, Select, Skeleton, Upload } from "antd";
import PillButton from "./PillButton";
import { DeleteOutlined, EditOutlined, PictureOutlined, CloseOutlined, LoadingOutlined } from "@ant-design/icons";
import { PlusIcon, GiftIcon } from "@/app/components/Icons";

interface Souvenir {
  id: string;
  name: string;
  notes?: string;
  image_url?: string;
  tags?: string[];
  is_checked: boolean;
}

export default function SouvenirsTab({ tripId, readOnly = false }: { tripId: string, readOnly?: boolean }) {
  const [items, setItems] = useState<Souvenir[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlModal = searchParams.get("modal");
  const urlSouvenirId = searchParams.get("souvenirId");
  const [forceClosed, setForceClosed] = useState(false);
  const pushedModalRef = useRef(false);
  const showModal = !readOnly && !forceClosed && (urlModal === "addSouvenir" || urlModal === "editSouvenir");
  const editingItem = useMemo<Souvenir | null>(() => {
    if (urlModal !== "editSouvenir" || !urlSouvenirId) return null;
    return items.find(i => i.id === urlSouvenirId) ?? null;
  }, [urlModal, urlSouvenirId, items]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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
    const cacheKey = `travel_souvenirs_${tripId}`;
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

    const res = await fetch(`/api/souvenirs?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      localStorage.setItem(cacheKey, JSON.stringify(data.items));
      localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
    }
    setLoading(false);
  }

  useEffect(() => { load(false); }, [tripId]);

  // Modal 狀態進 URL：手機返回鍵可關閉，行為與行程/費用一致
  useEffect(() => {
    if (readOnly) return;
    if (urlModal === "addSouvenir" || urlModal === "editSouvenir") setForceClosed(false);
    if (urlModal === "editSouvenir" && editingItem) {
      setNewName(editingItem.name);
      setNewNotes(editingItem.notes || "");
      setNewImageUrl(editingItem.image_url || "");
      setNewTags(editingItem.tags || []);
    } else if (urlModal === "addSouvenir") {
      setNewName("");
      setNewNotes("");
      setNewImageUrl("");
      setNewTags([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlModal, editingItem?.id]);

  function openAdd() {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "addSouvenir");
    p.delete("souvenirId");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    pushedModalRef.current = true;
  }

  function openEdit(item: Souvenir) {
    if (readOnly) return;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set("modal", "editSouvenir");
    p.set("souvenirId", item.id);
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
    p.delete("souvenirId");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  async function handleSave() {
    if (!newName.trim()) {
      message.error("請輸入商品名稱");
      return;
    }
    setAdding(true);

    let res;
    if (editingItem) {
      res = await fetch(`/api/souvenirs`, {
        method: "PUT",
        body: JSON.stringify({ ...editingItem, name: newName, notes: newNotes, image_url: newImageUrl, tags: newTags }),
      });
    } else {
      res = await fetch(`/api/souvenirs`, {
        method: "POST",
        body: JSON.stringify({ tripId, name: newName, notes: newNotes, image_url: newImageUrl, tags: newTags }),
      });
    }

    setAdding(false);
    if (res.ok) {
      closeModal();
      load();
    } else {
      message.error(editingItem ? "儲存失敗" : "新增失敗");
    }
  }

  async function handleToggle(item: Souvenir) {
    if (readOnly) return;
    // optimistic，失敗回滾
    setItems((prev) => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    try {
      const res = await fetch(`/api/souvenirs`, {
        method: "PUT",
        body: JSON.stringify({ ...item, is_checked: !item.is_checked }),
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
      title: "確定刪除這項伴手禮嗎？",
      content: "刪除後無法恢復",
      okText: "刪除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setItems((prev) => prev.filter(i => i.id !== id));
        await fetch(`/api/souvenirs`, {
          method: "DELETE",
          body: JSON.stringify({ id }),
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 mx-auto pb-10">
      <div className="flex items-center justify-between px-1">
        <Typography.Text strong className="text-zinc-100 text-[15px]">伴手禮 & 購物清單</Typography.Text>
        {!readOnly && (
          <PillButton onClick={openAdd}>
            <PlusIcon size={13} />
            增加清單
          </PillButton>
        )}
      </div>

      {items.length > 0 && (() => {
        const done = items.filter(i => i.is_checked).length;
        const pct = Math.round((done / items.length) * 100);
        return (
          <div className="px-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-xs">已完成 {done} / {items.length}</span>
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

      {(() => {
        const usedTags = Array.from(new Set(items.flatMap(i => i.tags || [])));
        if (usedTags.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 pt-1 px-1">
            <button
              onClick={() => setTagFilter(null)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer border ${tagFilter === null
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/20"
                }`}
            >
              全部
            </button>
            {usedTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                className={`h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer border ${tagFilter === tag
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                  : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/20"
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        );
      })()}

      <Modal
        title={editingItem ? "編輯伴手禮" : "新增伴手禮"}
        open={showModal}
        onCancel={closeModal}
        afterClose={() => { setNewName(""); setNewNotes(""); setNewImageUrl(""); setNewTags([]); }}
        footer={null}
        destroyOnHidden
      >
        <div className="flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">商品名稱</Typography.Text>
            <Input
              placeholder="如：白色戀人"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! h-10!"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">圖片 (可選)</Typography.Text>
            {newImageUrl ? (
              <div className="relative w-24 h-24">
                <img src={newImageUrl} alt="伴手禮圖片" className="w-full h-full object-cover rounded-xl border border-white/10" />
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
            <Typography.Text className="text-zinc-400 text-sm">自訂標籤 (Tags)</Typography.Text>
            <Select
              mode="tags"
              placeholder="輸入標籤後按 Enter (例如：藥妝、幫代購)"
              value={newTags}
              onChange={setNewTags}
              className="cute-select custom-tags-select"
              options={
                Array.from(new Set(items.flatMap(i => i.tags || []))).map(tag => ({
                  value: tag,
                  label: tag
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">備註</Typography.Text>
            <Input.TextArea
              placeholder="數量、購買地點..."
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-violet-500! bg-white/5! text-white! min-h-[80px]!"
            />
          </div>
          <Button
            type="primary"
            onClick={handleSave}
            loading={adding}
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
              <div className="w-full h-24 bg-white/[0.03]" />
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
            <GiftIcon size={32} stroke="#8b5cf6" />
          </div>
          <div className="text-center">
            <div className="text-zinc-200 font-medium mb-1">尚未建立清單</div>
            <div className="text-zinc-500 text-xs px-10">在這裡記錄準備為自己與親友購買的伴手禮吧。</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items
            .filter(item => !tagFilter || (item.tags && item.tags.includes(tagFilter)))
            .sort((a, b) => Number(a.is_checked) - Number(b.is_checked))
            .map(item => (
            <div
              key={item.id}
              className={`flex flex-col rounded-2xl border transition-all overflow-hidden relative ${item.is_checked ? 'bg-white/5 border-white/5 opacity-60' : 'bg-white/10 border-white/10 shadow-lg'}`}
            >
              {/* Image Section */}
              {item.image_url ? (
                <div
                  className="w-full h-32 bg-zinc-800 relative cursor-pointer"
                  onClick={() => handleToggle(item)}
                >
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
                </div>
              ) : (
                <div
                  className="w-full h-24 flex items-center justify-center cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.04) 100%)' }}
                  onClick={() => handleToggle(item)}
                >
                  <GiftIcon size={32} stroke="rgba(139,92,246,0.3)" />
                </div>
              )}

              {/* Content Section */}
              <div className="p-3 flex items-start gap-3">
                <div className="pt-0.5" onClick={(e) => { if (!readOnly) e.stopPropagation(); }}>
                  <Checkbox
                    checked={item.is_checked}
                    onChange={() => handleToggle(item)}
                    disabled={readOnly}
                    className="scale-110"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col" onClick={() => handleToggle(item)}>
                  <span className={`text-[15px] font-bold transition-colors select-none truncate ${item.is_checked ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                    {item.name}
                  </span>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${item.is_checked ? 'text-zinc-600 border-zinc-700/50 bg-white/[0.01]' : 'text-violet-300 border-violet-500/20 bg-violet-500/10'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <span className={`text-[13px] mt-1 select-none line-clamp-2 leading-relaxed ${item.is_checked ? 'text-zinc-600' : 'text-zinc-400'}`}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
