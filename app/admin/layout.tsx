import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/adminAuth";
import AdminNav from "@/app/components/admin/AdminNav";
import BuildStamp from "@/app/components/BuildStamp";

/**
 * 後台的門。
 *
 * 不是管理員一律 notFound()，不是 403 —— 403 等於告訴對方「這裡有東西，只是你進不去」。
 * 這道檢查放在 layout，底下三個頁面就不用各自再擋一次。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdminUser())) notFound();

  return (
    <div className="min-h-dvh bg-[#09090b] text-zinc-200 admin-surface">
      <div
        style={{ display: "none" }}
        dangerouslySetInnerHTML={{
          __html: `<!--
THESIS: 後台的第一個動作是打字，不是捲動。查詢列是主體，清單是查詢的回音；拒絕「反向時間軸＋角落篩選」那個人人都會做的排法。
OWN-WORLD: zinc #09090b 底、violet #a78bfa 主色、LINE Seed 字、pill 控制項；動作徽章四色 emerald 新增／violet 修改／rose 刪除／amber 還原。
STORY: 管理員帶著一個名字進來，打三個字找到那筆異動，看懂改了什麼欄位，按下還原。
FIRST VIEWPORT: 上三分之一是查詢列與語法 chips，下方是結果流；空查詢預設近 24 小時。還原按鈕長在事件列本身，不另開管理頁。
FORM: 查詢主控台，我排序中的第 5 個，surface seed 4214d2cf。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`,
        }}
      />
      <AdminNav />
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">{children}</main>
      <footer className="mx-auto mt-10 w-full max-w-5xl px-4 pb-10 sm:px-6">
        <BuildStamp showBranch className="border-t border-white/[0.05] pt-4" />
      </footer>
    </div>
  );
}
