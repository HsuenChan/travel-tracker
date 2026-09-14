/**
 * 把 user agent 壓成一句人看得懂的裝置描述。
 *
 * 不做完整解析：登入紀錄要回答的是「這是不是我平常那台」，
 * 認得出作業系統與瀏覽器就夠了，認不出來就誠實顯示「未知裝置」。
 */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "未知裝置";

  const os =
    /iPhone/.test(ua) ? "iPhone" :
    /iPad/.test(ua) ? "iPad" :
    /Android/.test(ua) ? "Android" :
    /Macintosh|Mac OS X/.test(ua) ? "Mac" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" :
    null;

  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    null;

  if (os && browser) return `${os} · ${browser}`;
  return os ?? browser ?? "未知裝置";
}

/** 同一台裝置的粗略指紋，用來數「幾台裝置登入過」 */
export function deviceKey(ua: string | null | undefined): string {
  return describeDevice(ua);
}
