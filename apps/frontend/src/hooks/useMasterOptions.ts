/**
 * @file src/hooks/useMasterOptions.ts
 * @description 마스터 데이터 셀렉터용 공유 훅 - 창고/품목/작업자/거래처 옵션
 *
 * 초보자 가이드:
 * 1. **useWarehouseOptions(type?)**: 창고 목록 → SelectOption[]
 * 2. **usePartOptions(type?)**: 품목 목록 → SelectOption[] (label: "코드 - 이름")
 * 3. **useWorkerOptions()**: 작업자 목록 → SelectOption[]
 * 4. **usePartnerOptions(type?)**: 거래처 목록 → SelectOption[] (label: "코드 - 이름")
 * 5. **useEquipBomOptions(equipCode)**: 설비 BOM 부품 → SelectOption[] (설비 선택 시 연동)
 * 6. useComCode.ts 패턴을 따름 (useApiQuery + useMemo)
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
  itemCode: string;
  itemName: string;
}

interface WorkerItem {
  id: string;
  workerName: string;
  workerCode?: string;
}

interface EquipItem {
  id: string;
  equipCode: string;
  equipName: string;
  equipType?: string;
  lineCode?: string;
}

interface PartnerItem {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: string;
}

/** 백엔드 findAll 응답: { data: T[], total, page, limit } */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 창고 목록을 SelectOption[]으로 반환
 * @param warehouseType - 'RAW' | 'PRODUCT' | 'WIP' 등 (미지정 시 전체)
 */
export function useWarehouseOptions(warehouseType?: string) {
  const params = warehouseType ? `?warehouseType=${warehouseType}` : "";
  const { data, isLoading } = useApiQuery<PaginatedResponse<WarehouseItem>>(
    ["warehouses", warehouseType ?? "all"],
    `/inventory/warehouses${params}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((w) => ({
      value: w.id,
      label: w.warehouseName,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 품목 목록을 SelectOption[]으로 반환
 * @param itemType - 'RAW' | 'PRODUCT' 등 (미지정 시 전체)
 */
export function usePartOptions(itemType?: string) {
  const params = new URLSearchParams({ limit: "100" });
  if (itemType) params.set("itemType", itemType);

  const { data, isLoading } = useApiQuery<PaginatedResponse<PartItem>>(
    ["parts", "options", itemType ?? "all"],
    `/master/parts?${params.toString()}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((p) => ({
      value: p.id,
      label: `${p.itemCode} - ${p.itemName}`,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 작업자 목록을 SelectOption[]으로 반환
 */
export function useWorkerOptions() {
  const { data, isLoading } = useApiQuery<PaginatedResponse<WorkerItem>>(
    ["workers", "options"],
    "/master/workers?limit=100",
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((w) => ({
      value: w.id,
      label: w.workerName,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 설비 목록을 SelectOption[]으로 반환
 */
export function useEquipOptions() {
  const { data, isLoading } = useApiQuery<PaginatedResponse<EquipItem>>(
    ["equips", "options"],
    "/equipment/equips?limit=200",
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((e) => ({
      value: e.id,
      label: `${e.equipCode} - ${e.equipName}`,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 거래처 목록을 SelectOption[]으로 반환
 * @param partnerType - 'SUPPLIER' | 'CUSTOMER' (미지정 시 전체)
 */
export function usePartnerOptions(partnerType?: "SUPPLIER" | "CUSTOMER") {
  const params = new URLSearchParams({ limit: "100" });
  if (partnerType) params.set("partnerType", partnerType);

  const { data, isLoading } = useApiQuery<PaginatedResponse<PartnerItem>>(
    ["partners", "options", partnerType ?? "all"],
    `/master/partners?${params.toString()}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((p) => ({
      value: p.partnerCode,
      label: `${p.partnerCode} - ${p.partnerName}`,
    }));
  }, [data]);

  return { options, isLoading };
}

interface EquipBomRelItem {
  id: string;
  bomItemId: string;
  quantity: number;
  bomItem: {
    id: string;
    itemCode: string;
    itemName: string;
    itemType: string;
    spec: string | null;
  };
}

/**
 * 설비에 연결된 BOM 부품 목록을 SelectOption[]으로 반환
 * @param equipCode - 설비 코드 (null이면 빈 목록)
 */
export function useEquipBomOptions(equipCode: string | null) {
  const { data, isLoading } = useApiQuery<{ data: EquipBomRelItem[] }>(
    ["equip-bom", equipCode ?? "none"],
    equipCode ? `/master/equip-bom/equip/${equipCode}` : null,
    { staleTime: 3 * 60 * 1000, enabled: !!equipCode },
  );

  const options = useMemo<SelectOption[]>(() => {
    const list = (data?.data as any)?.data ?? data?.data ?? [];
    return (list as EquipBomRelItem[]).map((rel) => ({
      value: rel.bomItem.itemCode,
      label: `${rel.bomItem.itemCode} - ${rel.bomItem.itemName}`,
    }));
  }, [data]);

  return { options, isLoading };
}
