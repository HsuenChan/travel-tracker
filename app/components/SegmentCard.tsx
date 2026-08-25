"use client";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Dropdown } from "antd";
import { EditOutlined, DeleteOutlined, MoreOutlined } from "@ant-design/icons";
import VehicleIconChip from "./VehicleIconChip";
import { PlaneIcon } from "./Icons";
import { AIRPORT_TIMEZONES } from "@/lib/airports";

dayjs.extend(utc);
dayjs.extend(timezone);

function toTaiwanTime(date: string, time: string, fromIata: string): string | null {
  const tz = AIRPORT_TIMEZONES[fromIata];
  if (!tz || tz === "Asia/Taipei") return null;
  try {
    return dayjs.tz(`${date} ${time}`, tz).tz("Asia/Taipei").format("HH:mm");
  } catch {
    return null;
  }
}

export interface SegmentData {
  id: string;
  from_city: string;
  from_iata: string;
  to_city: string;
  to_iata: string;
  type: string;
  date: string;
  time: string;
  arrival_date?: string | null;
  arrival_time?: string | null;
  flight_no: string;
  aircraft: string;
}

/** 登機證式交通段落卡：trips 頁與分享頁共用 */
export default function SegmentCard({
  seg,
  onEdit,
  onDelete,
}: {
  seg: SegmentData;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const hasActions = !!(onEdit || onDelete);
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] px-4 py-[14px] mb-1">
      {/* Row 1: icon + meta pills + menu */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <VehicleIconChip type={seg.type} />
          {seg.flight_no && (
            <span className="text-[12px] text-zinc-500 bg-white/[0.04] border border-white/[0.07] rounded-md px-2 py-0.5">{seg.flight_no}</span>
          )}
          {seg.aircraft && (
            <span className="text-[12px] text-zinc-500 bg-white/[0.04] border border-white/[0.07] rounded-md px-2 py-0.5">{seg.aircraft}</span>
          )}
        </div>
        {hasActions && (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                ...(onEdit ? [{ key: "edit", icon: <EditOutlined />, label: "編輯", onClick: onEdit }] : []),
                ...(onEdit && onDelete ? [{ type: "divider" as const }] : []),
                ...(onDelete ? [{ key: "delete", icon: <DeleteOutlined />, label: "刪除", danger: true, onClick: onDelete }] : []),
              ],
            }}
          >
            <button
              aria-label="段落動作"
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300 transition-colors cursor-pointer shrink-0"
            >
              <MoreOutlined />
            </button>
          </Dropdown>
        )}
      </div>

      {/* Row 2: 出發 / 抵達 labels */}
      <div className="flex justify-between mb-1">
        <div className="text-[10px] text-blue-400 font-medium">出發</div>
        <div className="text-[10px] text-violet-400 font-medium">抵達</div>
      </div>

      {/* Row 3: cities + dashed connecting line (IATA inline) */}
      <div className="flex items-center mb-2">
        <div className="flex-shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-bold text-zinc-100 leading-tight">{seg.from_city}</span>
            {seg.from_iata && <span className="text-[11px] text-zinc-400 tracking-wider">{seg.from_iata}</span>}
          </div>
        </div>
        <div className="flex-1 flex items-center px-2">
          <div className="flex-1 border-t border-dashed border-white/10" />
          <span className="px-1.5 text-zinc-500 text-[12px] inline-flex items-center">{seg.type === "飛機" ? <PlaneIcon size={12} /> : "→"}</span>
          <div className="flex-1 border-t border-dashed border-white/10" />
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="flex items-baseline gap-1.5 justify-end">
            {seg.to_iata && <span className="text-[11px] text-zinc-400 tracking-wider">{seg.to_iata}</span>}
            <span className="text-[17px] font-bold text-zinc-100 leading-tight">{seg.to_city}</span>
          </div>
        </div>
      </div>

      {/* Row 4: times (taiwan time inline) */}
      <div className="flex justify-between items-start">
        <div>
          {seg.time ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {seg.date && <span className="text-[12px] text-zinc-500">{dayjs(seg.date).format("M/D")}</span>}
              <span className="text-[20px] font-bold text-zinc-200 leading-tight">{seg.time}</span>
              {seg.from_iata && (() => {
                const twTime = toTaiwanTime(seg.date, seg.time, seg.from_iata);
                return twTime ? <span className="text-[11px] text-zinc-400">台灣 {twTime}</span> : null;
              })()}
            </div>
          ) : (
            <div className="text-[20px] font-light text-zinc-700 leading-tight">—</div>
          )}
        </div>
        <div className="text-right">
          {seg.arrival_time ? (
            <div className="flex items-baseline gap-1.5 justify-end flex-wrap">
              {seg.to_iata && (() => {
                const twTime = toTaiwanTime(seg.arrival_date || seg.date, seg.arrival_time, seg.to_iata);
                return twTime ? <span className="text-[11px] text-zinc-400">台灣 {twTime}</span> : null;
              })()}
              <span className="text-[20px] font-bold text-zinc-200 leading-tight">{seg.arrival_time}</span>
              {(seg.arrival_date || seg.date) && (
                <span className="text-[12px] text-zinc-500">
                  {seg.arrival_date ? dayjs(seg.arrival_date).format("M/D") : dayjs(seg.date).format("M/D")}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[20px] font-light text-zinc-700 leading-tight">—</div>
          )}
        </div>
      </div>
    </div>
  );
}
