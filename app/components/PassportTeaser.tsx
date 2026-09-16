"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { coverSpan, drawCoverInto, PAGE_W, PAGE_H } from "@/lib/passportPages";
import {
  writeSpan, TEASER_WIDTH, TEASER_ROTATE, HIDDEN_BOTTOM, HIDDEN_LEFT,
} from "@/lib/passportTransition";

/**
 * 首頁地球左下角那本護照。
 *
 * 畫的是護照封面本身（和書裡第一頁同一組繪圖），不是一個「像護照的圖示」。
 *
 * 點下去之後它**不會**在這裡飛 —— /passport 會被 app/@passport/(.)passport 攔截，疊在這一頁
 * 上面，而這一頁留在底下不卸載。飛行跑在那一層，起點就是這本護照現在的位置；因為它還在底下
 * 沒消失，淡入的前幾格看到的是同一個位置上的同一張封面，交接看不出來。
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

interface Props {
  firstYear: number | null;
  lastYear: number | null;
  className?: string;
}

export default function PassportTeaser({ firstYear, lastYear, className }: Props) {
  const router = useRouter();
  /*
    護照開著的時候把這本藏起來。

    現在首頁不會被卸載了，所以關閉時那本飛回左下角的封面，會和原地不動的這一本同時出現在
    畫面上 —— 兩本護照。用網址判斷：被攔截時網址仍然是 /passport，所以關閉動畫跑完、
    router.back() 之後才會換回來，剛好是飛行落地的那一刻，接上去看不出交接。
  */
  const hidden = usePathname() === "/passport";
  const [art, setArt] = useState<string | null>(null);

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
    // 載入中的封面要畫出一模一樣的那張，年份區間先留給它
    writeSpan(coverSpan(firstYear, lastYear));
    router.push("/passport");
  }

  return (
    /* 三層：外層定位與裁切、中層閒置浮動、內層 hover 抬起，分開才不會兩個動畫搶同一個 y */
    <div
      className={className}
      // visibility 而不是卸載：封面那張圖是 blob URL，重掛一次就要重畫重轉一遍
      style={{ bottom: -HIDDEN_BOTTOM, left: -HIDDEN_LEFT, visibility: hidden ? "hidden" : "visible" }}
    >
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.button
            onClick={launch}
            aria-label="翻開旅遊護照"
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
  );
}
