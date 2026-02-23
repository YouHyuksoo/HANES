"use client";

/**
 * @file src/components/pda/PdaLayout.tsx
 * @description PDA 전용 레이아웃 - 사이드바 없음, 모바일 최적화
 *
 * 초보자 가이드:
 * 1. PC MES의 MainLayout과 달리 사이드바/탭바 없음
 * 2. viewport 메타 태그로 확대/축소 방지
 * 3. 전체 화면을 컨텐츠 영역으로 활용
 * 4. safe-area-inset 대응 (노치/홈바)
 */

interface PdaLayoutProps {
  children: React.ReactNode;
}

export default function PdaLayout({ children }: PdaLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* PDA 전용 컨텐츠 영역 - 사이드바 없이 전체 화면 */}
      <main className="flex flex-col min-h-screen">{children}</main>
    </div>
  );
}
