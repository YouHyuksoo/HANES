/**
 * @file src/app/components/LandingFooter.tsx
 * @description 랜딩페이지 하단 푸터 - 저작권 및 시스템 정보
 *
 * 초보자 가이드:
 * 1. **간결한 푸터**: 시스템 이름과 저작권 정보만 표시
 * 2. **다크모드 지원**: CSS 변수 기반 색상 적용
 */

import { Factory } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="py-10 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/20 rounded-md flex items-center justify-center">
              <Factory className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-text">HARNESS MES</span>
          </div>
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} HARNESS. Manufacturing Execution System.
          </p>
        </div>
      </div>
    </footer>
  );
}
