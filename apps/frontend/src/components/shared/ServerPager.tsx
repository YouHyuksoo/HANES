"use client";

/**
 * @file src/components/shared/ServerPager.tsx
 * @description 서버 페이징 목록용 간단 페이저 — 현재상태 화면(보류중 목록, 실사 재고 등)이 전량을 받지 않고
 *              page/limit 로 나눠 조회할 때 DataGrid 툴바에 붙여 쓴다.
 *
 * 초보자 가이드:
 * 1. DataGrid 자체 페이지네이션은 "받은 데이터" 안에서만 동작한다. 서버 페이지 이동은 이 컴포넌트가 담당한다.
 * 2. 필터가 바뀌면 호출 측에서 page 를 1 로 리셋한다.
 *
 * 3. 서버 페이징 목록은 이 컴포넌트 하나만 쓴다(자재 모듈 11화면 적용, 2026-09-04).
 */

import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

export interface ServerPagerProps {
  page: number;
  /** 서버가 내려준 전체 건수 */
  total: number;
  /** 페이지당 건수 */
  limit: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function ServerPager({ page, total, limit, onPageChange, disabled, className = "" }: ServerPagerProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const canPrev = page > 1 && !disabled;
  const canNext = page < totalPages && !disabled;

  return (
    <div className={`flex items-center gap-1 text-sm text-text-muted whitespace-nowrap ${className}`}>
      <Button variant="ghost" size="sm" disabled={!canPrev} onClick={() => onPageChange(page - 1)} aria-label={t("common.serverPager.prev", "이전 페이지")}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span>
        {t("common.serverPager.summary", { page, totalPages, total: total.toLocaleString(), defaultValue: "{{page}} / {{totalPages}} 페이지 · 총 {{total}}건" })}
      </span>
      <Button variant="ghost" size="sm" disabled={!canNext} onClick={() => onPageChange(page + 1)} aria-label={t("common.serverPager.next", "다음 페이지")}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
