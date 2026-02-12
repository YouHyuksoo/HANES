/**
 * @file src/app/(authenticated)/layout.tsx
 * @description 인증 필요 영역 레이아웃 - AuthGuard + MainLayout
 *
 * 초보자 가이드:
 * 1. **AuthGuard**: 미인증 사용자를 로그인 페이지로 리다이렉트
 * 2. **MainLayout**: 헤더 + 사이드바 + 콘텐츠 영역 구성
 * 3. **Route Group**: (authenticated)는 URL에 포함되지 않음
 */
import AuthGuard from "@/components/layout/AuthGuard";
import MainLayout from "@/components/layout/MainLayout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <MainLayout>{children}</MainLayout>
    </AuthGuard>
  );
}
