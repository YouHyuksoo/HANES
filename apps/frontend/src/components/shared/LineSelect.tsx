/**
 * @file src/components/shared/LineSelect.tsx
 * @description 라인 셀렉터 래퍼 - useLineOptions 훅 + Select UI
 *
 * 사용 예: <LineSelect value={v} onChange={fn} fullWidth />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useLineOptions } from "@/hooks/useMasterOptions";

type LineSelectProps = Omit<SelectProps, "options">;

export default function LineSelect(props: LineSelectProps) {
  const { options, isLoading } = useLineOptions();
  return <Select options={options} disabled={isLoading || props.disabled} {...props} />;
}
