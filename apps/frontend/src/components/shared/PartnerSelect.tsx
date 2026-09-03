/**
 * @file src/components/shared/PartnerSelect.tsx
 * @description 거래처 Select 래퍼 - usePartnerOptions 훅 + Select UI
 *
 * 사용 예:
 *   필터: <PartnerSelect partnerType="SUPPLIER" value={v} onChange={fn} labelPrefix="거래처" fullWidth />
 *   폼:   <PartnerSelect partnerType="SUPPLIER" value={v} onChange={fn} fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { usePartnerOptions } from "@/hooks/useMasterOptions";

interface PartnerSelectProps extends Omit<SelectProps, "options"> {
  partnerType?: "SUPPLIER" | "CUSTOMER" | "VENDOR" | "MFG";
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
  /** 이력 조회 필터용: 미사용(useYn='N') 거래처도 포함 */
  includeInactive?: boolean;
}

export default function PartnerSelect({ partnerType, labelPrefix, includeInactive, ...props }: PartnerSelectProps) {
  const { options, isLoading } = usePartnerOptions(partnerType, { includeInactive });
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || props.disabled} {...props} />;
}
