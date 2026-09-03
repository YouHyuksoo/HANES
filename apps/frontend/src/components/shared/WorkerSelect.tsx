/**
 * @file src/components/shared/WorkerSelect.tsx
 * @description 작업자 셀렉터 래퍼 - useWorkerOptions 훅 + Select UI
 *
 * 사용 예:
 *   필터: <WorkerSelect value={v} onChange={fn} labelPrefix="작업자" fullWidth />
 *   폼:   <WorkerSelect value={v} onChange={fn} fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useWorkerOptions } from "@/hooks/useMasterOptions";

interface WorkerSelectProps extends Omit<SelectProps, "options"> {
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
  /** 이력 조회 필터용: 미사용(useYn='N') 작업자도 포함 */
  includeInactive?: boolean;
}

export default function WorkerSelect({ labelPrefix, includeInactive, ...props }: WorkerSelectProps) {
  const { options, isLoading } = useWorkerOptions(undefined, { includeInactive });
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || props.disabled} {...props} />;
}
