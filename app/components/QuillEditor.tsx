"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "antd";

type QuillRange = { index: number; length: number };
type QuillToolbar = { container?: HTMLElement };

type QuillLike = {
  format: (name: string, value: unknown) => void;
  formatText: (index: number, length: number, format: string, value: unknown, source: string) => void;
  getSelection: (focus?: boolean) => QuillRange | null;
  insertText: (index: number, text: string, format: string, value: string, source: string) => void;
  insertEmbed: (index: number, type: string, value: unknown, source: string) => void;
  setSelection: (index: number, length: number) => void;
  getModule: (name: string) => unknown;
};

/** Quill 內建的 table module 只有 API 沒有 UI，操作列全部要自己接 */
type QuillTableModule = {
  insertTable: (rows: number, columns: number) => void;
  getTable: () => unknown[];
} & Record<TableAction, () => void>;

type TableAction =
  | "insertRowAbove"
  | "insertRowBelow"
  | "insertColumnLeft"
  | "insertColumnRight"
  | "deleteRow"
  | "deleteColumn"
  | "deleteTable";

const TABLE_ACTIONS: { action: TableAction; label: string; danger?: boolean }[] = [
  { action: "insertRowAbove", label: "＋上列" },
  { action: "insertRowBelow", label: "＋下列" },
  { action: "insertColumnLeft", label: "＋左欄" },
  { action: "insertColumnRight", label: "＋右欄" },
  { action: "deleteRow", label: "刪列", danger: true },
  { action: "deleteColumn", label: "刪欄", danger: true },
  { action: "deleteTable", label: "刪表格", danger: true },
];

type ReactQuillInstance = { getEditor: () => QuillLike };

type QuillProps = {
  theme: string;
  value: string;
  onChange?: (value: string) => void;
  onChangeSelection?: () => void;
  modules: Record<string, unknown>;
  className: string;
  placeholder?: string;
  readOnly: boolean;
  forwardedRef?: React.Ref<ReactQuillInstance>;
};

/**
 * Quill 沒有內建分隔線，自己註冊一個輸出 <hr> 的 block embed；
 * table 是內建 module 但沒有 icon，一起補上。
 * 必須用 react-quill-new re-export 的同一個 Quill，否則會註冊到別的 registry。
 */
let formatsRegistered = false;
function registerCustomFormats(Quill: typeof import("quill").default) {
  if (formatsRegistered) return;
  formatsRegistered = true;

  const BlockEmbed = Quill.import("blots/block/embed") as typeof import("quill/blots/block").BlockEmbed;
  class DividerBlot extends BlockEmbed {
    static blotName = "divider";
    static tagName = "hr";
  }
  Quill.register("formats/divider", DividerBlot);

  const icons = Quill.import("ui/icons") as Record<string, string>;
  icons.divider =
    '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="3" y1="9" x2="15" y2="9"></line></svg>';
  icons.table =
    '<svg viewBox="0 0 18 18">' +
    '<rect class="ql-stroke" fill="none" x="3" y="4" width="12" height="10"></rect>' +
    '<line class="ql-stroke" x1="3" y1="8" x2="15" y2="8"></line>' +
    '<line class="ql-stroke" x1="9" y1="4" x2="9" y2="14"></line>' +
    "</svg>";
}

const ReactQuill = dynamic(
  async () => {
    const mod = await import("react-quill-new");
    registerCustomFormats(mod.Quill);
    const RQ = mod.default;
    /* next/dynamic 不會把 ref 轉發給 class component，包一層自己傳 */
    function QuillWithRef({ forwardedRef, ...props }: QuillProps) {
      return <RQ ref={forwardedRef as React.Ref<InstanceType<typeof RQ>>} {...(props as React.ComponentProps<typeof RQ>)} />;
    }
    return QuillWithRef;
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-[140px] w-full bg-white/[0.04] rounded-[14px] border border-white/[0.07] animate-pulse" />
    ),
  }
);

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  extraClass?: string;
  readOnly?: boolean;
}

