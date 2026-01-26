/**
 * @file src/app/page.tsx
 * @description
 * 홈 페이지입니다.
 * 접속 시 대시보드로 리다이렉트합니다.
 *
 * 초보자 가이드:
 * 1. **redirect**: 서버 사이드에서 리다이렉트 수행
 * 2. **목적**: 루트 경로 접근 시 대시보드로 이동
 */

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
