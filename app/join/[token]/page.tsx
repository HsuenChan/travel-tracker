"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spin, Typography, Button, App } from "antd";
import { LinkBrokenIcon, UsersIcon } from "@/app/components/Icons";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { message: messageApi } = App.useApp();
  const [status, setStatus] = useState<"checking" | "joining" | "claim" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [tripId, setTripId] = useState<string>("");
  const [claimableNames, setClaimableNames] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    async function join() {
      const authRes = await fetch("/api/auth/status");
      const { authenticated } = await authRes.json();

      if (!authenticated) {
        window.location.href = `/api/auth/google?next=/join/${token}`;
        return;
      }

      setStatus("joining");
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Invalid invite link");
        return;
      }

      // Offer to claim a split-bill member identity before entering the trip.
      const names: string[] = data.claimableNames ?? [];
      if (!data.alreadyOwner && names.length > 0) {
        setTripId(data.tripId);
        setClaimableNames(names);
        setStatus("claim");
      } else {
        router.push(`/trips/${data.tripId}`);
      }
    }

    join();
  }, [token, router]);

  async function handleClaim(personName: string) {
    setClaiming(personName);
    try {
      const res = await fetch(`/api/trips/${tripId}/member-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_name: personName }),
      });
      if (res.ok) {
        router.push(`/trips/${tripId}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Someone claimed it first — drop it from the list and let the user re-pick.
        messageApi.warning("這個成員剛剛已被其他人認領");
        setClaimableNames((prev) => prev.filter((n) => n !== personName));
      } else {
        messageApi.error(data.error ?? "認領失敗，請稍後再試");
      }
    } finally {
      setClaiming(null);
    }
  }

  if (status === "claim") {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <UsersIcon size={24} stroke="#8b5cf6" />
        </div>
        <div className="text-center">
          <Typography.Text className="text-zinc-100 text-lg font-medium block mb-1">你是分帳名單中的哪一位？</Typography.Text>
          <Typography.Text className="text-zinc-500 text-sm">選擇後，這趟的支出就會對應到你的帳號</Typography.Text>
        </div>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          {claimableNames.map((name) => (
            <button
              key={name}
              disabled={!!claiming}
              onClick={() => handleClaim(name)}
              className="w-full h-12 rounded-2xl bg-white/[0.04] border border-white/10 text-zinc-100 text-[15px] font-medium hover:bg-white/[0.08] hover:border-violet-500/40 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {claiming === name ? <Spin size="small" /> : name}
            </button>
          ))}
        </div>
        <button
          disabled={!!claiming}
          onClick={() => router.push(`/trips/${tripId}`)}
          className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
        >
          略過，稍後再設定
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
      {status === "error" ? (
        <>
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <LinkBrokenIcon size={24} />
          </div>
          <Typography.Text className="text-red-500 text-base">{errorMsg}</Typography.Text>
          <Button onClick={() => router.push("/")}>返回首頁</Button>
        </>
      ) : (
        <>
          <Spin size="large" />
          <Typography.Text className="text-zinc-400">
            {status === "checking" ? "驗證身份中..." : "加入旅程中..."}
          </Typography.Text>
        </>
      )}
    </div>
  );
}
