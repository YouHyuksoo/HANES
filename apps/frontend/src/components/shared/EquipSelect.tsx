/**
 * @file src/components/shared/EquipSelect.tsx
 * @description 설비 셀렉터 래퍼 - useEquipOptions 훅 + Select UI
 *
 * 사용 예:
 *   필터: <EquipSelect value={v} onChange={fn} labelPrefix="설비" fullWidth />
 *   폼:   <EquipSelect value={v} onChange={fn} fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useEquipOptions } from "@/hooks/useMasterOptions";

interface EquipSelectProps extends Omit<SelectProps, "options"> {
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
  /** 공정 코드 — 지정 시 해당 공정 소속 설비만 표시 */
  processCode?: string;
  /** 이력 조회 필터용: 미사용(useYn='N') 설비도 포함 */
  includeInactive?: boolean;
}

export default function EquipSelect({ labelPrefix, processCode, includeInactive, ...props }: EquipSelectProps) {
  const { options, isLoading } = useEquipOptions(processCode, { includeInactive });
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || props.disabled} {...props} />;
}
