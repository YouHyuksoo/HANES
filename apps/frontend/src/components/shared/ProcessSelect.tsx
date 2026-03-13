/**
 * @file src/components/shared/ProcessSelect.tsx
 * @description 공정 셀렉터 래퍼 - useProcessOptions 훅 + Select UI
 *
 * 사용 예:
 *   필터: <ProcessSelect value={v} onChange={fn} labelPrefix="공정" fullWidth />
 *   폼:   <ProcessSelect value={v} onChange={fn} fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useProcessOptions } from "@/hooks/useMasterOptions";

interface ProcessSelectProps extends Omit<SelectProps, "options"> {
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
}

export default function ProcessSelect({ labelPrefix, ...props }: ProcessSelectProps) {
  const { options, isLoading } = useProcessOptions();
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || props.disabled} {...props} />;
}
