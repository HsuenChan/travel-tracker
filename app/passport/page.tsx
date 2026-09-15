"use client";

import { useRouter } from "next/navigation";
import PassportView from "@/app/components/PassportView";

/**
 * 直接開 /passport 或重新整理時走這裡。
 *
 * 從首頁點進去的那條路會被 app/@passport/(.)passport 攔截、疊在首頁上面（首頁因此不會被卸載，
 * 地球與旅程資料都還在）。這一頁是攔不到的情況：底下沒有首頁，所以不做飛入飛出。
 */
export default function PassportPage() {
  const router = useRouter();
  return <PassportView animated={false} onDismiss={() => router.push("/")} />;
}
