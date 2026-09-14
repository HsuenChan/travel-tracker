import { Suspense } from "react";
import ActivityConsole from "@/app/components/admin/ActivityConsole";

export const metadata = { title: "異動紀錄 · Travel Tracker" };

export default function AdminActivityPage() {
  return (
    <Suspense fallback={<div className="admin-pulse mt-6 h-14 rounded-2xl bg-white/[0.03]" />}>
      <ActivityConsole />
    </Suspense>
  );
}
