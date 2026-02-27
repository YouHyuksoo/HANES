/**
 * @file src/components/shared/EquipSelect.tsx
 * @description 설비 셀렉터 래퍼 - useEquipOptions 훅 + Select UI
 *
 * 사용 예: <EquipSelect value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useEquipOptions } from "@/hooks/useMasterOptions";

type EquipSelectProps = Omit<SelectProps, "options">;

export default function EquipSelect(props: EquipSelectProps) {
  const { options, isLoading } = useEquipOptions();
  return <Select options={options} disabled={isLoading || props.disabled} {...props} />;
}
