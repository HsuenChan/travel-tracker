"use client";

import dynamic from "next/dynamic";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="h-[140px] w-full bg-white/[0.04] rounded-[14px] border border-white/[0.07] animate-pulse" />
  ),
});

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }],
    ["link"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  extraClass?: string;
  readOnly?: boolean;
}

export default function QuillEditor({ value, onChange, placeholder, extraClass = "", readOnly = false }: Props) {
  return (
    <ReactQuill
      theme={readOnly ? "bubble" : "snow"}
      value={value || ""}
      onChange={onChange}
      modules={readOnly ? { toolbar: false } : QUILL_MODULES}
      className={`custom-quill ${extraClass}`}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  );
}
