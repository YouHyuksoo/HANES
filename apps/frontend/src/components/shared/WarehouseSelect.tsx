/**
 * @file src/components/shared/WarehouseSelect.tsx
 * @description 창고 셀렉터 래퍼 - useWarehouseOptions 훅 + Select UI
 *
 * 초보자 가이드:
 * 1. **폼용**: <WarehouseSelect value={v} onChange={fn} fullWidth />
 * 2. **필터용**: <WarehouseSelect includeAll labelPrefix="창고" value={v} onChange={fn} fullWidth />
 *    → "창고: 전체", "창고: WH001 - 원자재창고" 형태로 표시
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Select from "@/components/ui/Select";
import type { SelectProps } from "@/components/ui/Select";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";

interface WarehouseSelectProps extends Omit<SelectProps, "options"> {
  /** 창고 유형 필터: 'RAW' | 'PRODUCT' | 'WIP' 등 (미지정 시 전체) */
  warehouseType?: string;
  /** true이면 "전체" 옵션 추가 (필터용) */
  includeAll?: boolean;
  /** 필터용: 옵션 라벨 앞에 접두어 추가 (예: "창고: 전체") */
  labelPrefix?: string;
}

export default function WarehouseSelect({ warehouseType, includeAll = false, labelPrefix, ...rest }: WarehouseSelectProps) {
  const { t } = useTranslation();
  const { options, isLoading } = useWarehouseOptions(warehouseType);

  const finalOptions = useMemo(() => {
    let opts = includeAll
      ? [{ value: "", label: t("common.all", "전체") }, ...options]
      : options;
    if (labelPrefix) {
      opts = opts.map(o => ({ ...o, label: `${labelPrefix}: ${o.label}` }));
    }
    return opts;
  }, [options, includeAll, labelPrefix, t]);

  return <Select options={finalOptions} disabled={isLoading || rest.disabled} {...rest} />;
}
