"use client";

import { useState, useEffect } from "react";
import { Typography, Checkbox, Input, Button, Popconfirm, Spin, App, Modal, Select } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Souvenir | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { message, modal } = App.useApp();

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/souvenirs?tripId=${tripId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [tripId]);

  function openAdd() {
    setEditingItem(null);
    setNewName("");
    setNewNotes("");
    setNewImageUrl("");
    setNewTags([]);
    setIsModalVisible(true);
  }

  function openEdit(item: Souvenir) {
    setEditingItem(item);
    setNewName(item.name);
    setNewNotes(item.notes || "");
    setNewImageUrl(item.image_url || "");
    setNewTags(item.tags || []);
    setIsModalVisible(true);
  }

  function closeModal() {
    setIsModalVisible(false);
    setEditingItem(null);
    setNewName("");
    setNewNotes("");
    setNewImageUrl("");
    setNewTags([]);
  }

  async function handleSave() {
    if (!newName.trim()) return;
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
    // optimistic
    setItems((prev) => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    await fetch(`/api/souvenirs`, {
      method: "PUT",
      body: JSON.stringify({ ...item, is_checked: !item.is_checked }),
    });
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
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between px-1">
        <Typography.Text strong className="text-zinc-100 text-[15px]">伴手禮 & 購物清單</Typography.Text>
        {!readOnly && (
          <Button
            type="primary"
            className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-full bg-purple-500 hover:bg-purple-600 text-white border-0 text-[13px] font-medium transition-colors cursor-pointer"
            onClick={openAdd}
          >
            <PlusIcon size={13} />
            增加清單
          </Button>
        )}
      </div>

      {(() => {
        const usedTags = Array.from(new Set(items.flatMap(i => i.tags || [])));
        if (usedTags.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 pt-1 px-1">
            <button
              onClick={() => setTagFilter(null)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer border ${tagFilter === null
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
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
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
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
        open={isModalVisible}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
        className="glass-modal"
      >
        <div className="flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">商品名稱</Typography.Text>
            <Input
              placeholder="如：白色戀人"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-purple-500! bg-white/5! text-white! h-10!"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Typography.Text className="text-zinc-400 text-sm">圖片網址 (可選)</Typography.Text>
            <Input
              placeholder="貼上圖片連結"
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-purple-500! bg-white/5! text-white! h-10!"
            />
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
              className="rounded-xl! border-white/10! hover:border-white/30! focus:border-purple-500! bg-white/5! text-white! min-h-[80px]!"
            />
          </div>
          <Button
            type="primary"
            onClick={handleSave}
            loading={adding}
            className="w-full rounded-xl! bg-purple-500! text-white! hover:bg-purple-600! border-none! h-10! font-medium! mt-2! cursor-pointer"
          >
            {editingItem ? "儲存" : "加入清單"}
          </Button>
        </div>
      </Modal>

      {loading ? (
        <div className="flex justify-center py-10"><Spin /></div>
      ) : items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-20 rounded-3xl border border-white/5 bg-white/2"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.05) 0%, transparent 70%)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <GiftIcon size={32} stroke="#a855f7" />
          </div>
          <div className="text-center">
            <div className="text-zinc-200 font-medium mb-1">尚未建立清單</div>
            <div className="text-zinc-500 text-xs px-10">在這裡記錄準備為自己與親友購買的伴手禮吧。</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.filter(item => !tagFilter || (item.tags && item.tags.includes(tagFilter))).map(item => (
            <div
              key={item.id}
              className={`flex flex-col rounded-[20px] border transition-all overflow-hidden relative ${item.is_checked ? 'bg-white/5 border-white/5 opacity-60' : 'bg-white/10 border-white/10 shadow-lg'}`}
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
                  style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(139,92,246,0.05) 100%)' }}
                  onClick={() => handleToggle(item)}
                >
                  <GiftIcon size={32} stroke="rgba(168,85,247,0.3)" />
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
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${item.is_checked ? 'text-zinc-600 border-zinc-700/50 bg-white/[0.01]' : 'text-purple-300 border-purple-500/20 bg-purple-500/10'}`}>
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
