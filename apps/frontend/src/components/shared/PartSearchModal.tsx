/**
 * @file src/components/shared/PartSearchModal.tsx
 * @description 품목검색 공통 모달 - 검색 + DataGrid 기반
 *
 * 초보자 가이드:
 * 1. **PartSearchModal**: 품목코드를 검색하고 선택할 수 있는 공통 모달
 * 2. **onSelect**: 행 클릭 시 선택된 품목 정보를 부모에 전달
 * 3. **itemType**: FINISHED/SEMI_PRODUCT/RAW_MATERIAL/CONSUMABLE 품목유형 필터 (선택사항)
 * 4. 검색어 입력 → Enter 또는 검색 버튼 클릭 → API 호출 → DataGrid 표시
 *
 * 사용 예:
 * <PartSearchModal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   onSelect={(part) => setItemCode(part.itemCode)}
 *   itemType="FINISHED"
 * />
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

/** 품목 데이터 타입 */
export interface PartItem {
  itemCode: string;
  itemName: string;
  itemType?: string;
  spec?: string;
  unit?: string;
}

interface PartSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (part: PartItem) => void;
  /** 다중 선택 모드. 지정하지 않으면 기존 단건 선택 동작 유지 */
  multiSelect?: boolean;
  /** 다중 선택 확정 콜백 */
  onSelectMany?: (parts: PartItem[]) => void;
  /** 품목유형 사전 필터 (FG/WIP/RAW) — 미지정 시 전체 */
  itemType?: string;
  /** 허용 품목유형 다중 제한 (예: 제품·반제품만). 지정 시 이 유형들만 조회·선택 가능 */
  allowedItemTypes?: string[];
  /** 그리드 페이지당 행 수. 미지정 시 15행 (호출처별 모달 높이 조절용) */
  pageSize?: number;
  /** 단건 선택 모달 폭. 미지정 시 기존 기본 폭(xl)을 유지 */
  modalSize?: 'xl' | '2xl';
}

