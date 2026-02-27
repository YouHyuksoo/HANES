/**
 * @file src/components/shared/PartSearchModal.tsx
 * @description 품목검색 공통 모달 - 검색 + DataGrid 기반
 *
 * 초보자 가이드:
 * 1. **PartSearchModal**: 품목코드를 검색하고 선택할 수 있는 공통 모달
 * 2. **onSelect**: 행 클릭 시 선택된 품목 정보를 부모에 전달
 * 3. **itemType**: FG/WIP/RAW 등 품목유형 필터 (선택사항)
 * 4. 검색어 입력 → Enter 또는 검색 버튼 클릭 → API 호출 → DataGrid 표시
 *
 * 사용 예:
 * <PartSearchModal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   onSelect={(part) => setItemCode(part.itemCode)}
 *   itemType="FG"
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
  /** 품목유형 사전 필터 (FG/WIP/RAW) — 미지정 시 전체 */
  itemType?: string;
}

export default function PartSearchModal({
  isOpen,
  onClose,
  onSelect,
  itemType: defaultItemType,
}: PartSearchModalProps) {
  const { t } = useTranslation();

  const [keyword, setKeyword] = useState("");
  const [itemType, setItemType] = useState(defaultItemType ?? "");
  const [data, setData] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(false);

  /** 모달 열릴 때 초기화 및 자동 조회 */
  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    setItemType(defaultItemType ?? "");
    fetchParts("", defaultItemType ?? "");
  }, [isOpen, defaultItemType]);

  /** API 호출 */
  const fetchParts = useCallback(async (search: string, type: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (search.trim()) params.search = search.trim();
      if (type) params.itemType = type;
      const res = await api.get("/master/parts", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  /** 행 클릭 → 선택 후 닫기 */
  const handleRowClick = useCallback(
    (row: PartItem) => {
      onSelect(row);
      onClose();
    },
    [onSelect, onClose]
  );

  /** 품목유형 옵션 */
  const typeOptions = useMemo(
    () => [
      { value: "", label: t("common.all") },
      { value: "FG", label: t("inventory.stock.fg", "완제품") },
      { value: "WIP", label: t("inventory.stock.wip", "반제품") },
      { value: "RAW", label: t("inventory.stock.raw", "원자재") },
    ],
    [t]
  );

  /** DataGrid 컬럼 정의 */
  const columns = useMemo<ColumnDef<PartItem, unknown>[]>(
    () => [
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
    ],
    [t]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("common.partSearch", "품목 검색")}
      size="xl"
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

      {/* 품목 목록 */}
      <DataGrid
        data={data}
        columns={columns}
        isLoading={loading}
        onRowClick={handleRowClick}
        pageSize={10}
        enableColumnFilter={false}
        enableColumnReordering={false}
        maxHeight="400px"
      />
    </Modal>
  );
}
