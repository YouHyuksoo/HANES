/**
 * @file src/app/pda/layout.tsx
 * @description PDA 전용 라우트 그룹 레이아웃 (PWA 지원)
 *
 * 초보자 가이드:
 * 1. (pda) 라우트 그룹: URL에 "pda" 포함 (/pda/menu, /pda/shipping 등)
 * 2. PdaAuthGuard: 미인증 시 /pda/login 리다이렉트
 * 3. PdaLayout: 사이드바 없는 모바일 최적화 레이아웃
 * 4. PWA manifest/viewport: 홈 화면 설치, standalone 앱 경험
 */
import type { Metadata, Viewport } from "next";
import PdaAuthGuard from "@/components/pda/PdaAuthGuard";
import PdaLayout from "@/components/pda/PdaLayout";

export const metadata: Metadata = {
  title: "HARNESS PDA",
  description: "HARNESS MES - PDA Scanner App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HARNESS PDA",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3B82F6",
};

export default function PdaRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PdaAuthGuard>
      <PdaLayout>{children}</PdaLayout>
    </PdaAuthGuard>
  );
}
