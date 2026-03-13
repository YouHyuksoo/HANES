"use client";

/**
 * @file src/app/(authenticated)/master/prod-line/page.tsx
 * @description 생산라인관리 → 공정관리 페이지로 리다이렉트
 */
import { redirect } from "next/navigation";

export default function ProdLinePage() {
  redirect("/master/process");
}
