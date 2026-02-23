"use client";

/**
 * @file src/components/pda/PdaMenuGrid.tsx
 * @description PDA 메뉴 2열 버튼 그리드 컴포넌트
 *
 * 초보자 가이드:
 * 1. **items**: pdaMenuConfig의 메뉴 항목 배열
 * 2. 2열 그리드 레이아웃, 터치 최적화 (min-h-[100px])
 * 3. 아이콘 + 라벨, 그래디언트 배경
 */
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { PdaMenuItem } from "./pdaMenuConfig";

interface PdaMenuGridProps {
  items: PdaMenuItem[];
}

export default function PdaMenuGrid({ items }: PdaMenuGridProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md active:scale-[0.97] transition-all min-h-[110px]"
          >
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-xl ${item.iconBg}`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center leading-tight">
              {t(item.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
