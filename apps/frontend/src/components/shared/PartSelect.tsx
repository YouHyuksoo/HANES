/**
 * @file src/components/shared/PartSelect.tsx
 * @description 품목 셀렉터 래퍼 - usePartOptions 훅 + Select UI
 *
 * 사용 예: <PartSelect partType="RAW" value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { usePartOptions } from "@/hooks/useMasterOptions";

interface PartSelectProps extends Omit<SelectProps, "options"> {
  /** 품목 유형 필터: 'RAW' | 'PRODUCT' 등 (미지정 시 전체) */
  partType?: string;
}

export default function PartSelect({ partType, ...rest }: PartSelectProps) {
  const { options, isLoading } = usePartOptions(partType);
  return <Select options={options} disabled={isLoading || rest.disabled} {...rest} />;
}
