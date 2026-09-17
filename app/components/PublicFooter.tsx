import BuildStamp from "@/app/components/BuildStamp";

const GUIDELINE_URL = "https://hsuenchan.github.io/travel-tracker/design_guideline.html";

/**
 * 對外頁面的頁尾。
 *
 * 中間那句不是法務用語，是實話：開啟分享連結會寫一筆 activity_log，含裝置與來源 IP，
 * 旅程擁有者在後台看得到。被記錄的人應該有機會知道這件事。
 */
export default function PublicFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`px-4 py-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-zinc-600">
      <span>Travel Tracker</span>
      <span aria-hidden>·</span>
      <span>開啟此連結會記錄裝置與來源 IP</span>
      <span aria-hidden>·</span>
      <a
        href={GUIDELINE_URL}
        target="_blank"
        rel="noreferrer"
        className="!text-zinc-500 underline decoration-white/15 underline-offset-2 transition-colors hover:!text-zinc-300"
      >
        設計規範
      </a>
      </div>
      <BuildStamp className="mt-1.5" />
    </footer>
  );
}
