"use client";

import { useState } from "react";
import { Typography, Input } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import PillButton from "@/app/components/PillButton";
import { LocationIcon, PlusIcon } from "@/app/components/Icons";

/**
 * 想去清單：還沒決定哪一天的地點。
 *
 * 放在時間軸上面而不是另開分頁 —— 這些東西的下一步就是被排進某一天，跨分頁就做不到
 * 「看著行程決定放哪天」這件事。
 *
 * 排進某一天的方式是把卡片拖到那一天（頂部那排黏著的日期也是放置目標，所以不必為了搆到
 * 畫面外的日子先捲半天）。
 */

export interface WishlistEntry {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  category: string | null;
}

interface Props {
  items: WishlistEntry[];
  readOnly?: boolean;
  /** 有東西正被拖到這一區上方 */
  dragOver?: boolean;
  onAdd: (title: string, location: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onDragStartItem?: (e: React.DragEvent, id: string, label: string) => void;
  onDragOverZone?: (e: React.DragEvent) => void;
  onDragLeaveZone?: () => void;
  onDropZone?: (e: React.DragEvent) => void;
}

export default function WishlistSection({
  items, readOnly, dragOver,
  onAdd, onRemove, onDragStartItem, onDragOverZone, onDragLeaveZone, onDropZone,
}: Props) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  // 唯讀分享頁上，沒有東西就整塊不出現
  if (readOnly && items.length === 0) return null;

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd(title.trim(), location.trim());
      setTitle("");
      setLocation("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`mb-5 rounded-2xl overflow-hidden transition-colors duration-150 ${
        dragOver
          ? "border-2 border-dashed border-violet-500/60 bg-violet-500/[0.07]"
          : "border border-white/8 bg-white/[0.02]"
      }`}
      onDragOver={onDragOverZone}
      onDragLeave={onDragLeaveZone}
      onDrop={onDropZone}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Typography.Text className="text-zinc-200 text-[14px] font-medium">想去</Typography.Text>
          {items.length > 0 && (
            <span className="text-[11px] text-zinc-500 bg-white/[0.06] rounded-full px-2 py-0.5">
              {items.length}
            </span>
          )}
        </span>
        <span className={`text-zinc-600 text-[11px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {items.length === 0 ? (
                <Typography.Text className="text-zinc-600 text-[12px] block mb-3">
                  還沒想好哪天去的地方先丟這裡，之後把它拖到某一天。
                </Typography.Text>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      draggable={!readOnly}
                      onDragStart={(e) => onDragStartItem?.(e, item.id, item.title)}
                      className={`rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 ${
                        readOnly ? "" : "cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-zinc-100 text-[14px] font-medium truncate">{item.title}</div>
                          {item.location && (
                            <div className="flex items-center gap-1 mt-0.5 text-zinc-500 text-[12px] min-w-0">
                              <LocationIcon size={11} />
                              <span className="truncate">{item.location}</span>
                            </div>
                          )}
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() => onRemove(item.id)}
                            aria-label="刪除"
                            className="shrink-0 text-zinc-600 hover:text-red-400 text-[12px] transition-colors cursor-pointer px-1"
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!readOnly && (
                /* 只要名字就能存，地點可以直接貼 Google 連結；細節排進行程之後再補 */
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onPressEnter={submit}
                    placeholder="想去哪裡"
                    maxLength={80}
                  />
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onPressEnter={submit}
                    placeholder="地點或連結（可留空）"
                  />
                  <PillButton
                    size="md"
                    variant="primary"
                    onClick={submit}
                    disabled={!title.trim() || saving}
                    className="shrink-0"
                  >
                    <PlusIcon size={12} />
                    加入
                  </PillButton>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
