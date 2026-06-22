"use client";

/**
 * @file components/shared/FilterBar.tsx
 * @description 조회 toolbar 공통 레이아웃 래퍼.
 *  - DataGrid의 toolbarLeft 등에서 검색/필터 요소를 가로 배치(공간 부족 시 자동 줄바꿈)한다.
 *  - 반복되던 `flex gap-3 flex-1 min-w-0 items-center flex-wrap` 보일러플레이트를 일원화.
 *
 * 사용 예:
 *   toolbarLeft={
 *     <FilterBar>
 *       <Input ... />
 *       <DateRangeFilter ... />
 *       <ComCodeSelect ... />
 *     </FilterBar>
 *   }
 */
import type { ReactNode } from 'react';

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div className={`flex gap-3 flex-1 min-w-0 items-center flex-wrap ${className}`}>
      {children}
    </div>
  );
}
