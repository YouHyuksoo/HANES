"use client";

/**
 * @file src/components/monitoring/BoardChrome.tsx
 * @description 모니터링 보드 공통 크롬 — 전광판(scoreboard) 스타일: 박스 없이 강한 상단 괘선과
 *              타이포 위계로 구획. 옵션바 + 자유 본문 + 하단 상태줄 + TV(전체화면) 모드.
 *
 * 초보자 가이드:
 * 1. 헤더: 좌측 타이틀(소형 대문자 트래킹) + 우측 시계/액션. 아래에 굵은 괘선(border-b-2).
 * 2. TV 모드: fixed inset-0 오버레이로 사이드바/헤더를 가리고 requestFullscreen 을 함께 호출.
 *    ESC 등으로 브라우저 전체화면이 풀려도 오버레이는 유지된다(버튼으로만 해제).
 * 3. children 이 본문 전체를 그린다 — 카드박스 대신 divide/hairline 으로 구획할 것.
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
          ? "fixed inset-0 z-50 bg-background flex flex-col overflow-hidden px-6 py-4"
          : "h-full flex flex-col overflow-hidden px-6 py-4 animate-fade-in"
      }
    >
      {/* 헤더 — 박스 없이 굵은 괘선으로 마감 */}
      <div className="flex items-end justify-between flex-shrink-0 pb-3 border-b-2 border-text/70">
        <h1 className="flex items-center gap-2.5 min-w-0">
          {icon}
          <span className="truncate text-base font-bold uppercase tracking-[0.14em] text-text">{title}</span>
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {optionBar}
          <Button variant="secondary" size="sm" onClick={toggleTvMode}>
            {tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* 본문 — 자유 레이아웃 (hairline 구획) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>

      {/* 하단 상태줄 — 얇은 괘선 위 작은 텍스트 */}
      <div className="flex items-center justify-between flex-shrink-0 pt-2 border-t border-border text-[11px] uppercase tracking-wider text-text-muted">
        <div className="flex items-center gap-3 min-w-0 truncate">{statusLeft}</div>
        <div className="flex items-center gap-3 shrink-0 normal-case tracking-normal">{statusRight}</div>
      </div>
    </div>
  );
}
