"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spin, Typography, Button } from "antd";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "joining" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState("");

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

      if (res.ok) {
        router.push(`/trips/${data.tripId}`);
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Invalid invite link");
      }
    }

    join();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
      {status === "error" ? (
        <>
          <div className="text-4xl">🔗</div>
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
