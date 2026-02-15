/**
 * @file src/components/shared/WorkerSelect.tsx
 * @description 작업자 셀렉터 래퍼 - useWorkerOptions 훅 + Select UI
 *
 * 사용 예: <WorkerSelect value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useWorkerOptions } from "@/hooks/useMasterOptions";

type WorkerSelectProps = Omit<SelectProps, "options">;

export default function WorkerSelect(props: WorkerSelectProps) {
  const { options, isLoading } = useWorkerOptions();
  return <Select options={options} disabled={isLoading || props.disabled} {...props} />;
}
