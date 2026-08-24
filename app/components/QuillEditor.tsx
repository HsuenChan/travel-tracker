"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "antd";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="h-[140px] w-full bg-white/[0.04] rounded-[14px] border border-white/[0.07] animate-pulse" />
  ),
});

type QuillRange = { index: number; length: number };
type QuillToolbar = { container?: HTMLElement };

type QuillLike = {
  format: (name: string, value: unknown) => void;
  formatText: (index: number, length: number, format: string, value: unknown, source: string) => void;
  getSelection: (focus?: boolean) => QuillRange | null;
  insertText: (index: number, text: string, format: string, value: string, source: string) => void;
  setSelection: (index: number, length: number) => void;
  getModule: (name: string) => unknown;
};

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  extraClass?: string;
  readOnly?: boolean;
}

const POP_WIDTH = 264;

export default function QuillEditor({ value, onChange, placeholder, extraClass = "", readOnly = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const linkTargetRef = useRef<{ quill: QuillLike; range: QuillRange | null } | null>(null);

  const openLinkRef = useRef<(quill: QuillLike, range: QuillRange | null) => void>(() => { });
  openLinkRef.current = (quill, range) => {
    linkTargetRef.current = { quill, range };
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let top = 44;
    let left = 8;
    const toolbar = quill.getModule("toolbar") as QuillToolbar | undefined;
    const btn = toolbar?.container?.querySelector(".ql-link");
    if (btn) {
      const b = (btn as HTMLElement).getBoundingClientRect();
      const w = wrapper.getBoundingClientRect();
      top = b.bottom - w.top + 6;
      left = Math.max(8, Math.min(b.left - w.left, w.width - POP_WIDTH - 8));
    }
    setLinkUrl("");
    setLinkPos({ top, left });
  };

  // Close on outside click
  useEffect(() => {
    if (!linkPos) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setLinkPos(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [linkPos]);

  /* Snow 內建的 link tooltip 在 antd Modal 內會失效，改開自製的 link popover */
  const editModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }],
        ["link"],
        [{ list: "ordered" }, { list: "bullet" }],
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

  return (
    <div ref={wrapperRef} className="relative">
      <ReactQuill
        theme={readOnly ? "bubble" : "snow"}
        value={value || ""}
        onChange={onChange}
        modules={readOnly ? { toolbar: false } : editModules}
        className={`custom-quill ${extraClass}`}
        placeholder={placeholder}
        readOnly={readOnly}
      />
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
    </div>
  );
}
