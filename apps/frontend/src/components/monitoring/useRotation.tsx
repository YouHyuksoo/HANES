"use client";

/**
 * @file src/components/monitoring/useRotation.tsx
 * @description 보드 목록 자동 페이지 순환 훅 — 항목을 pageSize 로 나눠 intervalSec 마다 전환
 *
 * 초보자 가이드:
 * - TV 보드는 마우스 조작이 없으므로 넘치는 행을 자동 순환으로 보여준다.
 * - 페이지가 1개면 타이머를 걸지 않는다. paused 로 일시정지 가능.
 */
import { useState, useEffect, useMemo } from "react";

export function useRotation<T>(items: T[], pageSize: number, intervalSec: number, paused = false) {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [pageCount, page]);

  useEffect(() => {
    if (paused || pageCount <= 1) return;
    const id = window.setInterval(
      () => setPage((p) => (p + 1) % pageCount),
      Math.max(1000, intervalSec * 1000),
    );
    return () => window.clearInterval(id);
  }, [paused, pageCount, intervalSec]);

  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => items.slice(safePage * size, safePage * size + size),
    [items, safePage, size],
  );

  return { pageItems, page: safePage, pageCount };
}

/** 페이지 인디케이터(●○○ + n/m) — 상태바 우측용 */
export function RotationIndicator({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: pageCount }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === page ? "w-4 bg-primary" : "w-1.5 bg-border"
          }`}
        />
      ))}
      <span className="ml-1 tabular-nums font-medium text-text">
        {page + 1}/{pageCount}
      </span>
    </div>
  );
}
