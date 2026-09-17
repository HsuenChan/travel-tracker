"use client";

import { useState } from "react";
import type { SharePayload } from "@/lib/sharedLink";

export default function SharePayloadCopy({ payload }: { payload: SharePayload }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = (["title", "text", "url"] as const)
      .map((k) => `${k}: ${payload[k] ?? "(none)"}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-4 w-full rounded-full bg-violet-500/20 px-4 py-2.5 text-[13px] font-semibold text-zinc-200 transition-colors hover:bg-violet-500/30"
    >
      {copied ? "已複製" : "複製原始參數"}
    </button>
  );
}
