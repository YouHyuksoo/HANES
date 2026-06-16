"use client";

/**
 * @file src/components/monitoring/MonitoringFrame.tsx
 * @description 모니터링(사이니지) 화면 공통 프레임 — 스크롤 없이 한 화면, 자동 페이지 롤링
 *
 * 초보자 가이드:
 * 1. 상단 **옵션바 행**: 제목 + 우측 액션(optionBar: 설정/일시정지/새로고침 등)
 * 2. 중앙 **본문**: items 를 columns×rows 페이지로 나눠 한 화면에 꽉 채움(스크롤 없음).
 *    페이지가 여러 개면 rollingIntervalMs 마다 다음 페이지로 자동 전환(페이드).
 * 3. 하단 **상태메시지 행**: statusLeft(설명) + 페이지 인디케이터(●○○).
 *
 * 성능: 화면에 보이는 한 페이지(perPage)만 렌더하므로 설비가 수백 대여도 DOM 부담이 작다.
 * 롤링은 setInterval 1개만 사용하고, 페이지 전환은 CSS 페이드(GPU)로 처리한다.
 */
import { useState, useEffect, useMemo, type ReactNode } from "react";

interface MonitoringFrameProps<T> {
  title: string;
  icon?: ReactNode;
  /** 옵션바 우측 액션 영역 */
  optionBar?: ReactNode;
  /** 상태바 좌측 메시지 */
  statusLeft?: ReactNode;
  /** 상태바 우측(페이지 인디케이터 앞) */
  statusRight?: ReactNode;
  items: T[];
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  columns?: number;
  rows?: number;
  rollingIntervalMs?: number;
  /** true 면 롤링 정지 */
  paused?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

export default function MonitoringFrame<T>({
  title, icon, optionBar, statusLeft, statusRight,
  items, renderItem, itemKey,
  columns = 5, rows = 4, rollingIntervalMs = 8000,
  paused = false, loading = false, emptyMessage = "표시할 항목이 없습니다.",
}: MonitoringFrameProps<T>) {
  const perPage = Math.max(1, columns * rows);

  const pages = useMemo(() => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += perPage) out.push(items.slice(i, i + perPage));
    return out.length ? out : [[] as T[]];
  }, [items, perPage]);

  const [page, setPage] = useState(0);

  // 페이지 수가 줄면 현재 페이지를 범위 안으로 보정
  useEffect(() => {
    if (page >= pages.length) setPage(0);
  }, [pages.length, page]);

  // 자동 롤링 (페이지 2개 이상 + 일시정지 아님)
  useEffect(() => {
    if (paused || pages.length <= 1) return;
    const id = window.setInterval(() => {
      setPage((p) => (p + 1) % pages.length);
    }, Math.max(1000, rollingIntervalMs));
    return () => window.clearInterval(id);
  }, [paused, pages.length, rollingIntervalMs]);

  const safePage = Math.min(page, pages.length - 1);
  const current = pages[safePage] ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-3 animate-fade-in">
      {/* 옵션바 행 */}
      <div className="flex items-center justify-between flex-shrink-0 rounded-xl border border-border bg-surface px-4 py-2.5">
        <h1 className="text-lg font-bold text-text flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        <div className="flex items-center gap-2 shrink-0">{optionBar}</div>
      </div>

      {/* 본문 롤링 영역 — 스크롤 없음. flex 컨테이너로 만들어 grid 가 높이를 확실히 받게 한다 */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950 p-4 flex">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : current.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
            {emptyMessage}
          </div>
        ) : (
          <div
            key={safePage}
            className="flex-1 min-h-0 grid gap-3 animate-fade-in"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {current.map((item) => (
              <div key={itemKey(item)} className="min-h-0 min-w-0">
                {renderItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상태메시지 행 */}
      <div className="flex items-center justify-between flex-shrink-0 rounded-xl border border-border bg-surface px-4 py-2 text-xs text-text-muted">
        <div className="flex items-center gap-3 min-w-0 truncate">{statusLeft}</div>
        <div className="flex items-center gap-3 shrink-0">
          {statusRight}
          {pages.length > 1 && (
            <div className="flex items-center gap-1.5">
              {pages.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === safePage ? "w-4 bg-primary" : "w-1.5 bg-border"
                  }`}
                />
              ))}
              <span className="ml-1 tabular-nums font-medium text-text">
                {safePage + 1}/{pages.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
