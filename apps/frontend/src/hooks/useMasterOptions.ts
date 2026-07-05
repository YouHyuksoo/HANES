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

/** API 응답 래퍼 타입 */
interface ApiResponse<T> {
  data: T;
}

interface DepartmentItem {
  deptCode: string;
  deptName: string;
}

interface WarehouseItem {
  warehouseCode: string;
  warehouseName: string;
  isDefault?: string;
}

interface PartItem {
  itemCode: string;
  itemName: string;
}

interface LocationItem {
  locationCode: string;
  locationName: string;
  warehouseCode?: string;
  useYn?: string;
}

interface WorkerItem {
  id?: string;
  workerName: string;
  workerCode?: string;
}

interface LineItem {
  lineCode: string;
  lineName: string;
}

interface ProcessItem {
  processCode: string;
  processName: string;
}

interface EquipItem {
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
 * 부서 목록을 SelectOption[]으로 반환
 */
export function useDepartmentOptions() {
  const { data, isLoading } = useApiQuery<PaginatedResponse<DepartmentItem>>(
    ["departments", "options"],
    "/system/departments?limit=200&useYn=Y",
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((d) => ({
      value: d.deptCode,
      label: d.deptName,
    }));
  }, [data]);

  return { options, isLoading };
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

  const list = useMemo<WarehouseItem[]>(() => {
    const raw = data?.data;
    return Array.isArray(raw) ? raw : raw?.data ?? [];
  }, [data]);

  const options = useMemo<SelectOption[]>(
    () => list.map((w) => ({ value: w.warehouseCode, label: w.warehouseName })),
    [list],
  );

  /** 기본창고(isDefault='Y') 코드 — 입고 등 화면에서 기본 선택값으로 사용 */
  const defaultCode = useMemo(
    () => list.find((w) => w.isDefault === "Y")?.warehouseCode ?? "",
    [list],
  );

  return { options, isLoading, defaultCode };
}

/**
 * 창고 로케이션(적재위치) 목록을 SelectOption[]으로 반환
 * @param warehouseCode - 특정 창고로 필터 (미지정 시 전체 창고의 로케이션)
 * @remarks value=로케이션코드, label="로케이션코드 - 로케이션명" (창고 종속이라 창고명 접두)
 */
