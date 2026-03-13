/**
 * @file src/components/shared/PartSelect.tsx
 * @description 품목 셀렉터 래퍼 - usePartOptions 훅 + Select UI
 *
 * 사용 예:
 *   필터: <PartSelect partType="RAW" value={v} onChange={fn} labelPrefix="품목" fullWidth />
 *   폼:   <PartSelect partType="RAW" value={v} onChange={fn} fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { usePartOptions } from "@/hooks/useMasterOptions";

interface PartSelectProps extends Omit<SelectProps, "options"> {
  /** 품목 유형 필터: 'RAW' | 'PRODUCT' 등 (미지정 시 전체) */
  partType?: string;
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
}

export default function PartSelect({ partType, labelPrefix, ...rest }: PartSelectProps) {
  const { options, isLoading } = usePartOptions(partType);
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || rest.disabled} {...rest} />;
}
