/**
 * @file src/components/shared/DepartmentSelect.tsx
 * @description 부서 셀렉터 래퍼 - useDepartmentOptions 훅 + Select UI
 *
 * 초보자 가이드:
 * 1. 부서 마스터(DEPARTMENT_MASTERS) 테이블에서 옵션 자동 로드
 * 2. labelPrefix 전달 시 "부서: 전체" 필터 패턴 자동 적용
 * 3. labelPrefix 미전달 시 폼 입력용 (전체 옵션 없음)
 *
 * 사용 예:
 *   필터: <DepartmentSelect value={v} onChange={fn} labelPrefix="부서" fullWidth />
 *   폼:   <DepartmentSelect value={v} onChange={fn} label="부서" fullWidth />
 */

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useDepartmentOptions } from "@/hooks/useMasterOptions";

interface DepartmentSelectProps extends Omit<SelectProps, "options"> {
  /** 필터용: 모든 옵션 라벨 앞에 접두어 추가 + "전체" 옵션 자동 추가 */
  labelPrefix?: string;
}

export default function DepartmentSelect({ labelPrefix, ...props }: DepartmentSelectProps) {
  const { options, isLoading } = useDepartmentOptions();
  const finalOptions = useMemo(() => {
    if (!labelPrefix) return options;
    return [
      { value: "", label: `${labelPrefix}: 전체` },
      ...options.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` })),
    ];
  }, [options, labelPrefix]);
  return <Select options={finalOptions} disabled={isLoading || props.disabled} {...props} />;
}
