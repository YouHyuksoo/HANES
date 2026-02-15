/**
 * @file src/hooks/useMasterOptions.ts
 * @description 마스터 데이터 셀렉터용 공유 훅 - 창고/품목/작업자/거래처 옵션
 *
 * 초보자 가이드:
 * 1. **useWarehouseOptions(type?)**: 창고 목록 → SelectOption[]
 * 2. **usePartOptions(type?)**: 품목 목록 → SelectOption[] (label: "코드 - 이름")
 * 3. **useWorkerOptions()**: 작업자 목록 → SelectOption[]
 * 4. **usePartnerOptions(type?)**: 거래처 목록 → SelectOption[] (label: "코드 - 이름")
 * 5. useComCode.ts 패턴을 따름 (useApiQuery + useMemo)
 */

import { useMemo } from "react";
import { useApiQuery } from "./useApi";
import type { SelectOption } from "@/components/ui/Select";

interface WarehouseItem {
  id: string;
  warehouseName: string;
  warehouseCode?: string;
}

interface PartItem {
  id: string;
  partCode: string;
  partName: string;
}

interface WorkerItem {
  id: string;
  workerName: string;
  workerCode?: string;
}

interface PartnerItem {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: string;
}

/**
 * 창고 목록을 SelectOption[]으로 반환
 * @param warehouseType - 'RAW' | 'PRODUCT' | 'WIP' 등 (미지정 시 전체)
 */
export function useWarehouseOptions(warehouseType?: string) {
  const params = warehouseType ? `?warehouseType=${warehouseType}` : "";
  const { data, isLoading } = useApiQuery<WarehouseItem[]>(
    ["warehouses", warehouseType ?? "all"],
    `/inventory/warehouses${params}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const list = data?.data ?? [];
    return list.map((w) => ({
      value: w.id,
      label: w.warehouseName,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 품목 목록을 SelectOption[]으로 반환
 * @param partType - 'RAW' | 'PRODUCT' 등 (미지정 시 전체)
 */
export function usePartOptions(partType?: string) {
  const params = new URLSearchParams({ limit: "500" });
  if (partType) params.set("partType", partType);

  const { data, isLoading } = useApiQuery<PartItem[]>(
    ["parts", "options", partType ?? "all"],
    `/master/parts?${params.toString()}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const list = data?.data ?? [];
    return list.map((p) => ({
      value: p.id,
      label: `${p.partCode} - ${p.partName}`,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 작업자 목록을 SelectOption[]으로 반환
 */
export function useWorkerOptions() {
  const { data, isLoading } = useApiQuery<WorkerItem[]>(
    ["workers", "options"],
    "/master/workers?limit=100",
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const list = data?.data ?? [];
    return list.map((w) => ({
      value: w.id,
      label: w.workerName,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 거래처 목록을 SelectOption[]으로 반환
 * @param partnerType - 'SUPPLIER' | 'CUSTOMER' (미지정 시 전체)
 */
export function usePartnerOptions(partnerType?: "SUPPLIER" | "CUSTOMER") {
  const params = new URLSearchParams({ limit: "500" });
  if (partnerType) params.set("partnerType", partnerType);

  const { data, isLoading } = useApiQuery<PartnerItem[]>(
    ["partners", "options", partnerType ?? "all"],
    `/master/partners?${params.toString()}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const list = data?.data ?? [];
    return list.map((p) => ({
      value: p.partnerCode,
      label: `${p.partnerCode} - ${p.partnerName}`,
    }));
  }, [data]);

  return { options, isLoading };
}
