/**
 * @file src/components/shared/ProcessSelect.tsx
 * @description 공정 셀렉터 래퍼 - useProcessOptions 훅 + Select UI
 *
 * 사용 예: <ProcessSelect value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useProcessOptions } from "@/hooks/useMasterOptions";

type ProcessSelectProps = Omit<SelectProps, "options">;

export default function ProcessSelect(props: ProcessSelectProps) {
  const { options, isLoading } = useProcessOptions();
  return <Select options={options} disabled={isLoading || props.disabled} {...props} />;
}
