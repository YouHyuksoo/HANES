/**
 * @file src/components/shared/UseYnSelect.tsx
 * @description 사용여부(Y/N) 필터용 공용 Select 컴포넌트
 *
 * 초보자 가이드:
 * 1. **필터용**: <UseYnSelect value={v} onChange={fn} fullWidth />
 *    → "사용여부: 전체", "사용여부: 사용", "사용여부: 미사용" 형태로 표시
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";

type UseYnSelectProps = Omit<SelectProps, "options">;

export default function UseYnSelect(props: UseYnSelectProps) {
  const { t } = useTranslation();

  const options = useMemo(() => [
    { value: "", label: t("common.useYn", "사용여부") + ": " + t("common.all", "전체") },
    { value: "Y", label: t("common.useYn", "사용여부") + ": " + t("common.useY", "사용") },
    { value: "N", label: t("common.useYn", "사용여부") + ": " + t("common.useN", "미사용") },
  ], [t]);

  return <Select options={options} {...props} />;
}
