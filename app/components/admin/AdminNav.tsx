"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@/app/components/Icons";

const LINKS = [
  { href: "/admin", label: "總覽" },
  { href: "/admin/activity", label: "異動" },
  { href: "/admin/logins", label: "存取" },
  { href: "/admin/ai", label: "AI" },
  { href: "/admin/errors", label: "異常" },
];

export default function AdminNav() {
  const pathname = usePathname();

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
            後台用 <Link> 走路由，套不到 antd 的 class，只能把同一組值抄過來 */}
        <nav className="inline-flex rounded-full border border-white/[0.05] bg-[#18181b]/85 p-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`admin-focus rounded-full px-3 py-[7px] text-[13px] font-semibold transition-colors ${
                  active ? "!bg-violet-500/20 !text-zinc-200" : "!text-zinc-500 hover:!text-zinc-400"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
