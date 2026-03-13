/**
 * @file src/components/shared/LineSelect.tsx
 * @description 라인 셀렉터 래퍼 - useLineOptions 훅 + Select UI
 *
 * 사용 예:
 *   필터: <LineSelect value={v} onChange={fn} labelPrefix="라인" fullWidth />
 *   폼:   <LineSelect value={v} onChange={fn} fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useLineOptions } from "@/hooks/useMasterOptions";

interface LineSelectProps extends Omit<SelectProps, "options"> {
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
}

export default function LineSelect({ labelPrefix, ...props }: LineSelectProps) {
  const { options, isLoading } = useLineOptions();
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || props.disabled} {...props} />;
}
