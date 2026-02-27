/**
 * @file src/components/shared/ComCodeSelect.tsx
 * @description ComCode 기반 범용 필터 Select 래퍼
 *
 * 초보자 가이드:
 * 1. groupCode에 ComCode 그룹코드를 넣으면 해당 옵션이 자동 로드됨
 * 2. includeAll=true(기본값)이면 "전체" 옵션이 맨 앞에 추가됨 (필터용)
 * 3. includeAll=false이면 "전체" 없이 순수 옵션만 (폼 입력용)
 *
 * 사용 예:
 *   필터: <ComCodeSelect groupCode="EQUIP_TYPE" value={v} onChange={fn} />
 *   폼:   <ComCodeSelect groupCode="EQUIP_TYPE" includeAll={false} value={v} onChange={fn} />
 */

import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useComCodeOptions } from "@/hooks/useComCode";

interface ComCodeSelectProps extends Omit<SelectProps, "options"> {
  groupCode: string;
  includeAll?: boolean;
}

export default function ComCodeSelect({
  groupCode,
  includeAll = true,
  ...props
}: ComCodeSelectProps) {
  const options = useComCodeOptions(groupCode, includeAll);
  return <Select options={options} {...props} />;
}