const POP_WIDTH = 264;
const TABLE_POP_WIDTH = 156;
const GRID_MAX = 6;

export default function QuillEditor({ value, onChange, placeholder, extraClass = "", readOnly = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const tablePopRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<ReactQuillInstance | null>(null);
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [tablePos, setTablePos] = useState<{ top: number; left: number } | null>(null);
  const [gridSize, setGridSize] = useState({ rows: 0, cols: 0 });
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null);
  const [inTable, setInTable] = useState(false);
  const linkTargetRef = useRef<{ quill: QuillLike; range: QuillRange | null } | null>(null);
  const tableTargetRef = useRef<QuillLike | null>(null);

  const getQuill = useCallback((): QuillLike | null => {
    try {
      return quillRef.current?.getEditor() ?? null;
    } catch {
      return null;
    }
  }, []);

  const getTableModule = useCallback(
    (quill: QuillLike | null) => (quill?.getModule("table") as QuillTableModule | undefined) ?? null,
    []
  );

  /** 游標是否落在表格內 — 決定要不要展開表格操作列 */
  const syncTableState = useCallback(() => {
    const quill = getQuill();
    if (!quill) {
      setInTable(false);
      return;
    }
    const container = (quill.getModule("toolbar") as QuillToolbar | undefined)?.container;
    if (container) setToolbarEl(container);
    const table = getTableModule(quill);
    setInTable(!!table && !!table.getTable()[0]);
  }, [getQuill, getTableModule]);

  /** popover 對齊工具列上對應的那顆按鈕 */
  const popoverPosition = useCallback((quill: QuillLike, btnSelector: string, width: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    let top = 44;
    let left = 8;
    const toolbar = quill.getModule("toolbar") as QuillToolbar | undefined;
    const btn = toolbar?.container?.querySelector(btnSelector);
    if (btn) {
      const b = (btn as HTMLElement).getBoundingClientRect();
      const w = wrapper.getBoundingClientRect();
      top = b.bottom - w.top + 6;
      left = Math.max(8, Math.min(b.left - w.left, w.width - width - 8));
    }
    return { top, left };
  }, []);

  const openLinkRef = useRef<(quill: QuillLike, range: QuillRange | null) => void>(() => { });
  openLinkRef.current = (quill, range) => {
    linkTargetRef.current = { quill, range };
    const pos = popoverPosition(quill, ".ql-link", POP_WIDTH);
    if (!pos) return;
    setLinkUrl("");
    setTablePos(null);
    setLinkPos(pos);
  };

  const openTableRef = useRef<(quill: QuillLike) => void>(() => { });
  openTableRef.current = (quill) => {
    tableTargetRef.current = quill;
    const pos = popoverPosition(quill, ".ql-table", TABLE_POP_WIDTH);
    if (!pos) return;
    setGridSize({ rows: 0, cols: 0 });
    setLinkPos(null);
    setTablePos(pos);
  };

  // Close on outside click
  useEffect(() => {
    if (!linkPos && !tablePos) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (linkPos && popRef.current && !popRef.current.contains(target)) setLinkPos(null);
      if (tablePos && tablePopRef.current && !tablePopRef.current.contains(target)) setTablePos(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [linkPos, tablePos]);

  /* Snow 內建的 link tooltip 在 antd Modal 內會失效，改開自製的 link popover */
  const editModules = useMemo(() => ({
    table: true,
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }],
        ["link"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "divider", "table"],
        ["clean"],
      ],
      handlers: {
        link(this: { quill: QuillLike }, active: unknown) {
          if (!active) {
            this.quill.format("link", false);
            return;
          }
          openLinkRef.current(this.quill, this.quill.getSelection(true));
        },
        divider(this: { quill: QuillLike }) {
          const range = this.quill.getSelection(true);
          const index = range ? range.index : 0;
          this.quill.insertEmbed(index, "divider", true, "user");
          this.quill.setSelection(index + 1, 0);
        },
        table(this: { quill: QuillLike }) {
          this.quill.getSelection(true);
          openTableRef.current(this.quill);
        },
      },
    },
  }), []);

  function applyLink() {
    setLinkPos(null);
    const target = linkTargetRef.current;
    let href = linkUrl.trim();
    if (!target || !href) return;
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
    const { quill, range } = target;
    if (range && range.length > 0) {
      quill.formatText(range.index, range.length, "link", href, "user");
    } else {
      const index = range ? range.index : 0;
      quill.insertText(index, href, "link", href, "user");
      quill.setSelection(index + href.length, 0);
    }
  }

  function insertTable(rows: number, cols: number) {
    setTablePos(null);
    const table = getTableModule(tableTargetRef.current);
    if (!table) return;
    table.insertTable(rows, cols);
    syncTableState();
  }

  function runTableAction(action: TableAction) {
    const table = getTableModule(getQuill());
    if (!table) return;
    table[action]();
    syncTableState();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <ReactQuill
        forwardedRef={quillRef}
        theme={readOnly ? "bubble" : "snow"}
        value={value || ""}
        onChange={onChange}
        onChangeSelection={readOnly ? undefined : syncTableState}
        modules={readOnly ? { toolbar: false } : editModules}
        className={`custom-quill ${extraClass}`}
        placeholder={placeholder}
        readOnly={readOnly}
      />

      {/* 游標在表格裡才展開；掛進 Quill 工具列裡，位置自動跟著工具列走 */}
      {!readOnly && inTable && toolbarEl && createPortal(
        <div className="ql-table-actions">
          {TABLE_ACTIONS.map(({ action, label, danger }) => (
            <button
              key={action}
              type="button"
              className={danger ? "is-danger" : undefined}
              // 不能讓編輯器失焦，否則 Quill 找不到游標所在的儲存格
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runTableAction(action)}
            >
              {label}
            </button>
          ))}
        </div>,
        toolbarEl
      )}

      {!readOnly && linkPos && (
        <div
          ref={popRef}
          className="absolute z-50 rounded-xl border border-white/10 bg-[#18181b] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          style={{ top: linkPos.top, left: linkPos.left, width: POP_WIDTH }}
        >
          <div className="flex gap-1.5">
            <Input
              autoFocus
              placeholder="輸入連結網址"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onPressEnter={(e) => { e.preventDefault(); applyLink(); }}
              onKeyDown={(e) => { if (e.key === "Escape") setLinkPos(null); }}
            />
            <Button type="primary" onClick={applyLink}>插入</Button>
          </div>
        </div>
      )}

      {!readOnly && tablePos && (
        <div
          ref={tablePopRef}
          className="absolute z-50 rounded-xl border border-white/10 bg-[#18181b] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          style={{ top: tablePos.top, left: tablePos.left, width: TABLE_POP_WIDTH }}
          // 保留編輯器的游標，insertTable 需要它才知道插在哪
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: GRID_MAX * GRID_MAX }, (_, i) => {
              const rows = Math.floor(i / GRID_MAX) + 1;
              const cols = (i % GRID_MAX) + 1;
              const active = rows <= gridSize.rows && cols <= gridSize.cols;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${rows} 列 ${cols} 欄`}
                  onMouseEnter={() => setGridSize({ rows, cols })}
                  onClick={() => insertTable(rows, cols)}
                  className={`h-5 w-5 rounded-[3px] border transition-colors cursor-pointer ${active
                    ? "bg-violet-500/40 border-violet-400/60"
                    : "bg-white/[0.04] border-white/10 hover:border-white/25"
                    }`}
                />
              );
            })}
          </div>
          <div className="mt-2 text-center text-[11px] text-zinc-400">
            {gridSize.rows > 0 ? `${gridSize.rows} 列 × ${gridSize.cols} 欄` : "選擇表格大小"}
          </div>
        </div>
      )}
    </div>
  );
}
