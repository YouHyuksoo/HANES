/**
 * @file src/components/shared/WarehouseSelect.tsx
 * @description 창고 셀렉터 래퍼 - useWarehouseOptions 훅 + Select UI
 *
 * 사용 예: <WarehouseSelect warehouseType="RAW" value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";

interface WarehouseSelectProps extends Omit<SelectProps, "options"> {
  /** 창고 유형 필터: 'RAW' | 'PRODUCT' | 'WIP' 등 (미지정 시 전체) */
  warehouseType?: string;
}

export default function WarehouseSelect({ warehouseType, ...rest }: WarehouseSelectProps) {
  const { options, isLoading } = useWarehouseOptions(warehouseType);
  return <Select options={options} disabled={isLoading || rest.disabled} {...rest} />;
}
