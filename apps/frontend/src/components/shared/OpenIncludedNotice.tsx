"use client";

/**
 * @file components/shared/OpenIncludedNotice.tsx
 * @description 날짜 기간 필터 + "미완료(진행중)는 기간 무관 항상 노출" 정책을 함께 쓰는 목록에서,
 *  기간 밖이지만 진행중이라 포함된 행이 있을 때 그 사실을 안내하는 띠.
 *  (필터 라벨='오늘'인데 과거 날짜 진행중 건이 보이는 혼란 방지)
 *  파스텔 배경 금지 규칙에 따라 배경색 없이 테두리/텍스트로만 구분한다.
 */
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

export default function OpenIncludedNotice({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 text-sm flex-shrink-0">
      <Info className="w-4 h-4 shrink-0" />
      <span>
        {t("common.dateFilter.openIncludedNotice", {
          count,
          defaultValue: "기간 밖이지만 진행 중인 {{count}}건이 포함되어 있습니다.",
        })}
      </span>
    </div>
  );
}
