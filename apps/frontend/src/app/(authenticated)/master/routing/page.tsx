"use client";

/**
 * @file src/app/(authenticated)/master/routing/page.tsx
 * @description 라우팅관리 → 생산라인관리 페이지로 리다이렉트
 */
import { redirect } from "next/navigation";

export default function RoutingPage() {
  redirect("/master/prod-line");
}
