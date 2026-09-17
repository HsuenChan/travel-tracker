import { parseShare, type SharePayload } from "@/lib/sharedLink";
import ShareTargetClient from "@/app/share-target/ShareTargetClient";

export const metadata = { title: "存進口袋名單 · Travel Tracker" };

/**
 * 系統分享的落點。
 *
 * IG 分享出來只有一個網址（實測 title 與 url 都是空的，網址在 text 裡），內文與地點標籤
 * 得另外抓回來 —— 那段在 /api/share/extract。
 */
export default async function ShareTargetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s : null;
  };

  const payload: SharePayload = { title: one("title"), text: one("text"), url: one("url") };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">存進口袋名單</h1>
      <ShareTargetClient parsed={parseShare(payload)} />
    </div>
  );
}
