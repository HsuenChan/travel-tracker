"use client";

import { useState } from "react";
import { Typography, Input, DatePicker } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import dayjs, { type Dayjs } from "dayjs";
import PillButton from "@/app/components/PillButton";
import { LocationIcon, PlusIcon, CalendarIcon } from "@/app/components/Icons";

/**
 * 想去清單：還沒決定哪一天的地點。
 *
 * 放在時間軸上面而不是另開分頁 —— 這些東西的下一步就是被排進某一天，跨分頁就做不到
 * 「看著行程決定放哪天」這件事。
 *
 * 不做拖曳排入。手機上要從一個可收合的區塊拖到很長的時間軸，體驗會很差，而這個 App 是
 * 手機優先；改成選日期，兩邊一樣快。
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
  /** 日期選擇器的預設落點：這趟的第一天 */
  defaultDate?: string | null;
  onAdd: (title: string, location: string) => Promise<void>;
  onSchedule: (id: string, date: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export default function WishlistSection({
  items, readOnly, defaultDate, onAdd, onSchedule, onRemove,
}: Props) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

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
    <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
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
                  還沒想好哪天去的地方先丟這裡，之後再排進某一天。
                </Typography.Text>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5"
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PillButton
                              onClick={() => setSchedulingId(schedulingId === item.id ? null : item.id)}
                            >
                              <CalendarIcon size={12} />
                              排入
                            </PillButton>
                            <button
                              onClick={() => onRemove(item.id)}
                              aria-label="刪除"
                              className="text-zinc-600 hover:text-red-400 text-[12px] transition-colors cursor-pointer px-1"
                            >
                              刪除
                            </button>
                          </div>
                        )}
                      </div>

                      {schedulingId === item.id && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <DatePicker
                            autoFocus
                            open
                            className="w-full"
                            placeholder="排到哪一天"
                            defaultValue={defaultDate ? dayjs(defaultDate) : undefined}
                            onChange={async (d: Dayjs | null) => {
                              if (!d) return;
                              setSchedulingId(null);
                              await onSchedule(item.id, d.format("YYYY-MM-DD"));
                            }}
                          />
                        </div>
                      )}
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
