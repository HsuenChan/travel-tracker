"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Spin, Typography, App } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { webglAvailable } from "@/lib/webgl";
import PillButton from "@/app/components/PillButton";
import {
  buildPages, drawPage, drawRecapCard, drawCoverInto, coverSpan,
  BOOK_TILT_DEG, PAGE_W, PAGE_H, type PageSpec,
} from "@/lib/passportPages";
import type { PassportData } from "@/lib/passport";
import {
  teaserPlacement, centrePlacement, readSpan, type Placement,
} from "@/lib/passportTransition";

/** 關閉時，攤開的書退場、封面在原地浮現的時間；之後才開始往左下角飛 */
const CLOSE_MS = 240;

/** three 只在真的要用 3D 書本時才載入 */
const PassportBook = dynamic(() => import("@/app/components/PassportBook"), { ssr: false });

/**
 * 會飛的封面。
 *
 * 首頁只負責把背景壓黑、護照原地不動，然後換頁；真正的飛行跑在這裡 —— 換路由時出發頁會被
 * 卸載，動畫放在那邊會跑到一半就斷掉。切過來的瞬間這塊畫的是同一張、同一個位置的封面，
 * 所以那一刀落在沒有動作的時候。關閉是同一套反過來跑。
 *
 * 位移與縮放都以中心為基準，和首頁那本繞中心旋轉的方式一致；用左上角當基準的話，旋轉的圓心
 * 會對不上，飛到一半會偏出去。
 */
function FlyingCover({
  span, from, to, onDone, fadeIn = false, delay = 0,
}: {
  span: string;
  from: Placement;
  to: Placement;
  onDone?: () => void;
  /** 關閉時用：封面先在原地淡入（代替「書闔起來」），等書退場了才開始飛 */
  fadeIn?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect：用 useEffect 的話會先畫一格空白 canvas，接起來就是閃一下
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.style.width = `${to.width}px`;
    canvas.style.height = `${to.height}px`;
    drawCoverInto(canvas, span, Math.max(from.width, to.width));
  }, [span, from.width, to.width, to.height]);

  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);

  return (
    <motion.canvas
      ref={ref}
      className="fixed rounded-[8px] z-[200] pointer-events-none shadow-[0_40px_120px_rgba(0,0,0,0.75),0_0_50px_rgba(201,169,97,0.22)]"
      style={{ left: to.left, top: to.top }}
      initial={{ x: dx, y: dy, scale: from.width / to.width, rotate: from.rotate, opacity: fadeIn ? 0 : 1 }}
      animate={{ x: 0, y: 0, scale: 1, rotate: to.rotate, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.82, ease: [0.22, 1, 0.36, 1], delay,
        opacity: { duration: 0.22, delay: 0 },
      }}
      onAnimationComplete={onDone}
    />
  );
}

/** 畫好的頁面存成 blob URL 而不是 dataURL：一頁 1408×2000 的 base64 是好幾 MB，十幾頁會吃爆記憶體 */
async function renderToUrl(page: PageSpec, data: PassportData, pageNo: number): Promise<string | null> {
  const canvas = document.createElement("canvas");
  await drawPage(canvas, page, data, pageNo);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png");
  });
}

interface Props {
  /**
   * 從首頁點進來的（intercepting route）才做飛入飛出；直接開網址或重新整理走的是獨立頁，
   * 底下沒有首頁可以飛回去，硬做動畫只會從一片黑裡冒出來。
   */
  animated: boolean;
  /** 關閉之後要去哪：疊在首頁上時是 router.back()，獨立頁是回首頁 */
  onDismiss: () => void;
}

