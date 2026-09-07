/**
 * 前端向 Google 要一顆 access token，用來把資料寫進使用者自己的 Google 帳號。
 *
 * 走 Google Identity Services 的 token client（點按鈕當下彈窗授權），而不是把 scope 掛在
 * Supabase 的 Google 登入上：本站登入拿到的 Google token 只活一小時、Supabase 換發 session
 * 時就掉了，而且加 scope 會讓所有既有登入都得重新授權一次。彈窗這條路不用存任何憑證，
 * 拿到的 token 也永遠是新的。
 *
 * scope 只要 drive.file —— 只能建立與讀寫這個 App 自己產生的檔案，碰不到雲端硬碟其他東西。
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            hint?: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

export type GoogleAuthErrorCode = "no_client_id" | "popup_blocked" | "cancelled" | "failed";

export class GoogleAuthError extends Error {
  code: GoogleAuthErrorCode;
  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

let cached: { token: string; expiresAt: number } | null = null;
let scriptPromise: Promise<void> | null = null;

/**
 * 提前把 GIS 載進來。彈窗必須算在使用者點擊的那個手勢裡，點下去才 await 一支外部 script
 * 有機會被瀏覽器當成主動彈窗擋掉，所以畫面掛載時就先載。
 */
export function preloadGoogleAuth(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** 授權失效時清掉，下一次匯出會重新彈窗 */
export function clearGoogleAccessToken() {
  cached = null;
}

export async function requestGoogleAccessToken(hint?: string): Promise<string> {
  // 留 1 分鐘餘裕，免得剛好在請求途中過期
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new GoogleAuthError("no_client_id", "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");

  await preloadGoogleAuth();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new GoogleAuthError("failed", "Google Identity Services is unavailable");

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      hint,
      callback: (res) => {
        if (!res.access_token) {
          reject(new GoogleAuthError("failed", res.error_description || res.error || "No access token"));
          return;
        }
        cached = { token: res.access_token, expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000 };
        resolve(res.access_token);
      },
      error_callback: (err) => {
        const type = err.type ?? "";
        if (type === "popup_failed_to_open") {
          reject(new GoogleAuthError("popup_blocked", "Authorization popup was blocked"));
        } else if (type === "popup_closed") {
          reject(new GoogleAuthError("cancelled", "Authorization was cancelled"));
        } else {
          reject(new GoogleAuthError("failed", err.message || type || "Authorization failed"));
        }
      },
    });
    client.requestAccessToken();
  });
}