export function useLocationOptions(warehouseCode?: string) {
  const params = warehouseCode ? `?warehouseId=${encodeURIComponent(warehouseCode)}` : "";
  const { data, isLoading } = useApiQuery<{ data: LocationItem[] }>(
    ["warehouse-locations", "options", warehouseCode ?? "all"],
    `/inventory/warehouse-locations${params}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list
      .filter((l) => (l.useYn ?? "Y") === "Y")
      .map((l) => ({
        value: l.locationCode,
        label: l.locationName ? `${l.locationCode} - ${l.locationName}` : l.locationCode,
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
      value: p.itemCode,
      label: `${p.itemCode} - ${p.itemName}`,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 작업자 목록을 SelectOption[]으로 반환
 */
export function useWorkerOptions(dept?: string) {
  const query = new URLSearchParams({ limit: "100" });
  if (dept) query.set("dept", dept);
  const { data, isLoading } = useApiQuery<PaginatedResponse<WorkerItem>>(
    ["workers", "options", dept ?? "all"],
    `/master/workers?${query.toString()}`,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((w) => ({
      value: w.workerCode ?? w.id ?? "",
      label: w.workerName,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 라인 목록을 SelectOption[]으로 반환
 */
export function useLineOptions() {
  const { data, isLoading } = useApiQuery<{ data: LineItem[] }>(
    ["lines", "options"],
    "/equipment/equips/metadata/lines",
    { staleTime: 5 * 60 * 1000 },
  );

  const rawData = useMemo<LineItem[]>(() => {
    const response = data?.data as unknown as ApiResponse<LineItem[]> | LineItem[] | undefined;
    const list = Array.isArray(response) ? response : response?.data ?? [];
    return list;
  }, [data]);

  const options = useMemo<SelectOption[]>(() =>
    rawData.map((l) => ({
      value: l.lineCode,
      label: `${l.lineCode} - ${l.lineName}`,
    })),
  [rawData]);

  return { options, isLoading, rawData };
}

/**
 * 공정 목록을 SelectOption[]으로 반환
 */
export function useProcessOptions() {
  const { data, isLoading } = useApiQuery<{ data: ProcessItem[] }>(
    ["processes", "options"],
    "/equipment/equips/metadata/processes",
    { staleTime: 5 * 60 * 1000 },
  );

  const rawData = useMemo<ProcessItem[]>(() => {
    const response = data?.data as unknown as ApiResponse<ProcessItem[]> | ProcessItem[] | undefined;
    const list = Array.isArray(response) ? response : response?.data ?? [];
    return list;
  }, [data]);

  const options = useMemo<SelectOption[]>(() =>
    rawData.map((p) => ({
      value: p.processCode,
      label: `${p.processCode} - ${p.processName}`,
    })),
  [rawData]);

  return { options, isLoading, rawData };
}

/**
 * 설비 목록을 SelectOption[]으로 반환
 */
export function useEquipOptions(processCode?: string) {
  const url = processCode
    ? `/equipment/equips?limit=200&processCode=${encodeURIComponent(processCode)}`
    : "/equipment/equips?limit=200";
  const { data, isLoading } = useApiQuery<PaginatedResponse<EquipItem>>(
    ["equips", "options", processCode ?? "all"],
    url,
    { staleTime: 5 * 60 * 1000 },
  );

  const options = useMemo<SelectOption[]>(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map((e) => ({
      value: e.equipCode,
      label: `${e.equipCode} - ${e.equipName}`,
    }));
  }, [data]);

  return { options, isLoading };
}

/**
 * 공정에 배치된 설비 목록을 SelectOption[]으로 반환
 */
export function useProcessEquipmentOptions(processCode?: string, equipType?: string, enabled = true) {
  const queryEnabled = enabled && !!processCode;
  const { data, isLoading } = useApiQuery<{ data: EquipItem[] }>(
    ["process-equips", "options", processCode ?? "none", equipType ?? "all"],
    processCode ? `/master/processes/${encodeURIComponent(processCode)}/equipments` : null,
    { staleTime: 5 * 60 * 1000, enabled: queryEnabled },
  );

  const options = useMemo<SelectOption[]>(() => {
    const response = data?.data as unknown as ApiResponse<EquipItem[]> | EquipItem[] | undefined;
    const list = Array.isArray(response) ? response : response?.data ?? [];
    return list
      .filter((e) => !equipType || e.equipType === equipType)
      .map((e) => ({
        value: e.equipCode,
        label: `${e.equipCode} - ${e.equipName}`,
      }));
  }, [data, equipType]);

  return { options, isLoading: queryEnabled ? isLoading : false };
}

/**
 * 거래처 목록을 SelectOption[]으로 반환
 * @param partnerType - 'SUPPLIER' | 'CUSTOMER' (미지정 시 전체)
 */
export function usePartnerOptions(partnerType?: "SUPPLIER" | "CUSTOMER" | "VENDOR" | "MFG") {
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
  equipCode: string;
  bomItemCode: string;
  quantity: number;
  bomItem: {
    bomItemCode: string;
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
    const response = data?.data as unknown as ApiResponse<EquipBomRelItem[]> | EquipBomRelItem[] | undefined;
    const list = Array.isArray(response) ? response : response?.data ?? [];
    return list.map((rel) => ({
      value: rel.bomItem.itemCode,
      label: `${rel.bomItem.itemCode} - ${rel.bomItem.itemName}`,
    }));
  }, [data]);

  return { options, isLoading };
}