export default function PassportView({ animated, onDismiss }: Props) {
  const { message: messageApi } = App.useApp();

  const [data, setData] = useState<PassportData | null>(null);
  const [pages, setPages] = useState<PageSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [exporting, setExporting] = useState(false);
  // null = 還沒判斷完；判斷完之前不要先畫平面版，免得閃一下又換成書
  const [use3D, setUse3D] = useState<boolean | null>(null);
  const [bookReady, setBookReady] = useState(false);

  /*
    過場：entering 是從首頁飛進來，leaving 是關起來飛回左下角。
    兩個方向的起訖都由 lib/passportTransition.ts 算，和首頁那本共用同一份座標。
  */
  const [flight, setFlight] = useState<{ from: Placement; to: Placement } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [landed, setLanded] = useState(false);
  // 首頁那本飛過來之前會把年份區間寫在這裡，這一邊才畫得出一模一樣的那張封面
  const [flightSpan, setFlightSpan] = useState("");

  useEffect(() => {
    setFlightSpan(readSpan());
    if (animated) {
      setFlight({ from: teaserPlacement(), to: centrePlacement(BOOK_TILT_DEG) });
    } else {
      setLanded(true);
    }
    // 只在掛載時決定一次，animated 是路由形態決定的、不會中途改變
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [closing, setClosing] = useState(false);

  /** 闔上之後才起飛：封面在中央出現，轉回首頁左下角，到位才換頁 */
  const startFly = useCallback(() => {
    setLeaving(true);
    setLanded(false);
    setFlight({ from: centrePlacement(BOOK_TILT_DEG), to: teaserPlacement() });
  }, []);

  /*
    關閉是兩段：先讓 3D 的書真的闔上（封面從左邊蓋回右邊、鏡頭收到闔起來的取景），
    闔完才開始飛走。少了第一段就是從一本攤開的書直接跳成一本闔著的，那一刀很明顯。
  */
  const dismiss = useCallback(() => {
    if (leaving || closing) return;
    // 獨立頁沒有首頁在底下可以飛回去，直接走
    if (!animated) { onDismiss(); return; }
    if (use3D) setClosing(true);
    else startFly();
  }, [leaving, closing, use3D, startFly, animated, onDismiss]);

  useEffect(() => {
    // 關掉動畫偏好的人不該被丟一本會翻的書；沒有 WebGL 的裝置則是根本畫不出來
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setUse3D(!reduced && webglAvailable());
  }, []);

  // key → blob URL，換頁時不重畫；unmount 時要 revoke，否則整本翻完會留十幾個 blob
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});
  urlsRef.current = urls;
  // 預載是逐頁 await 的，urlsRef 在中途還是上一次 render 的值；沒有這個集合，同一頁會被畫兩次，
  // 後到的那個 blob URL 直接被丟掉不會 revoke
  const renderingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchWithAuth("/api/passport");
        if (!res.ok) { if (alive) setLoading(false); return; }
        const { passport } = await res.json();
        // 字型沒載完就畫，量出來的字寬是 fallback 的，版面會歪掉
        if (document.fonts?.ready) await document.fonts.ready;
        if (!alive) return;
        setData(passport);
        setPages(buildPages(passport));
        setLoading(false);
      } catch {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    return () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
    };
  }, []);

  // 當前頁與前後各一頁先畫好，翻過去才不會閃一下空白。
  // 3D 書本自己管貼圖，這條路走的話同一頁會被畫兩次、記憶體也吃兩份，所以只在平面版跑
  useEffect(() => {
    if (use3D !== false || !data || pages.length === 0) return;
    let alive = true;
    (async () => {
      for (const offset of [0, 1, -1]) {
        const page = pages[index + offset];
        if (!page || urlsRef.current[page.key] || renderingRef.current.has(page.key)) continue;
        renderingRef.current.add(page.key);
        const url = await renderToUrl(page, data, index + offset + 1);
        if (!url) { renderingRef.current.delete(page.key); continue; }
        if (!alive) { URL.revokeObjectURL(url); return; }
        setUrls((prev) => ({ ...prev, [page.key]: url }));
      }
    })();
    return () => { alive = false; };
  }, [use3D, data, pages, index]);

  const go = useCallback((delta: number) => {
    setDirection(delta);
    setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + delta)));
  }, [pages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function handleExport() {
    const page = pages[index];
    if (!data || page?.kind !== "year") return;
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      await drawRecapCard(canvas, page.year, data);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) { messageApi.error("產生圖片失敗"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `travel-tracker-${page.year.year}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      messageApi.error("產生圖片失敗，請稍後再試");
    } finally {
      setExporting(false);
    }
  }

  /*
    過場圖層。書的第一張貼圖畫好之前都留著 —— 沒有它，封面會先消失、等書畫好再出現。
    關閉時則是飛到定位才換頁。
  */
  const span = data ? coverSpan(data.summary.firstYear, data.summary.lastYear) : flightSpan;
  const overlay = (
    <AnimatePresence>
      {flight && (!landed || !bookReady || leaving) && (
        <FlyingCover
          key={leaving ? "leaving" : "entering"}
          span={span}
          from={flight.from}
          to={flight.to}
          fadeIn={leaving}
          delay={leaving ? CLOSE_MS / 1000 : 0}
          onDone={() => {
            if (leaving) onDismiss();
            else setLanded(true);
          }}
        />
      )}
    </AnimatePresence>
  );

  // 一趟都沒有時 buildPages 還是會給封面／資料頁／里程，所以要看趟數而不是頁數 ——
  // 否則新使用者會翻到一本每一欄都是 0 的護照
  const empty = !data || data.summary.tripCount === 0;
  const page = !loading && !empty ? pages[index] : null;
  const url = page ? urls[page.key] : undefined;
  const isYear = page?.kind === "year";

  /*
    只有一個 return。

    載入中與載入後分成兩個 return 的話，{overlay} 在 React tree 裡的位置會不一樣 ——
    loading 一翻成 false，FlyingCover 就被卸載再掛載，整段飛行從左下角重跑一次。
    這就是「同一個動畫播兩次」的來源，所以外框與過場圖層必須從頭到尾是同一顆節點。
  */
  return (
    // h- 而不是 min-h-：底下的 flex-1 與 h-full 要有可解析的父高度才算得出來，
    // 用 min-height 的話高度是 auto，百分比高度會退回 auto、容器塌成 0
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      {/*
        背景整組包成一層，關閉時一起淡出 —— 疊在首頁上時，淡掉之後底下就是原封不動的地球。
        底色也在這一層而不是外框的 class 上，否則關閉時背景會是一塊不會淡的黑幕。
      */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: CLOSE_MS / 1000, ease: "easeOut" }}
      >
      <div className="absolute inset-0 bg-[#09090b]" />
      {/*
        星空：和首頁地球同一張貼圖（three-globe 的 night-sky），所以兩邊是同一片天，共用快取。

        用 screen 混色而不是直接降透明度 —— 那張圖幾乎整片是黑的、星點又小，壓透明度等於把
        星星一起壓掉，看起來就什麼都沒有。screen 會讓黑的部分完全不影響底色，只有星點加亮上來，
        再用 brightness 把星點推出來。載不到就退回純底色，只是少一層裝飾。
      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url(https://unpkg.com/three-globe/example/img/night-sky.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          mixBlendMode: "screen",
          filter: "brightness(1.45)",
          opacity: 0.9,
        }}
      />
      {/* 邊角壓暗：星空鋪滿之後，header 與按鈕列需要一點對比才讀得到 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(9,9,11,0) 0%, rgba(9,9,11,0.7) 100%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 15%, rgba(139,92,246,0.10) 0%, transparent 60%)" }}
      />
      {/* 首頁那本是會發光的，翻開之後也該留著這層暈光 */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 46% 42% at 50% 48%, rgba(201,169,97,0.16) 0%, transparent 72%)" }}
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      />
      </motion.div>

      {overlay}

      {/*
        關閉時整本書與周邊一起淡出，封面同時在原地浮現 —— 這一段就是「闔起來」。
        不退場的話，攤開的書會留在畫面上，跟飛走的那本變成兩本並行。
      */}
      <motion.div
        className="relative flex-1 flex flex-col min-h-0"
        animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 0.97 : 1 }}
        transition={{ duration: CLOSE_MS / 1000, ease: "easeOut" }}
      >
      {/* 與首頁、分享頁同一套 header：h-14、backdrop-blur，左邊 icon 加漸層 wordmark */}
      <header className="relative flex items-center justify-between backdrop-blur-md px-3! md:px-6 h-14 shrink-0 z-[100]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 shrink-0 drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]">
            <img src="/icon.svg" alt="" className="w-full h-full" />
          </div>
          <Typography.Text
            className="font-extrabold text-[16px] md:text-lg tracking-wider"
            style={{
              fontFamily: "var(--font-comfortaa)",
              background: "linear-gradient(90deg, #818cf8, #a78bfa, #2dd4bf)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Travel Tracker
          </Typography.Text>
        </div>
      </header>

      <div className="relative flex-1 flex items-center justify-center px-2 pb-1 min-h-0">
        {loading && !flight && <Spin size="large" />}

        {empty && !loading && (
          <div className="flex flex-col items-center justify-center gap-4 px-6">
            <Typography.Text className="text-zinc-400 text-base">還沒有旅程可以蓋章</Typography.Text>
            <Typography.Text className="text-zinc-600 text-[13px] text-center">
              建立第一趟旅程之後，這裡就會長出你的護照。
            </Typography.Text>
            <PillButton variant="primary" size="lg" onClick={onDismiss}>
              回到旅程
            </PillButton>
          </div>
        )}

        {/*
          攤開的書是橫的（兩頁寬），所以 3D 版把整個可用區域讓給它，由相機自己決定要框多大；
          平面版才需要綁單頁的比例與 420px 上限。
        */}
        {page && data && (
        <div
          // 3D 版用絕對定位鋪滿，不靠百分比高度 —— 平面版是靠 aspectRatio 從寬度反推高度的，
          // 3D 版沒有那個比例可用，一旦父高度算不出來就會整個塌掉
          className={use3D ? "absolute inset-0" : "relative w-full max-w-[420px] h-full max-h-[calc(100dvh-180px)]"}
          style={use3D ? undefined : { aspectRatio: `${PAGE_W} / ${PAGE_H}`, perspective: 1600 }}
          // 平面版點在護照以外的地方就離開；3D 版由書本自己用射線判斷
          onClick={use3D === false ? (e) => { if (e.target === e.currentTarget) dismiss(); } : undefined}
        >
          {use3D === null ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spin />
            </div>
          ) : use3D ? (
            <>
              <PassportBook
                pages={pages}
                data={data}
                index={index}
                onIndexChange={(next, dir) => { setDirection(dir); setIndex(next); }}
                onReady={() => setBookReady(true)}
                onDismiss={dismiss}
                closing={closing}
                onClosed={startFly}
                className="absolute inset-0 w-full h-full"
              />
            </>
          ) : (
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={page.key}
              custom={direction}
              className="absolute inset-0"
              style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
              initial={{ rotateY: direction > 0 ? 42 : -18, opacity: 0, x: direction > 0 ? 24 : -24 }}
              animate={{ rotateY: 0, opacity: 1, x: 0 }}
              exit={{ rotateY: direction > 0 ? -58 : 42, opacity: 0, x: direction > 0 ? -18 : 18 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.14}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70 && index < pages.length - 1) go(1);
                else if (info.offset.x > 70 && index > 0) go(-1);
              }}
            >
              {url ? (
                <img
                  src={url}
                  alt={page.label}
                  draggable={false}
                  className="w-full h-full object-contain rounded-xl shadow-[0_24px_70px_rgba(0,0,0,0.6)] select-none"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                  <Spin />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          )}

          {/*
            平面版才需要這兩塊點擊區：3D 書本整個表面都要能拖，點擊翻頁由它自己處理，
            蓋一層透明按鈕上去會把拖曳吃掉。
          */}
          {use3D === false && (
            <>
              <button
                aria-label="上一頁"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="hidden md:block absolute left-0 top-0 h-full w-1/3 cursor-w-resize disabled:cursor-default"
              />
              <button
                aria-label="下一頁"
                onClick={() => go(1)}
                disabled={index === pages.length - 1}
                className="hidden md:block absolute right-0 top-0 h-full w-1/3 cursor-e-resize disabled:cursor-default"
              />
            </>
          )}
        </div>
        )}
      </div>

      {page && (
        <div className="relative flex items-center justify-center gap-2.5 pb-4 px-4 shrink-0">
          <PillButton size="md" onClick={() => go(-1)} disabled={index === 0}>上一頁</PillButton>
          {isYear && (
            <PillButton variant="primary" size="md" onClick={handleExport} disabled={exporting}>
              {exporting ? "產生中…" : "存成圖片"}
            </PillButton>
          )}
          <PillButton size="md" onClick={() => go(1)} disabled={index === pages.length - 1}>下一頁</PillButton>
        </div>
      )}
      </motion.div>
    </div>
  );
}
