/**
 * @file src/components/shared/ConsumableSearchModal.tsx
 * @description 소모품검색 공통 모달 - 검색 + DataGrid 기반
 *
 * 초보자 가이드:
 * 1. **ConsumableSearchModal**: 소모품을 검색하고 선택할 수 있는 공통 모달
 * 2. **onSelect**: 행 클릭 시 선택된 소모품 정보를 부모에 전달
 * 3. **category**: MOLD/JIG/TOOL 카테고리 필터 (선택사항)
 * 4. 검색어 입력 → Enter 또는 검색 버튼 클릭 → API 호출 → DataGrid 표시
 *
 * 사용 예:
 * <ConsumableSearchModal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   onSelect={(item) => setConsumableId(item.id)}
 *   category="MOLD"
 * />
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input, Select, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

/** 소모품 데이터 타입 */
export interface ConsumableItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  category: string | null;
  location: string | null;
  vendor: string | null;
  stockQty?: number;
  safetyStock?: number;
}

interface ConsumableSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: ConsumableItem) => void;
  /** 카테고리 사전 필터 (MOLD/JIG/TOOL) — 미지정 시 전체 */
  category?: string;
}

export default function ConsumableSearchModal({
  isOpen,
  onClose,
  onSelect,
  category: defaultCategory,
}: ConsumableSearchModalProps) {
  const { t } = useTranslation();

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState(defaultCategory ?? "");
  const [data, setData] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(false);

  /** 모달 열릴 때 초기화 및 자동 조회 */
  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    setCategory(defaultCategory ?? "");
    fetchConsumables("", defaultCategory ?? "");
  }, [isOpen, defaultCategory]);

  /** API 호출 */
  const fetchConsumables = useCallback(async (search: string, cat: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200, useYn: "Y" };
      if (search.trim()) params.search = search.trim();
      if (cat) params.category = cat;
      const res = await api.get("/consumables", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 검색 실행 */
  const handleSearch = useCallback(() => {
    fetchConsumables(keyword, category);
  }, [fetchConsumables, keyword, category]);

  /** Enter 키 검색 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  /** 행 클릭 → 선택 후 닫기 */
  const handleRowClick = useCallback(
    (row: ConsumableItem) => {
      onSelect(row);
      onClose();
    },
    [onSelect, onClose]
  );

  /** 카테고리 옵션 */
  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("common.all") },
      { value: "MOLD", label: t("consumables.master.mold") },
      { value: "JIG", label: t("consumables.master.jig") },
      { value: "TOOL", label: t("consumables.master.tool") },
    ],
    [t]
  );

  /** DataGrid 컬럼 정의 */
  const columns = useMemo<ColumnDef<ConsumableItem, unknown>[]>(
    () => [
      {
        accessorKey: "consumableCode",
        header: t("consumables.comp.consumableCode"),
        size: 140,
      },
      {
        accessorKey: "consumableName",
        header: t("consumables.comp.consumableName"),
        size: 200,
      },
      {
        accessorKey: "category",
        header: t("consumables.comp.category"),
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return val ? <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={val} /> : "-";
        },
      },
      {
        accessorKey: "location",
        header: t("consumables.comp.location"),
        size: 110,
      },
      {
        accessorKey: "vendor",
        header: t("consumables.comp.vendor"),
        size: 110,
      },
    ],
    [t]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("consumables.search.title", "소모품 검색")}
      size="xl"
    >
      {/* 검색 바 */}
      <div className="flex items-end gap-2 mb-3">
        <Input
          placeholder={t("consumables.search.placeholder", "소모품코드 또는 소모품명 입력...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        <Select
          options={categoryOptions}
          value={category}
          onChange={(v) => setCategory(v)}
          className="w-32 flex-shrink-0"
        />
        <Button onClick={handleSearch} className="flex-shrink-0">
          {t("common.search")}
        </Button>
      </div>

      {/* 소모품 목록 */}
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
