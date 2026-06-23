/**
 * @file src/components/shared/UseYnSelect.tsx
 * @description 사용여부(Y/N) 공용 Select 컴포넌트 + 옵션 훅
 *
 * 초보자 가이드:
 * 1. **필터용**(기본): <UseYnSelect value={v} onChange={fn} fullWidth />
 *    → "사용여부: 전체", "사용여부: 사용", "사용여부: 미사용" 형태로 표시
 * 2. **폼 입력용**: <UseYnSelect includeAll={false} value={v} onChange={fn} fullWidth />
 *    → "사용", "미사용"만 (전체 옵션 없음, prefix 없음)
 * 3. FieldSelect 등 다른 래퍼에서 옵션만 필요하면 useUseYnOptions 훅을 사용한다.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Select from "@/components/ui/Select";
import type { SelectProps, SelectOption } from "@/components/ui/Select";

interface UseYnSelectProps extends Omit<SelectProps, "options"> {
  /** true(기본): "전체" 옵션 포함 (필터용) / false: Y/N만 (폼 입력용) */
  includeAll?: boolean;
  /** 옵션 라벨 앞 접두어. 미지정 시 필터(includeAll=true)에서만 "사용여부" 자동 적용 */
  labelPrefix?: string;
}

/**
 * 사용여부 옵션 배열을 생성한다. UseYnSelect와 FieldSelect 등이 공유한다.
 * @param includeAll true면 "전체" 옵션을 맨 앞에 추가
 * @param labelPrefix 지정 시 모든 라벨 앞에 "프리픽스: " 접두어
 */
export function useUseYnOptions(includeAll = true, labelPrefix?: string): SelectOption[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const base: SelectOption[] = [
      { value: "Y", label: t("common.useY", "사용") },
      { value: "N", label: t("common.useN", "미사용") },
    ];
    const opts = includeAll
      ? [{ value: "", label: t("common.all", "전체") }, ...base]
      : base;
    return labelPrefix
      ? opts.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` }))
      : opts;
  }, [t, includeAll, labelPrefix]);
}

export default function UseYnSelect({ includeAll = true, labelPrefix, ...props }: UseYnSelectProps) {
  const { t } = useTranslation();
  // 하위호환: 필터(includeAll=true)에서 prefix 미지정 시 기존처럼 "사용여부:" 자동 적용
  const effectivePrefix = labelPrefix ?? (includeAll ? t("common.useYn", "사용여부") : undefined);
  const options = useUseYnOptions(includeAll, effectivePrefix);
  return <Select options={options} {...props} />;
}
