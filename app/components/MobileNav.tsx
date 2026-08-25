"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface MobileNavTab {
  key: string;
  label: string;
  icon: ReactNode;
}

const BALL = 52;
const BOUNCE = "cubic-bezier(0.175, 0.885, 0.32, 1.275)";

/** 手機底部導航：active 分頁上方有一顆會滑動的 gooey 小球（參考 travel-app 的 BottomNav） */
export default function MobileNav({
  tabs,
  activeKey,
  onChange,
  className = "",
}: {
  tabs: MobileNavTab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const itemRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const [ballLeft, setBallLeft] = useState<number | null>(null);

  const update = useCallback(() => {
    const el = itemRefs.current.get(activeKey);
    if (!el) return;
    setBallLeft(el.offsetLeft + el.offsetWidth / 2 - BALL / 2);
  }, [activeKey]);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, tabs.length]);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-[400] ${className}`}
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "#1e1c28",
        filter: "url(#nav-goo)",
      }}
    >
      <div
        className="relative flex justify-around items-stretch h-[62px] px-1"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* 會跑的小球：與 bar 同色，經 gooey 濾鏡與 bar 融合 */}
        {ballLeft !== null && (
          <span
            className="absolute -top-[22px] rounded-full z-0 transition-[left] duration-500"
            style={{
              left: ballLeft,
              width: BALL,
              height: BALL,
              background: "#1e1c28",
              transitionTimingFunction: BOUNCE,
            }}
          />
        )}

        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => { itemRefs.current.set(tab.key, el); }}
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
              className="relative z-10 flex-1 flex flex-col items-center justify-center cursor-pointer"
            >
              <span
                className="flex items-center justify-center transition-all duration-500"
                style={{
                  transitionTimingFunction: BOUNCE,
                  transform: isActive ? "translateY(-20px)" : "none",
                  color: isActive ? "#a78bfa" : "#a1a1aa",
                }}
              >
                {tab.icon}
              </span>
              <span
                className="absolute bottom-3 text-[10px] font-medium transition-all duration-500"
                style={{
                  transitionTimingFunction: BOUNCE,
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? "none" : "translateY(8px)",
                  color: "#a78bfa",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* gooey 濾鏡定義 */}
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="0" height="0" className="absolute">
        <defs>
          <filter id="nav-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
    </nav>
  );
}
