"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@/app/components/Icons";

const LINKS = [
  { href: "/admin", label: "總覽" },
  { href: "/admin/activity", label: "異動" },
  { href: "/admin/logins", label: "來訪" },
  { href: "/admin/ai", label: "AI" },
  { href: "/admin/errors", label: "異常" },
  { href: "/admin/storage", label: "儲存" },
  { href: "/admin/line", label: "LINE" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);

  /** 已經捲到底的那一側不淡出，否則停在最左時第一個項目會無緣無故被吃掉一角 */
  const syncFades = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.style.setProperty("--fade-l", el.scrollLeft > 4 ? "20px" : "0px");
    el.style.setProperty("--fade-r", el.scrollLeft < max - 4 ? "20px" : "0px");
  }, []);

  /*
    七個項目在手機上放不下（需要 427px，iPhone 14 只有 390），所以這一列可以橫向捲。
    但捲動之後 active 可能在畫面外，換頁就看不出自己在哪裡 —— 把它平滑捲到中間，
    和行程頁那排日期 chips 同一套動作，換頁時看得出指示往哪邊移動。

    用 scrollTo 而不是 scrollIntoView：後者會連垂直方向一起捲，頁面一載入就被往下推。
  */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) {
      const left = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
    syncFades();
  }, [pathname, syncFades]);

  useEffect(() => {
    window.addEventListener("resize", syncFades);
    return () => window.removeEventListener("resize", syncFades);
  }, [syncFades]);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-white/[0.06] bg-[#09090b]/70 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="回到旅程列表"
          className="admin-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 !bg-white/[0.06] !text-zinc-400 transition-all duration-200 hover:!bg-white/10 hover:!text-zinc-200"
        >
          <ChevronLeftIcon size={14} />
        </Link>

        {/* 主 guideline 的 Segmented Control：值同 globals.css 的 .cute-segmented，
            後台用 <Link> 走路由，套不到 antd 的 class，只能把同一組值抄過來。
            捲動放在內層，外框這顆 pill 才不會跟著被遮罩淡掉一角 */}
        <nav className="min-w-0 rounded-full border border-white/[0.05] bg-[#18181b]/85 p-1">
          <div
            ref={scroller}
            onScroll={syncFades}
            className="route-tabs flex overflow-x-auto overflow-y-hidden"
          >
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`admin-focus shrink-0 rounded-full px-3 py-[7px] text-[13px] font-semibold transition-colors ${
                    active ? "!bg-violet-500/20 !text-zinc-200" : "!text-zinc-500 hover:!text-zinc-400"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
