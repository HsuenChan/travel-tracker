"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { coverSpan, drawCoverInto, PAGE_W, PAGE_H } from "@/lib/passportPages";
import {
  teaserPlacement, writeFlag, writeSpan, ENTER_KEY,
  TEASER_WIDTH, TEASER_ROTATE, HIDDEN_BOTTOM, HIDDEN_LEFT, type Placement,
} from "@/lib/passportTransition";

/**
 * 首頁地球左下角那本護照。
 *
 * 畫的是護照封面本身（和書裡第一頁同一組繪圖），不是一個「像護照的圖示」。
 *
 * 點下去之後它**不會**在這裡飛 —— 飛行跑在 /passport，因為換路由時這一頁會被卸載。這裡只做
 * 一件事：把背景壓黑，護照原地不動，然後換頁。/passport 接手時畫的是同一張、同一個位置的
 * 封面，所以那一刀落在沒有動作的時候。
 */

/** 飛行途中會被放大到中央，先照那個尺寸畫才不會糊 */
const ART_WIDTH = 460;

/*
  hover 時往「護照自己的上方」抽出來，不是畫面的上方。

  框架組出來的 transform 是 translate 在 rotate 之前，所以 y 位移吃的是未旋轉的座標系 ——
  直接給 y 只會往畫面正上方跑。護照轉了 TEASER_ROTATE 度（順時針），它的上方在畫面上是
  (sinθ, -cosθ)，把位移拆到這兩軸上，看起來才像順著它自己的長邊被抽出來。
*/
const HOVER_LIFT = 44;
const LIFT_X = HOVER_LIFT * Math.sin((TEASER_ROTATE * Math.PI) / 180);
const LIFT_Y = -HOVER_LIFT * Math.cos((TEASER_ROTATE * Math.PI) / 180);

/** 壓黑的時間；換頁在這之後才發生，所以切過去時畫面已經是全黑加一本靜止的護照 */
const FADE_MS = 260;

interface Props {
  firstYear: number | null;
  lastYear: number | null;
  className?: string;
}

export default function PassportTeaser({ firstYear, lastYear, className }: Props) {
  const router = useRouter();
  const [art, setArt] = useState<string | null>(null);
  // 換頁那一刻要停在哪，存成狀態而不是 ref —— render 期間讀 ref 的值是不允許的
  const [place, setPlace] = useState<Placement | null>(null);

  useEffect(() => {
    let url: string | null = null;
    const canvas = document.createElement("canvas");
    drawCoverInto(canvas, coverSpan(firstYear, lastYear), ART_WIDTH);
    canvas.toBlob((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setArt(url);
    }, "image/png");

    // three 那包不小，先載好，換過去才不會卡在空白
    router.prefetch("/passport");

    return () => { if (url) URL.revokeObjectURL(url); };
  }, [firstYear, lastYear, router]);

  function launch() {
    if (place) return;
    setPlace(teaserPlacement());
    writeSpan(coverSpan(firstYear, lastYear));
    writeFlag(ENTER_KEY);
    window.setTimeout(() => router.push("/passport"), FADE_MS);
  }

  const leaving = place !== null;

  return (
    <>
      {/* 三層：外層定位與裁切、中層閒置浮動、內層 hover 抬起，分開才不會兩個動畫搶同一個 y */}
      <div
        className={className}
        style={{ bottom: -HIDDEN_BOTTOM, left: -HIDDEN_LEFT, opacity: leaving ? 0 : 1 }}
      >
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.button
            onClick={launch}
            aria-label="翻開旅遊護照"
            title="翻開旅遊護照"
            className="group cursor-pointer block"
            style={{ width: TEASER_WIDTH, rotate: TEASER_ROTATE }}
            whileHover={{ x: LIFT_X, y: LIFT_Y, scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <div
              className="relative rounded-[6px] overflow-hidden shadow-[0_14px_38px_rgba(0,0,0,0.6),0_0_26px_rgba(201,169,97,0.16)] ring-1 ring-[#c9a961]/25 transition-all duration-300 group-hover:ring-[#c9a961]/60 group-hover:shadow-[0_22px_60px_rgba(201,169,97,0.4)]"
              style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
            >
              {art ? (
                <img src={art} alt="" draggable={false} className="w-full h-full object-cover select-none" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#32244a] to-[#150e24]" />
              )}
            </div>
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {place && art && (
          <motion.div className="fixed inset-0 z-[200]" style={{ pointerEvents: "none" }}>
            <motion.div
              className="absolute inset-0 bg-[#09090b]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: FADE_MS / 1000, ease: "easeOut" }}
            />
            {/* 原地不動的一張複本：換頁之後 /passport 會從同樣的位置接著飛 */}
            <img
              src={art}
              alt=""
              className="absolute rounded-[6px] shadow-[0_14px_38px_rgba(0,0,0,0.6),0_0_26px_rgba(201,169,97,0.16)]"
              style={{
                left: place.left,
                top: place.top,
                width: place.width,
                height: place.height,
                transform: `rotate(${place.rotate}deg)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
