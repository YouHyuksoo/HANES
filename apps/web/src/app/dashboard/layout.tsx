/**
 * @file src/app/dashboard/layout.tsx
 * @description
 * 대시보드 레이아웃입니다.
 * DashboardLayout 컴포넌트를 사용하여 사이드바, 헤더를 포함합니다.
 *
 * 초보자 가이드:
 * 1. **중첩 레이아웃**: /dashboard 하위 모든 페이지에 적용
 * 2. **DashboardLayout**: 사이드바 + 헤더 + 콘텐츠 구조
 */

import { DashboardLayout } from "@/components/layout";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
