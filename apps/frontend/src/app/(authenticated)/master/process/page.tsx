"use client";

/**
 * @file src/app/(authenticated)/master/process/page.tsx
 * @description 공정관리 → 생산라인관리 페이지로 리다이렉트
 */
import { redirect } from "next/navigation";

export default function ProcessPage() {
  redirect("/master/prod-line");
}
