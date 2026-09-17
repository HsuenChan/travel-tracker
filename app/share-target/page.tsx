import Link from "next/link";
import { parseShare, SOURCE_LABEL, type SharePayload } from "@/lib/sharedLink";
import SharePayloadCopy from "@/app/share-target/SharePayloadCopy";

export const metadata = { title: "收到分享 · Travel Tracker" };

/**
 * 系統分享的落點。
 *
 * 目前只把收到的東西原樣顯示出來 —— Android 各家 App 分享時放進哪個欄位、有沒有一起帶說明文字，
 * 官方文件查不到可靠答案，只能實測。確認 payload 的形狀之後，這一頁再接上「存進口袋名單」。
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
  const parsed = parseShare(payload);
  const empty = !payload.title && !payload.text && !payload.url;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">收到分享</h1>

      {empty ? (
        <p className="mt-4 text-[14px] leading-relaxed text-zinc-400">
          這一頁是給系統分享用的落點，直接打開不會有東西。
          在 IG 或 Threads 按分享、選 Travel Tracker，收到的內容就會出現在這裡。
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="text-[12px] font-semibold text-zinc-400">解析結果</div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="來源" value={SOURCE_LABEL[parsed.source]} />
              <Row label="網址" value={parsed.link} mono />
              <Row label="其餘文字" value={parsed.note || null} />
            </dl>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="text-[12px] font-semibold text-zinc-400">原始參數</div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="title" value={payload.title} mono />
              <Row label="text" value={payload.text} mono />
              <Row label="url" value={payload.url} mono />
            </dl>
          </div>

          <SharePayloadCopy payload={payload} />

          <p className="mt-5 text-[12px] leading-relaxed text-zinc-500">
            目前只是確認分享會帶什麼過來，還不會存進口袋名單。
            按上面的按鈕複製，把內容貼回對話裡就能接著做下一步。
          </p>
        </>
      )}

      <Link
        href="/"
        className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[13px] font-semibold text-zinc-300"
      >
        回到旅程列表
      </Link>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-zinc-500">{label}</dt>
      <dd className={`min-w-0 flex-1 break-all ${value ? "text-zinc-200" : "text-zinc-600"} ${mono ? "font-mono text-[12px]" : ""}`}>
        {value ?? "（沒有）"}
      </dd>
    </div>
  );
}
