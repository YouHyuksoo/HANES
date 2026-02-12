"use client";

/**
 * @file src/app/page.tsx
 * @description HARNESS MES 랜딩페이지 - 시스템 소개 및 로그인/대시보드 진입점
 *
 * 초보자 가이드:
 * 1. **인증 상태 확인**: 로그인된 사용자는 대시보드로 자동 이동
 * 2. **Hero 섹션**: 시스템 소개 및 CTA 버튼
 * 3. **Features 섹션**: 주요 기능 하이라이트
 */

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import LandingHero from "./components/LandingHero";
import LandingFeatures from "./components/LandingFeatures";
import LandingFooter from "./components/LandingFooter";
import LandingHeader from "./components/LandingHeader";

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const handleNavigate = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader
        isAuthenticated={isAuthenticated}
        onNavigate={handleNavigate}
      />
      <LandingHero onNavigate={handleNavigate} isAuthenticated={isAuthenticated} />
      <LandingFeatures />
      <LandingFooter />
    </div>
  );
}
