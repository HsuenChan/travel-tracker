"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "antd";

type QuillRange = { index: number; length: number };
type QuillToolbar = { container?: HTMLElement };
type QuillBlot = { length: () => number; statics?: { blotName?: string }; parent?: QuillBlot | null };
type QuillLine = QuillBlot;
type QuillOp = { insert?: string | Record<string, unknown>; attributes?: Record<string, unknown> };
type QuillDelta = { ops: QuillOp[] };

type QuillLike = {
  format: (name: string, value: unknown, source?: string) => void;
  formatLine: {
    (index: number, length: number, formats: Record<string, unknown>, source: string): void;
    (index: number, length: number, format: string, value: unknown, source: string): void;
  };
  formatText: (index: number, length: number, format: string, value: unknown, source: string) => void;
  updateContents: (delta: unknown, source: string) => void;
  getIndex: (blot: QuillBlot) => number;
  getSelection: (focus?: boolean) => QuillRange | null;
  insertText: (index: number, text: string, format: string, value: string, source: string) => void;
  insertEmbed: (index: number, type: string, value: unknown, source: string) => void;
  setSelection: (index: number, length: number) => void;
  getModule: (name: string) => unknown;
  getLine: (index: number) => [QuillLine | null, number];
  deleteText: (index: number, length: number, source: string) => void;
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

const COLLAPSE_CONTAINER = "collapse-container";
const COLLAPSE_TITLE = "collapse-title";
const COLLAPSE_BODY = "collapse";

function newCollapseId() {
  return `c-${Math.random().toString(36).slice(2, 8)}`;
}

/** 同一個折疊區塊的每一行都帶同一個 id，用來決定哪些行要收進同一個 <details> */
function collapseGroupId(blot: { domNode?: Node } | null | undefined) {
  const node = blot?.domNode;
  return node instanceof HTMLElement ? node.getAttribute("data-collapse") : null;
}

/**
 * Quill 沒有內建分隔線，自己註冊一個輸出 <hr> 的 block embed；
 * 軟換行（Shift+Enter）也沒有，一併補一個行內 <br>；
 * 折疊區塊是原生 <details>／<summary>，用 container blot 把同一組的行收在一起；
 * table 是內建 module 但沒有 icon，一起補上。
 * 必須用 react-quill-new re-export 的同一個 Quill，否則會註冊到別的 registry。
 */
let formatsRegistered = false;
let Delta: typeof import("quill-delta").default | null = null;
function registerCustomFormats(Quill: typeof import("quill").default) {
  if (formatsRegistered) return;
  formatsRegistered = true;
  Delta = Quill.import("delta");

  const BlockEmbed = Quill.import("blots/block/embed") as typeof import("quill/blots/block").BlockEmbed;
  class DividerBlot extends BlockEmbed {
    static blotName = "divider";
    static tagName = "hr";
  }
  Quill.register("formats/divider", DividerBlot);

  const { EmbedBlot } = Quill.import("parchment");
  class SoftBreakBlot extends EmbedBlot {
    static blotName = "softbreak";
    static tagName = "BR";
    /* 一定要帶 class：parchment 的 registry 對同一個 tagName 只認第一個註冊者，
       有 class 才不會蓋掉 Quill 內建那個長度 0 的 break（空行用的 <br>） */
    static className = "ql-softbreak";
  }
  Quill.register("formats/softbreak", SoftBreakBlot);

  const Block = Quill.import("blots/block") as typeof import("quill/blots/block").default;
  const Container = Quill.import("blots/container") as typeof import("quill/blots/container").default;

  type BlotContext = Parameters<InstanceType<typeof Container>["optimize"]>[0];

  class CollapseContainer extends Container {
    static blotName = COLLAPSE_CONTAINER;
    static tagName = "DETAILS";
    static className = "ql-collapse";

    /* container 預設會跟相鄰的同類合併，這裡限定只有同一組（同 id）才併 */
    checkMerge() {
      const next = this.next as CollapseContainer | null;
      if (!super.checkMerge() || !this.children.head || !next?.children.head) return false;
      return collapseGroupId(this.children.head) === collapseGroupId(next.children.head);
    }

    optimize(context: BlotContext) {
      super.optimize(context);
      /* 編輯器裡一律當展開狀態，open 只要出現就會被存進 HTML，直接拿掉 */
      if (this.domNode.hasAttribute("open")) this.domNode.removeAttribute("open");
      /* 不同組的行被擠進同一個 <details> 時切開（同 Quill table-row 的作法） */
      this.children.forEach((child) => {
        if (child.next == null || collapseGroupId(child) === collapseGroupId(child.next)) return;
        this.splitAfter(child).optimize({});
        this.prev?.optimize({});
      });
      /* <summary> 只能有一個而且要在最前面：第一行升級成標題，其餘標題降級成內容行
         （在標題行按 Enter 會切出第二個 <summary>，靠這裡轉成第一行內容） */
      this.children.forEach((child) => {
        const isTitle = child.statics.blotName === COLLAPSE_TITLE;
        if (child === this.children.head) {
          if (!isTitle) child.replaceWith(COLLAPSE_TITLE, collapseGroupId(child));
        } else if (isTitle) {
          child.replaceWith(COLLAPSE_BODY, collapseGroupId(child));
        }
      });
    }
  }

  class CollapseLine extends Block {
    static create(value?: unknown) {
      const node = super.create() as HTMLElement;
      node.setAttribute("data-collapse", typeof value === "string" && value ? value : newCollapseId());
      return node;
    }
    static formats(domNode: HTMLElement) {
      return domNode.getAttribute("data-collapse") || undefined;
    }
    format(name: string, value: unknown) {
      if (name === this.statics.blotName && typeof value === "string") {
        this.domNode.setAttribute("data-collapse", value);
      } else {
        super.format(name, value);
      }
    }
  }

  class CollapseTitle extends CollapseLine {
    static blotName = COLLAPSE_TITLE;
    static tagName = "SUMMARY";
    static className = "ql-collapse-title";

    constructor(...args: ConstructorParameters<typeof Block>) {
      super(...args);
      /* 點 <summary> 會觸發瀏覽器的開合，在編輯器裡只想把游標放進標題 */
      this.domNode.addEventListener("click", (e) => e.preventDefault());
    }
  }

  /* 內建的 <p> 是 tagName 註冊、這個是 className 註冊，registry 查 class 優先所以不會互相蓋掉 */
  class CollapseBody extends CollapseLine {
    static blotName = COLLAPSE_BODY;
    static tagName = "P";
    static className = "ql-collapse-body";
  }

  CollapseContainer.allowedChildren = [CollapseTitle, CollapseBody];
  CollapseTitle.requiredContainer = CollapseContainer;
  CollapseBody.requiredContainer = CollapseContainer;
  Quill.register(CollapseContainer);
  Quill.register(CollapseTitle);
  Quill.register(CollapseBody);

  const icons = Quill.import("ui/icons") as Record<string, string>;
  icons.divider =
    '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="3" y1="9" x2="15" y2="9"></line></svg>';
  icons.collapse =
    '<svg viewBox="0 0 18 18">' +
    '<polygon class="ql-fill" points="3,4 3,12 9,8"></polygon>' +
    '<line class="ql-stroke" x1="11" y1="5" x2="15" y2="5"></line>' +
    '<line class="ql-stroke" x1="11" y1="9" x2="15" y2="9"></line>' +
    '<line class="ql-stroke" x1="11" y1="13" x2="15" y2="13"></line>' +
    "</svg>";
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

/**
 * HTML 載回編輯器時，Quill 會對每個 <br> 補一個 \n（＝拆成新的區塊）：
 * 通用的 matchBlot 先把 <br class="ql-softbreak"> 轉成 softbreak embed，接著選擇器型的
 * matchBreak 才跑，看到結尾不是 \n 就補一個。這個 matcher 排在最後，把那個 \n 收掉，
 * 軟換行才不會在重新載入後又被拆成兩個 quote。
 */
function keepSoftBreak(node: Node, delta: QuillDelta): QuillDelta {
  if (!(node instanceof HTMLElement) || !node.classList.contains("ql-softbreak")) return delta;
  const ops = delta.ops ?? [];
  const last = ops[ops.length - 1];
  const prev = ops[ops.length - 2];
  const isSoftBreak = typeof prev?.insert === "object" && prev.insert !== null && "softbreak" in prev.insert;
  if (!Delta || last?.insert !== "\n" || !isSoftBreak) return delta;
  return new Delta(ops.slice(0, -1)) as unknown as QuillDelta;
}

/**
 * Shift+Enter：在同一個區塊裡換行（插入 <br>），而不是另起新段落／新的一行引言。
 * Quill 內建的 Enter binding 是 { key: "Enter", shiftKey: null }，有沒有按 Shift 都吃同一個
 * handler，所以要自己攔下來；自訂 binding 會排在內建的前面，先回傳非 true 就不會再往下跑。
 */
function insertSoftBreak(
  this: { quill: QuillLike },
  range: QuillRange,
  context: { format: Record<string, unknown> }
) {
  /* code block 的 \n 本來就是區塊內換行，而且 CodeBlock 不收 embed，交回 Quill 預設處理 */
  if (context.format["code-block"]) return true;

  const quill = this.quill;
  if (range.length > 0) quill.deleteText(range.index, range.length, "user");
  const [line, offset] = quill.getLine(range.index);
  /* 區塊結尾的 <br> 瀏覽器不會多畫一行，游標在行尾時要補第二個當行尾標記 */
  const atLineEnd = !line || offset >= line.length() - 1;
  quill.insertEmbed(range.index, "softbreak", true, "user");
  if (atLineEnd) quill.insertEmbed(range.index + 1, "softbreak", true, "user");
  quill.setSelection(range.index + 1, 0);
  return false;
}

/** 游標所在的折疊區塊（標題 + 所有內容行）在文件裡的範圍 */
function collapseRangeAt(quill: QuillLike, index: number): QuillRange | null {
  const [line] = quill.getLine(index);
  const container = line?.parent;
  if (!container || container.statics?.blotName !== COLLAPSE_CONTAINER) return null;
  return { index: quill.getIndex(container), length: container.length() };
}

/**
 * 整塊拆回普通段落。標題與內容行是兩種 blot，但一定要在同一次 formatLine 清掉 ——
 * 分兩次的話第一次結束後 optimize 會把下一行升級成標題，第二次就清不到它。
 */
function unwrapCollapse(quill: QuillLike, index: number) {
  const range = collapseRangeAt(quill, index);
  if (!range) return;
  quill.formatLine(range.index, range.length, { [COLLAPSE_TITLE]: false, [COLLAPSE_BODY]: false }, "user");
}

/**
 * 工具列的折疊按鈕：已經在折疊區塊裡就整塊拆掉，否則
 * 有選取 → 第一行當標題、其餘當內容；沒選取 → 游標那行拆成「標題 + 第一行內容」。
 */
function toggleCollapse(quill: QuillLike) {
  const range = quill.getSelection(true);
  if (!range || !Delta) return;
  if (collapseRangeAt(quill, range.index)) {
    unwrapCollapse(quill, range.index);
    return;
  }
  const [line, offset] = quill.getLine(range.index);
  /* 表格儲存格本身就是一行，套下去會把儲存格換掉 */
  if (line?.parent?.statics?.blotName === "table-row") return;

  const id = newCollapseId();
  if (range.length > 0) {
    quill.formatLine(range.index, range.length, COLLAPSE_BODY, id, "user");
    quill.formatLine(range.index, 0, COLLAPSE_TITLE, id, "user");
    quill.setSelection(range.index, range.length);
    return;
  }
  const rest = line ? Math.max(line.length() - offset - 1, 0) : 0;
  quill.updateContents(
    new Delta()
      .retain(range.index)
      .insert("\n", { [COLLAPSE_TITLE]: id })
      .retain(rest)
      .retain(1, { [COLLAPSE_BODY]: id }),
    "user"
  );
  quill.setSelection(range.index, 0);
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
    keyboard: {
      bindings: {
        softBreak: { key: "Enter", shiftKey: true, handler: insertSoftBreak },
        /* 折疊區塊的空行按 Enter 就跳出區塊，比照 Quill 內建的 blockquote／list */
        collapseExit: {
          key: "Enter",
          collapsed: true,
          format: [COLLAPSE_BODY],
          empty: true,
          handler(this: { quill: QuillLike }) {
            this.quill.format(COLLAPSE_BODY, false, "user");
          },
        },
        /* 標題行開頭按 Backspace → 整塊拆回普通段落 */
        collapseBackspace: {
          key: "Backspace",
          collapsed: true,
          offset: 0,
          format: [COLLAPSE_TITLE],
          handler(this: { quill: QuillLike }, range: QuillRange) {
            unwrapCollapse(this.quill, range.index);
          },
        },
      },
    },
    clipboard: { matchers: [["br", keepSoftBreak]] },
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }],
        ["link"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "collapse", "divider", "table"],
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
        collapse(this: { quill: QuillLike }) {
          toggleCollapse(this.quill);
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
