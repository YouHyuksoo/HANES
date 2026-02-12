"use client";

/**
 * @file src/app/components/LandingHero.tsx
 * @description 랜딩페이지 히어로 섹션 - 메인 타이틀, 설명, CTA 버튼
 *
 * 초보자 가이드:
 * 1. **그라디언트 배경**: primary 색상 기반 그라디언트
 * 2. **CTA 버튼**: 인증 상태에 따라 대시보드/로그인으로 이동
 * 3. **반응형**: 모바일/데스크톱 레이아웃 대응
 */

import {
  ArrowRight,
  BarChart3,
  Zap,
  ShieldCheck,
} from "lucide-react";

interface LandingHeroProps {
  onNavigate: () => void;
  isAuthenticated: boolean;
}

export default function LandingHero({ onNavigate, isAuthenticated }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]
                        bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px]
                        bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8
                          bg-primary/10 text-primary rounded-full text-sm font-medium">
            <Zap className="w-3.5 h-3.5" />
            Manufacturing Execution System
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text
                         leading-tight tracking-tight mb-6">
            스마트한{" "}
            <span className="text-primary">생산관리</span>의
            <br />
            시작
          </h1>

          {/* Description */}
          <p className="text-lg text-text-muted max-w-xl mx-auto mb-10 leading-relaxed">
            와이어 하네스 제조 전 공정을 실시간으로 관리하고,
            데이터 기반 의사결정으로 생산성을 극대화하세요.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onNavigate}
              className="
                flex items-center gap-2 px-8 py-3.5
                bg-primary text-white rounded-xl
                text-base font-semibold
                hover:bg-primary-hover active:scale-[0.98]
                transition-all duration-200
                shadow-lg shadow-primary/25
              "
            >
              {isAuthenticated ? "대시보드로 이동" : "시작하기"}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold text-text">16+</span>
              </div>
              <span className="text-xs text-text-muted">관리 모듈</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold text-text">실시간</span>
              </div>
              <span className="text-xs text-text-muted">생산 모니터링</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold text-text">100%</span>
              </div>
              <span className="text-xs text-text-muted">추적성 보장</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
