"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PassportView from "@/app/components/PassportView";

/**
 * 從首頁點開護照時走這裡：疊在首頁上面，首頁留在下面不卸載。
 *
 * 這是這個功能存在的理由 —— 地球的 WebGL context、航跡、相機角度與已經載好的旅程都原封不動，
 * 關掉護照回到首頁是零重繪。換路由的話那些全部要重來，地球會空一下。
 */
export default function InterceptedPassport() {
  const router = useRouter();
  /*
    整層淡入，不必先把首頁壓黑。飛入的封面起點就是首頁那本護照的位置，而那本現在還在底下沒被
    卸載 —— 淡入的前幾格看到的是同一個位置上的同一張封面，所以看不出交接。
  */
  return (
    <motion.div
      className="fixed inset-0 z-[150]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <PassportView animated onDismiss={() => router.back()} />
    </motion.div>
  );
}
