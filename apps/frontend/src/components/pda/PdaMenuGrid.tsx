"use client";

/**
 * @file src/components/pda/PdaMenuGrid.tsx
 * @description PDA 메뉴 컴포넌트 — SMMEX 스타일 (list / grid 레이아웃 지원)
 *
 * 초보자 가이드:
 * 1. **layout="list"** (기본): 세로 리스트, h-16, 메인 메뉴용
 * 2. **layout="grid"**: 2열 그리드, h-20, 서브메뉴용
 * 3. border-2 테두리 + lucide 아이콘 + 텍스트 구성
 * 4. active:scale-[0.97] 터치 피드백 적용
 */
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { PdaMenuItem } from "./pdaMenuConfig";

interface PdaMenuGridProps {
  /** 메뉴 항목 배열 */
  items: PdaMenuItem[];
  /** 레이아웃 — 'list': 세로 리스트(메인), 'grid': 2열 그리드(서브메뉴) */
  layout?: "list" | "grid";
}

export default function PdaMenuGrid({
  items,
  layout = "list",
}: PdaMenuGridProps) {
  const router = useRouter();
  const { t } = useTranslation();

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={[
                "flex flex-col items-center justify-center gap-2 h-20 rounded-xl",
                "bg-white dark:bg-slate-900",
                "border-2",
                item.borderClass,
                "shadow-sm",
                "active:scale-[0.97] transition-transform",
              ].join(" ")}
            >
              <Icon className={`w-6 h-6 ${item.iconColorClass}`} />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center leading-tight px-1">
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // layout === "list"
  return (
    <div className="flex flex-col gap-3 p-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={[
              "flex flex-row items-center gap-4 h-16 px-5 rounded-xl",
              "bg-white dark:bg-slate-900",
              "border-2",
              item.borderClass,
              "shadow-sm",
              "active:scale-[0.97] transition-transform",
            ].join(" ")}
          >
            <Icon className={`w-6 h-6 shrink-0 ${item.iconColorClass}`} />
            <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
              {t(item.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
