import { PAGE_W, PAGE_H, coverDisplayHeight } from "@/lib/passportPages";

/**
 * 首頁與 /passport 之間的護照過場。
 *
 * 護照是 intercepting route，疊在首頁上面而首頁不卸載，所以飛入的起點就是首頁那本護照當下的
 * 位置。兩層要對得上，座標就必須來自同一份定義，也就是這個檔案。
 */

/** 首頁左下角那本的尺寸與姿態 */
export const TEASER_WIDTH = 132;
export const TEASER_ROTATE = 30;
/** 只露出大約 60%，其餘壓在畫面外 */
export const HIDDEN_BOTTOM = 74;
export const HIDDEN_LEFT = 16;

export const SPAN_KEY = "travel_passport_span";

export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
}

/** 首頁左下角那本護照在畫面上的位置 */
export function teaserPlacement(): Placement {
  const width = TEASER_WIDTH;
  const height = width * (PAGE_H / PAGE_W);
  return {
    left: -HIDDEN_LEFT,
    top: window.innerHeight + HIDDEN_BOTTOM - height,
    width,
    height,
    rotate: TEASER_ROTATE,
  };
}

/** 攤開前停在畫面中央的那本 */
export function centrePlacement(tiltDeg: number): Placement {
  const height = coverDisplayHeight();
  const width = height * (PAGE_W / PAGE_H);
  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
    rotate: tiltDeg,
  };
}

export function readSpan(): string {
  try {
    return sessionStorage.getItem(SPAN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeSpan(span: string): void {
  try {
    sessionStorage.setItem(SPAN_KEY, span);
  } catch {
    // 同上
  }
}
