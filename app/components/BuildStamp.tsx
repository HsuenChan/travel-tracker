"use client";

import { useEffect, useState } from "react";
import { buildInfo, sinceBuild } from "@/lib/buildInfo";

/**
 * 現在線上跑的是哪一版。
 *
 * 放在使用者看得到的地方是為了回報問題：有人說畫面怪怪的時候，「你最下面寫什麼」
 * 比猜他什麼時候載入的快得多。分支名稱只給後台 —— 對外頁面沒必要透露工作分支怎麼取名。
 */
export default function BuildStamp({
  showBranch = false,
  className = "",
}: {
  showBranch?: boolean;
  className?: string;
}) {
  const info = buildInfo();
  const builtMs = info.builtAt?.getTime() ?? null;
  const [ago, setAgo] = useState<string | null>(null);

  // 相對時間等掛載後再算：伺服器算出「3 小時前」、瀏覽器算出「3 小時前」中間差的那幾秒會是 hydration mismatch
  useEffect(() => {
    if (builtMs === null) return;
    const tick = () => setAgo(sinceBuild(new Date(builtMs)));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [builtMs]);

  const stamp = info.builtAt
    ? new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(info.builtAt)
    : null;

  const parts: React.ReactNode[] = [];
  if (stamp) parts.push(<span key="at">部署於 {stamp}</span>);
  if (ago) parts.push(<span key="ago">{ago}</span>);
  if (info.shortSha) {
    parts.push(
      info.commitUrl ? (
        <a
          key="sha"
          href={info.commitUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono !text-zinc-500 underline decoration-white/15 underline-offset-2 transition-colors hover:!text-zinc-300"
        >
          {info.shortSha}
        </a>
      ) : (
        <span key="sha" className="font-mono">{info.shortSha}</span>
      )
    );
  }
  if (showBranch && info.branch) parts.push(<span key="ref" className="font-mono">{info.branch}</span>);
  parts.push(<span key="env" className="uppercase tracking-[0.08em]">{info.env}</span>);

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-zinc-600 ${className}`}>
      {parts.map((node, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          {node}
        </span>
      ))}
    </div>
  );
}
