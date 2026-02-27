/**
 * @file src/components/shared/PartnerSelect.tsx
 * @description 거래처 Select 래퍼 - usePartnerOptions 훅 + Select UI
 *
 * 초보자 가이드:
 * 1. partnerType을 지정하면 해당 유형만 필터링 (SUPPLIER / CUSTOMER)
 * 2. 미지정 시 전체 거래처 표시
 *
 * 사용 예: <PartnerSelect partnerType="SUPPLIER" value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { usePartnerOptions } from "@/hooks/useMasterOptions";

interface PartnerSelectProps extends Omit<SelectProps, "options"> {
  partnerType?: "SUPPLIER" | "CUSTOMER";
}

export default function PartnerSelect({
  partnerType,
  ...props
}: PartnerSelectProps) {
  const { options, isLoading } = usePartnerOptions(partnerType);
  return (
    <Select
      options={options}
      disabled={isLoading || props.disabled}
      {...props}
    />
  );
}
