import { PAGE_W, PAGE_H, coverDisplayHeight } from "@/lib/passportPages";

/**
 * 首頁與 /passport 之間的護照過場。
 *
 * 動畫跑在**目的頁**，不是出發頁 —— 換路由時出發頁會被卸載，動畫跑到一半就沒了。所以切換的
 * 那一刻兩邊畫的是同一張靜止的封面（同位置、同角度、同尺寸），接縫落在沒有動作的時候，
 * 看起來才是連的。兩邊要對得上，座標就必須來自同一份定義，也就是這個檔案。
 */

/** 首頁左下角那本的尺寸與姿態 */
export const TEASER_WIDTH = 132;
export const TEASER_ROTATE = 30;
/** 只露出大約 60%，其餘壓在畫面外 */
export const HIDDEN_BOTTOM = 74;
export const HIDDEN_LEFT = 16;

export const SPAN_KEY = "travel_passport_span";
/** 從首頁進來 / 從護照回去，兩個方向各自的交棒旗標 */
export const ENTER_KEY = "travel_passport_enter";
export const RETURN_KEY = "travel_passport_return";

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

export function readFlag(key: string): boolean {
  try {
    if (sessionStorage.getItem(key) !== "1") return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function writeFlag(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // 存不進去就只是少了過場，兩邊各自還是完整的畫面
  }
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
