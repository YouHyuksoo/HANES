"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 이전 경로 호환. 본 화면은 /quality/inspect-measurement-spec */
export default function InspectItemSpecRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/quality/inspect-measurement-spec");
  }, [router]);
  return null;
}
