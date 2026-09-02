"use client";

/**
 * @file src/app/(authenticated)/equipment/status/page.tsx
 * @description 구 경로 호환 — 설비 가동현황은 /monitoring/equipment-board(설비가동 보드)로 이동했다.
 *              북마크/외부 링크를 위해 이 경로는 리다이렉트만 한다.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EquipStatusRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/monitoring/equipment-board");
  }, [router]);
  return null;
}
