"use client";

/**
 * @file src/app/components/LandingFeatures.tsx
 * @description 랜딩페이지 주요 기능 소개 섹션
 *
 * 초보자 가이드:
 * 1. **Feature Cards**: 6개 핵심 기능을 카드 형태로 소개
 * 2. **아이콘**: lucide-react 아이콘 사용
 * 3. **반응형 그리드**: 모바일 1열 → 태블릿 2열 → 데스크톱 3열
 */

import {
  Scissors,
  Plug,
  Factory,
  ScanLine,
  Shield,
  Truck,
} from "lucide-react";

const features = [
  {
    icon: Scissors,
    title: "절단공정",
    description: "전선 절단 작업지시부터 실적 관리까지 자동화된 공정 관리",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Plug,
    title: "압착공정",
    description: "단자 압착 품질관리 및 금형 수명 모니터링 체계",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Factory,
    title: "조립생산",
    description: "하네스 조립 라인별 생산실적 및 반제품 재공 관리",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    icon: ScanLine,
    title: "통전검사",
    description: "검사기 연동을 통한 자동 합/부 판정 및 이력 관리",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    icon: Shield,
    title: "품질관리",
    description: "IQC/OQC 검사, 불량 분석, LOT별 추적성 조회",
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  {
    icon: Truck,
    title: "출하관리",
    description: "포장, 팔레트 적재, 출하 확정까지 원스톱 물류 관리",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];

export default function LandingFeatures() {
  return (
    <section className="py-20 lg:py-28 bg-surface/50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-text mb-4">
            하네스 제조의 <span className="text-primary">모든 공정</span>을 관리합니다
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            절단부터 출하까지, 와이어 하네스 제조에 특화된
            통합 생산관리 시스템
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="
                group p-6 rounded-xl
                bg-card border border-border
                hover:border-primary/30 hover:shadow-lg
                transition-all duration-300
              "
            >
              <div className={`
                w-11 h-11 rounded-lg flex items-center justify-center mb-4
                ${feature.color}
              `}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-text mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
