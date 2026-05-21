"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShareRedirect({ steamid }: { steamid: string }) {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("wishscore_steamid", steamid);
    router.replace("/");
  }, [steamid, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1923]">
      <p className="text-[#8ba3b5] text-sm">WishScore へリダイレクト中...</p>
    </div>
  );
}
