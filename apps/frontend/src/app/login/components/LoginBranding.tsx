"use client";

/**
 * @file src/app/login/components/LoginBranding.tsx
 * @description 로그인 페이지 좌측 브랜딩 패널 - 애니메이션 배경 + 로고 + 연결 노드
 *
 * 초보자 가이드:
 * 1. **FloatingShape**: CSS 애니메이션으로 떠다니는 도형들
 * 2. **ConnectionNode**: 와이어 하네스를 상징하는 연결 노드 애니메이션
 * 3. **로고 펄스**: 중앙 로고에 glow 효과
 */

import { useTranslation } from "react-i18next";
import { Factory } from "lucide-react";

/** 떠다니는 도형 하나 */
function FloatingShape({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`absolute rounded-full pointer-events-none ${className ?? ""}`}
      style={style}
    />
  );
}

/** 연결 노드 (와이어 하네스 상징) */
function ConnectionNodes() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 500 700"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* 연결선들 */}
      <path
        d="M80 120 Q200 200 160 350 Q120 500 300 580"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.5"
        className="login-wire login-wire-1"
      />
      <path
        d="M420 80 Q350 180 380 320 Q410 460 250 600"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.5"
        className="login-wire login-wire-2"
      />
      <path
        d="M60 400 Q180 350 250 350 Q320 350 440 300"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        className="login-wire login-wire-3"
      />

      {/* 노드 포인트들 */}
      {[
        { cx: 80, cy: 120, delay: "0s" },
        { cx: 160, cy: 350, delay: "0.5s" },
        { cx: 300, cy: 580, delay: "1s" },
        { cx: 420, cy: 80, delay: "0.3s" },
        { cx: 380, cy: 320, delay: "0.8s" },
        { cx: 250, cy: 600, delay: "1.2s" },
        { cx: 250, cy: 350, delay: "0.6s" },
      ].map((node, i) => (
        <circle
          key={i}
          cx={node.cx}
          cy={node.cy}
          r="3"
          fill="rgba(255,255,255,0.3)"
          className="login-node"
          style={{ animationDelay: node.delay }}
        />
      ))}
    </svg>
  );
}

export default function LoginBranding() {
  const { t } = useTranslation();
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-primary relative flex-col justify-center items-center p-12 overflow-hidden">
      {/* 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-purple-700/80" />

      {/* 연결 노드 SVG */}
      <ConnectionNodes />

      {/* 떠다니는 도형들 */}
      <FloatingShape
        className="w-40 h-40 border border-white/10 login-float-slow"
        style={{ top: "8%", left: "5%" }}
      />
      <FloatingShape
        className="w-56 h-56 border border-white/[0.07] login-float-medium"
        style={{ bottom: "10%", right: "5%" }}
      />
      <FloatingShape
        className="w-20 h-20 bg-white/[0.04] login-float-fast"
        style={{ top: "25%", right: "15%" }}
      />
      <FloatingShape
        className="w-12 h-12 bg-white/[0.06] rounded-lg login-float-medium rotate-45"
        style={{ top: "60%", left: "10%" }}
      />
      <FloatingShape
        className="w-28 h-28 border border-white/[0.05] login-float-slow"
        style={{ bottom: "30%", left: "20%" }}
      />
      <FloatingShape
        className="w-8 h-8 bg-white/[0.08] login-float-fast"
        style={{ top: "15%", right: "35%", animationDelay: "1s" }}
      />
      <FloatingShape
        className="w-16 h-16 border border-white/[0.06] rounded-lg login-float-medium rotate-12"
        style={{ bottom: "20%", right: "30%", animationDelay: "2s" }}
      />

      {/* 중앙 콘텐츠 */}
      <div className="relative z-10 text-center text-white">
        {/* 로고 - 글로우 펄스 */}
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 bg-white/20 rounded-2xl login-glow" />
          <div className="relative w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl
                          flex items-center justify-center login-logo-breathe">
            <Factory className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-3 login-text-appear" style={{ animationDelay: "0.2s" }}>
          {t('auth.branding.title')}
        </h1>
        <p className="text-lg text-white/80 max-w-md login-text-appear" style={{ animationDelay: "0.4s" }}>
          {t('auth.branding.subtitle')}
        </p>
        <div className="w-12 h-0.5 bg-white/30 mx-auto my-4 login-line-expand" />
        <p className="text-sm text-white/60 login-text-appear" style={{ animationDelay: "0.6s" }}>
          {t('auth.branding.description')}
        </p>

        {/* 하단 스탯 배지 */}
        <div className="flex items-center justify-center gap-6 mt-10">
          {[
            { label: t('auth.branding.feature1'), delay: "0.8s" },
            { label: t('auth.branding.feature2'), delay: "1.0s" },
            { label: t('auth.branding.feature3'), delay: "1.2s" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full
                         text-xs text-white/70 login-text-appear"
              style={{ animationDelay: stat.delay }}
            >
              {stat.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
