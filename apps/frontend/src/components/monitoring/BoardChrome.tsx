"use client";

/**
 * @file src/components/monitoring/BoardChrome.tsx
 * @description 모니터링 보드 공통 크롬 — 옵션바 + 자유 본문 + 상태바 + TV(전체화면) 모드
 *
 * 초보자 가이드:
 * 1. MonitoringFrame 은 카드 그리드 전용이라, KPI+테이블+차트 같은 자유 레이아웃 보드는
 *    이 컴포넌트로 감싼다 (스타일은 MonitoringFrame 준용).
 * 2. TV 모드: fixed inset-0 오버레이로 사이드바/헤더를 가리고 requestFullscreen 을 함께 호출.
 *    ESC 등으로 브라우저 전체화면이 풀려도 오버레이는 유지된다(버튼으로만 해제).
 * 3. children 이 본문 전체를 그린다 — 스크롤 없이 flex 로 채우는 것을 권장.
 */
import { useState, useCallback, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui";

interface BoardChromeProps {
  title: string;
  icon?: ReactNode;
  /** 옵션바 우측 액션 영역 (TV 모드 버튼은 자동 추가) */
  optionBar?: ReactNode;
  /** 상태바 좌측 메시지 */
  statusLeft?: ReactNode;
  /** 상태바 우측 */
  statusRight?: ReactNode;
  children: ReactNode;
}

export default function BoardChrome({
  title, icon, optionBar, statusLeft, statusRight, children,
}: BoardChromeProps) {
  const [tvMode, setTvMode] = useState(false);

  const toggleTvMode = useCallback(() => {
    setTvMode((prev) => {
      const next = !prev;
      try {
        if (next) void document.documentElement.requestFullscreen?.();
        else if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        // 전체화면 미지원 환경에서는 오버레이만 적용
      }
      return next;
    });
  }, []);

  return (
    <div
      className={
        tvMode
          ? "fixed inset-0 z-50 bg-background flex flex-col overflow-hidden p-4 gap-3"
          : "h-full flex flex-col overflow-hidden p-4 gap-3 animate-fade-in"
      }
    >
      {/* 옵션바 행 */}
      <div className="flex items-center justify-between flex-shrink-0 rounded-xl border border-border bg-surface px-4 py-2.5">
        <h1 className="text-lg font-bold text-text flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {optionBar}
          <Button variant="secondary" size="sm" onClick={toggleTvMode}>
            {tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* 본문 — 자유 레이아웃 */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">{children}</div>

      {/* 상태메시지 행 */}
      <div className="flex items-center justify-between flex-shrink-0 rounded-xl border border-border bg-surface px-4 py-2 text-xs text-text-muted">
        <div className="flex items-center gap-3 min-w-0 truncate">{statusLeft}</div>
        <div className="flex items-center gap-3 shrink-0">{statusRight}</div>
      </div>
    </div>
  );
}
