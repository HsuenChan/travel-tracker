"use client";

import { useState } from "react";
import { Typography, Input } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { LocationIcon, PlusIcon, DreamCloudIcon } from "@/app/components/Icons";

/**
 * 想去清單：還沒決定哪一天的地點。
 *
 * 放在時間軸上面而不是另開分頁 —— 這些東西的下一步就是被排進某一天，跨分頁就做不到
 * 「看著行程決定放哪天」這件事。既然它只是暫存，就不該比行程本身還占版面：一行 chip，
 * 新增表單平常收起來。地點放在 chip 的 title 上，滑過去才看得到。
 *
 * 排進某一天的方式是把 chip 拖到那一天（頂部那排黏著的日期也是放置目標，所以不必為了搆到
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
  /** 點 chip 打開那一筆的完整內容；唯讀分享頁不給（那邊沒有編輯畫面） */
  onOpen?: (id: string) => void;
  onDragStartItem?: (e: React.DragEvent, id: string, label: string) => void;
  onDragOverZone?: (e: React.DragEvent) => void;
  onDragLeaveZone?: () => void;
  onDropZone?: (e: React.DragEvent) => void;
}

export default function WishlistSection({
  items, readOnly, dragOver,
  onAdd, onRemove, onOpen, onDragStartItem, onDragOverZone, onDragLeaveZone, onDropZone,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  // 唯讀分享頁上沒有東西就整塊不出現
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
      className={`mb-3 rounded-xl px-3 py-2 transition-colors duration-150 ${
        dragOver
          ? "border-2 border-dashed border-violet-500/60 bg-violet-500/[0.07]"
          : "border border-white/[0.07] bg-white/[0.02]"
      }`}
      onDragOver={onDragOverZone}
      onDragLeave={onDragLeaveZone}
      onDrop={onDropZone}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {/* 一個 icon 就說完它是什麼，不用一句話 */}
        <span className="shrink-0 flex items-center gap-1 text-zinc-500" title="想去清單">
          <DreamCloudIcon size={13} />
          <span className="text-[12px]">想去</span>
        </span>

        {items.length === 0 && !adding && (
          <Typography.Text className="text-zinc-700 text-[12px]">拖到某一天排入</Typography.Text>
        )}

        {items.map((item) => (
          <span
            key={item.id}
            draggable={!readOnly}
            onDragStart={(e) => onDragStartItem?.(e, item.id, item.title)}
            title={item.location ?? undefined}
            className={`group inline-flex items-center gap-1 h-7 rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 text-[12px] max-w-[190px] ${
              readOnly ? "pl-2.5 pr-2.5" : "pl-2.5 pr-1.5 cursor-grab active:cursor-grabbing hover:border-violet-500/40"
            }`}
          >
            {/*
              標題本身就是打開的入口 —— chip 上塞不下一顆「查看」，而使用者第一個會做的事
              就是點它。拖曳掛在外層，所以點與拖不會互相吃掉。
            */}
            <button
              type="button"
              onClick={() => onOpen?.(item.id)}
              disabled={!onOpen}
              className="inline-flex items-center gap-1 min-w-0 cursor-pointer disabled:cursor-default"
            >
              {item.location && <LocationIcon size={10} />}
              <span className="truncate">{item.title}</span>
            </button>
            {!readOnly && (
              <button
                onClick={() => onRemove(item.id)}
                aria-label={`刪除 ${item.title}`}
                className="w-4 h-4 rounded-full flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {!readOnly && (
          <button
            onClick={() => setAdding((v) => !v)}
            aria-label="加入想去清單"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed transition-colors cursor-pointer ${
              adding
                ? "border-violet-500/50 text-violet-300 bg-violet-500/10"
                : "border-white/15 text-zinc-600 hover:text-zinc-300 hover:border-white/30"
            }`}
          >
            <PlusIcon size={11} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {adding && !readOnly && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* 只要名字就能存，地點可以直接貼 Google 連結；細節排進行程之後再補 */}
            <div className="flex gap-1.5 pt-2">
              <Input
                autoFocus
                size="small"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onPressEnter={submit}
                placeholder="想去哪裡"
                maxLength={80}
              />
              <Input
                size="small"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onPressEnter={submit}
                placeholder="地點或連結"
              />
              <button
                onClick={submit}
                disabled={!title.trim() || saving}
                className="shrink-0 h-6 px-3 rounded-full text-[12px] font-medium bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                加入
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