export default function PartSearchModal({
  isOpen,
  onClose,
  onSelect,
  multiSelect = false,
  onSelectMany,
  itemType: defaultItemType,
  allowedItemTypes,
  pageSize = 15,
  modalSize = "xl",
}: PartSearchModalProps) {
  const { t } = useTranslation();

  const [keyword, setKeyword] = useState("");
  const [itemType, setItemType] = useState(defaultItemType ?? "");
  const [data, setData] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemCodes, setSelectedItemCodes] = useState<Set<string>>(() => new Set());

  const allowedKey = (allowedItemTypes ?? []).join(",");

  /** API 호출 */
  const fetchParts = useCallback(async (search: string, type: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (search.trim()) params.search = search.trim();
      if (type) {
        // 단일 유형이 선택된 경우 우선 적용
        params.itemType = type;
      } else if (allowedKey) {
        // 선택이 없으면 허용 유형 전체로 제한
        params.itemTypes = allowedKey;
      }
      const res = await api.get("/master/parts", { params });
      const raw = res.data?.data;
      setData(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [allowedKey]);

  /** 모달 열릴 때 초기화 및 자동 조회 */
  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    setItemType(defaultItemType ?? "");
    setSelectedItemCodes(new Set());
    fetchParts("", defaultItemType ?? "");
  }, [isOpen, defaultItemType, fetchParts]);

  /** 검색 실행 */
  const handleSearch = useCallback(() => {
    fetchParts(keyword, itemType);
  }, [fetchParts, keyword, itemType]);

  /** Enter 키 검색 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  const togglePartSelection = useCallback((part: PartItem) => {
    setSelectedItemCodes((prev) => {
      const next = new Set(prev);
      if (next.has(part.itemCode)) next.delete(part.itemCode);
      else next.add(part.itemCode);
      return next;
    });
  }, []);

  const selectedParts = useMemo(
    () => data.filter((part) => selectedItemCodes.has(part.itemCode)),
    [data, selectedItemCodes],
  );

  const allVisibleSelected = data.length > 0 && data.every((part) => selectedItemCodes.has(part.itemCode));

  const toggleAllVisible = useCallback(() => {
    setSelectedItemCodes((prev) => {
      const next = new Set(prev);
      if (data.length > 0 && data.every((part) => next.has(part.itemCode))) {
        data.forEach((part) => next.delete(part.itemCode));
      } else {
        data.forEach((part) => next.add(part.itemCode));
      }
      return next;
    });
  }, [data]);

  const handleSelectMany = useCallback(() => {
    if (selectedParts.length === 0) return;
    onSelectMany?.(selectedParts);
    setSelectedItemCodes(new Set());
    onClose();
  }, [onClose, onSelectMany, selectedParts]);

  /** 행 클릭 → 단건 선택 또는 다중선택 토글 */
  const handleRowClick = useCallback(
    (row: PartItem) => {
      if (multiSelect) {
        togglePartSelection(row);
        return;
      }
      onSelect(row);
      onClose();
    },
    [multiSelect, onSelect, onClose, togglePartSelection]
  );

  /** 품목유형 코드 → 한글 라벨 매핑 (컬럼·필터 공통 사용) */
  const typeLabelMap = useMemo<Record<string, string>>(() => ({
    FINISHED: t("inventory.stock.fg", "완제품"),
    SEMI_PRODUCT: t("inventory.stock.wip", "반제품"),
    RAW_MATERIAL: t("inventory.stock.raw", "원자재"),
    CONSUMABLE: t("inventory.stock.consumable", "소모품"),
  }), [t]);

  /** 품목유형 옵션 (allowedItemTypes 지정 시 해당 유형만 노출) */
  const typeOptions = useMemo(() => {
    const allowed = allowedItemTypes ?? [];
    const base = allowed.length > 0
      ? allowed
      : ["FINISHED", "SEMI_PRODUCT", "RAW_MATERIAL"];
    return [
      { value: "", label: t("common.all") },
      ...base.map((v) => ({ value: v, label: typeLabelMap[v] ?? v })),
    ];
  }, [t, allowedKey, allowedItemTypes, typeLabelMap]);

  /** DataGrid 컬럼 정의 */
  const columns = useMemo<ColumnDef<PartItem, unknown>[]>(
    () => {
      const baseColumns: ColumnDef<PartItem, unknown>[] = [
        {
          accessorKey: "itemCode",
          header: t("common.partCode"),
          size: 160,
        },
        {
          accessorKey: "itemName",
          header: t("common.partName"),
          size: 220,
        },
        {
          accessorKey: "itemType",
          header: t("common.itemType", "품목유형"),
          size: 100,
          cell: ({ getValue }) => {
            const code = (getValue() as string) ?? "";
            return typeLabelMap[code] ?? code;
          },
        },
        {
          accessorKey: "spec",
          header: t("master.part.spec", "규격"),
          size: 160,
        },
        {
          accessorKey: "unit",
          header: t("common.unit"),
          size: 80,
        },
      ];

      if (!multiSelect) return baseColumns;

      return [
        {
          id: "select",
          header: () => (
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 accent-primary"
              aria-label={t("common.selectAll", "전체 선택")}
            />
          ),
          size: 48,
          meta: { align: "center" as const, filterType: "none" as const },
          cell: ({ row }) => {
            const part = row.original;
            return (
              <input
                type="checkbox"
                checked={selectedItemCodes.has(part.itemCode)}
                onChange={() => togglePartSelection(part)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 accent-primary"
                aria-label={t("common.select", "선택")}
              />
            );
          },
        },
        ...baseColumns,
      ];
    },
    [t, multiSelect, allVisibleSelected, toggleAllVisible, selectedItemCodes, togglePartSelection, typeLabelMap]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("common.partSearch", "품목 검색")}
      size={multiSelect ? "2xl" : modalSize}
      footer={multiSelect ? (
        <>
          <div className="mr-auto text-sm text-text-muted">
            {t("common.selectedCount", "선택 {{count}}건", { count: selectedItemCodes.size })}
          </div>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSelectMany} disabled={selectedItemCodes.size === 0}>
            {t("common.addSelectedItems", "선택 품목 추가")}
          </Button>
        </>
      ) : undefined}
    >
      {/* 검색 바 */}
      <div className="flex items-end gap-2 mb-3">
        <Input
          placeholder={t("common.partSearchPlaceholder", "품목코드 또는 품목명 입력...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        <Select
          options={typeOptions}
          value={itemType}
          onChange={(v) => setItemType(v)}
          className="w-32 flex-shrink-0"
        />
        <Button onClick={handleSearch} className="flex-shrink-0">
          {t("common.search")}
        </Button>
      </div>

      {/* 품목 목록 — 내부 maxHeight 스크롤을 두지 않아 모달 본문(max-h-75vh)만 스크롤(이중 스크롤 방지) */}
      <DataGrid
        data={data}
        columns={columns}
        isLoading={loading}
        onRowClick={handleRowClick}
        pageSize={pageSize}
        enableColumnFilter={false}
        enableColumnReordering={false}
      />
    </Modal>
  );
}
