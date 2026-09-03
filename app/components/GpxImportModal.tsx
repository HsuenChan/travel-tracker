"use client";

import { useState } from "react";
import { Modal, Upload, InputNumber, Tooltip } from "antd";
import PillButton from "./PillButton";
import { InfoIcon, UploadIcon, MountainIcon } from "@/app/components/Icons";
import { parseGpx, pickNodes, labelNode, type GpxTrack, type GpxNode } from "@/lib/gpx";

const CALIBRATION_HINT =
  "GPS 高度常有系統性偏差。若 guide book 或地圖標了某個點的海拔，把差值填在這裡，" +
  "所有節點會一起平移。例：軌跡最高點 735m、書上寫 820m 等高線 → 填 85。";

export interface ImportedWaypoint {
  name: string;
  elevation_m: number | null;
  legKm: number | null;
  lat: number;
  lng: number;
  notes: string | null;
}

/**
 * 讀 GPX 軌跡、挑出代表性節點，交給路線編輯器。
 *
 * 只回傳資料、不寫資料庫 —— 匯入結果注入編輯器的草稿，使用者仍要檢視並按儲存。
 * 這樣沿用既有的草稿保護、捨棄確認與儲存流程，也能先改名字與類型再存。
 */
export default function GpxImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: ImportedWaypoint[]) => void;
}) {
  const [track, setTrack] = useState<GpxTrack | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(8);
  const [calibration, setCalibration] = useState(0);

  function reset() {
    setTrack(null);
    setFileName("");
    setError(null);
    setNodeCount(8);
    setCalibration(0);
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseGpx(text);
      if (!parsed) {
        setError("這個檔案裡找不到軌跡點（trkpt）。GPX 需要至少兩個軌跡點。");
        setTrack(null);
        return;
      }
      setTrack(parsed);
      setFileName(file.name);
    } catch {
      setError("檔案讀取失敗，請確認是 GPX 檔。");
    }
  }

  const nodes: GpxNode[] = track ? pickNodes(track, nodeCount) : [];

  function handleConfirm() {
    if (!track) return;
    let prevKm = 0;
    const rows: ImportedWaypoint[] = nodes.map((n, i) => {
      const legKm = Math.round((n.km - prevKm) * 1000) / 1000;
      prevKm = n.km;
      return {
        name: labelNode(n, i + 1),
        elevation_m: n.ele === null ? null : Math.round(n.ele + calibration),
        legKm: i === 0 ? 0 : legKm,
        lat: Math.round(n.lat * 1e6) / 1e6,
        lng: Math.round(n.lng * 1e6) / 1e6,
        notes: calibration !== 0
          ? `座標與距離來自 GPX「${track.name ?? fileName}」；海拔為軌跡值 ${n.ele}m 加 ${calibration > 0 ? "+" : ""}${calibration}m 校正。`
          : `座標、海拔與距離來自 GPX「${track.name ?? fileName}」。`,
      };
    });
    onImport(rows);
    reset();
  }

  return (
    <Modal
      title="匯入 GPX 軌跡"
      open={open}
      onCancel={() => { reset(); onClose(); }}
      footer={null}
      destroyOnHidden
      centered
      width={560}
    >
      <div className="flex flex-col gap-4 mt-6">
        <Upload
          accept=".gpx,application/gpx+xml,text/xml"
          showUploadList={false}
          beforeUpload={(file) => { handleFile(file); return false; }}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] text-violet-300 hover:text-violet-200 hover:underline underline-offset-2 transition-colors cursor-pointer"
          >
            <UploadIcon size={13} />
            {track ? "換一個 GPX 檔" : "選擇 GPX 檔"}
          </button>
        </Upload>

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300 leading-relaxed">
            {error}
          </div>
        )}

        {track && (
          <>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 flex flex-col gap-2">
              <div className="text-zinc-100 text-[13px] font-medium truncate">
                {track.name ?? fileName}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-3 text-[12px] tabular-nums">
                <Stat label="軌跡點" value={`${track.points.length}`} />
                <Stat label="距離" value={`${track.distanceKm.toFixed(2)} km`} />
                <Stat
                  label="海拔"
                  value={track.eleMin === null ? "無" : `${Math.round(track.eleMin)}–${Math.round(track.eleMax!)} m`}
                />
                <Stat label="累計升降" value={`↑${track.ascent} ↓${track.descent}`} />
              </div>
              {track.eleMin === null && (
                <div className="text-zinc-500 text-[11px] leading-relaxed">
                  這個檔案沒有海拔資料，節點會依距離等分挑選，海拔留空。
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400 text-[12px]">節點數</span>
                <InputNumber
                  min={2}
                  max={40}
                  precision={0}
                  value={nodeCount}
                  onChange={(v) => setNodeCount(Math.min(40, Math.max(2, v ?? 8)))}
                  style={{ width: 96 }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400 text-[12px] flex items-center gap-1">
                  海拔校正
                  <Tooltip title={CALIBRATION_HINT} trigger={["hover", "click"]} styles={{ root: { maxWidth: 320 } }}>
                    <span className="text-zinc-500 cursor-help"><InfoIcon size={11} /></span>
                  </Tooltip>
                </span>
                <InputNumber
                  step={5}
                  precision={0}
                  suffix="m"
                  disabled={track.eleMin === null}
                  value={calibration}
                  onChange={(v) => setCalibration(v ?? 0)}
                  style={{ width: 120 }}
                />
              </label>
              <span className="text-zinc-600 text-[11px] pb-2">
                實際挑出 {nodes.length} 個
              </span>
            </div>

            <div className="flex flex-col gap-1 max-h-[38vh] overflow-y-auto pr-1">
              {nodes.map((n, i) => (
                <div
                  key={`${n.km}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px]"
                >
                  <span className="text-zinc-600 tabular-nums w-4 shrink-0">{i + 1}</span>
                  <span className={`truncate flex-1 min-w-0 ${n.role ? "text-zinc-100" : "text-zinc-400"}`}>
                    {labelNode(n, i + 1)}
                  </span>
                  <span className="text-zinc-400 tabular-nums shrink-0">
                    {n.ele === null ? "—" : `${Math.round(n.ele + calibration)} m`}
                  </span>
                  <span className="text-zinc-600 tabular-nums shrink-0 w-16 text-right">
                    {n.km.toFixed(2)} km
                  </span>
                </div>
              ))}
            </div>

            <PillButton variant="primary" onClick={handleConfirm} className="w-full h-10!">
              <MountainIcon size={13} />
              加入 {nodes.length} 個途經點
            </PillButton>
            <span className="text-zinc-600 text-[11px] text-center -mt-2">
              會接在現有途經點之後，存檔前都還能改
            </span>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500 text-[11px]">{label}</div>
      <div className="text-zinc-200 font-semibold">{value}</div>
    </div>
  );
}
