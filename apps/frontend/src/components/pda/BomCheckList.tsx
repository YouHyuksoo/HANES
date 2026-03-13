"use client";

/**
 * @file src/components/pda/BomCheckList.tsx
 * @description BOM 자재 스캔 체크리스트 — PDA 화면에서 필요 자재 스캔 현황 표시
 *
 * 초보자 가이드:
 * 1. **items**: 체크할 BOM 항목 배열 (품목코드, 품목명, 요청수량, 스캔수량, 체크 여부)
 * 2. **상태별 배경색**:
 *    - 완료 (checked && scannedQty >= requiredQty) → 초록
 *    - 초과 스캔 (scannedQty > requiredQty) → 노란 경고
 *    - 미스캔 (기본) → 흰색/슬레이트
 * 3. 하단 진행률 바로 전체 완료 현황 한눈에 확인 가능
 */

import { CheckCircle, Circle, AlertTriangle } from "lucide-react";

/** BOM 체크 항목 단위 */
export interface BomCheckItem {
  /** 품목 코드 */
  itemCode: string;
  /** 품목명 */
  itemName: string;
  /** 요청 수량 */
  requiredQty: number;
  /** 스캔된 수량 */
  scannedQty: number;
  /** 체크 완료 여부 */
  checked: boolean;
}

interface BomCheckListProps {
  /** 표시할 BOM 체크 항목 목록 */
  items: BomCheckItem[];
  /** 추가 CSS 클래스 */
  className?: string;
}

/** 항목 상태 판별 함수 */
function getItemState(item: BomCheckItem): "complete" | "over" | "pending" {
  if (item.scannedQty > item.requiredQty) return "over";
  if (item.checked && item.scannedQty >= item.requiredQty) return "complete";
  return "pending";
}

/** 상태별 스타일 매핑 */
const stateStyles = {
  complete: {
    card: "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800",
    icon: <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400 flex-shrink-0" />,
    qty: "text-green-700 dark:text-green-300",
    code: "text-green-800 dark:text-green-200",
    name: "text-green-700 dark:text-green-300",
  },
  over: {
    card: "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800",
    icon: <AlertTriangle className="w-6 h-6 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />,
    qty: "text-yellow-700 dark:text-yellow-300",
    code: "text-yellow-800 dark:text-yellow-200",
    name: "text-yellow-700 dark:text-yellow-300",
  },
  pending: {
    card: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    icon: <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 flex-shrink-0" />,
    qty: "text-slate-500 dark:text-slate-400",
    code: "text-slate-800 dark:text-slate-200",
    name: "text-slate-600 dark:text-slate-400",
  },
};

/**
 * BOM 자재 스캔 체크리스트 컴포넌트
 *
 * @param items - BOM 체크 항목 배열
 * @param className - 추가 CSS 클래스
 */
export default function BomCheckList({ items, className = "" }: BomCheckListProps) {
  const completedCount = items.filter(
    (item) => item.checked && item.scannedQty >= item.requiredQty
  ).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* 항목 목록 */}
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const state = getItemState(item);
          const styles = stateStyles[state];

          return (
            <li
              key={item.itemCode}
              className={`flex items-center gap-3 p-4 rounded-xl border ${styles.card} min-h-[64px] transition-colors`}
            >
              {/* 상태 아이콘 */}
              {styles.icon}

              {/* 품목 정보 */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${styles.code}`}>
                  {item.itemCode}
                </p>
                <p className={`text-sm font-semibold truncate ${styles.name}`}>
                  {item.itemName}
                </p>
              </div>

              {/* 수량 정보 */}
              <div className={`text-right flex-shrink-0 ${styles.qty}`}>
                <p className="text-xs opacity-70">요청 / 스캔</p>
                <p className="text-base font-bold tabular-nums">
                  {item.requiredQty}
                  <span className="mx-1 font-normal opacity-50">/</span>
                  {item.scannedQty}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 전체 진행률 */}
      <div className="px-1">
        {/* 수치 표시 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">전체 진행률</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {completedCount} / {totalCount} 완료
          </span>
        </div>

        {/* 진행률 바 */}
        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progressPct === 100
                ? "bg-green-500 dark:bg-green-400"
                : "bg-blue-500 dark:bg-blue-400"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
