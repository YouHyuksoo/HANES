/**
 * @file src/components/shared/EquipSearchModal.tsx
 * @description 설비 검색 모달 — 검색 + DataGrid 기반
 *
 * 초보자 가이드:
 * 1. 설비코드를 직접 타이핑할 수 없는 화면(추적성 조회 등)에서 설비를 골라 넣는 공통 모달
 * 2. onSelect: 행 클릭 시 선택된 설비 정보를 부모에 전달하고 모달을 닫는다
 * 3. includeInactive: 이력 조회용. 미사용(useYn='N') 설비도 목록에 포함한다
 *
 * 사용 예:
 * <EquipSearchModal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   onSelect={(equip) => setEquipCode(equip.equipCode)}
 *   includeInactive
 * />
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

/** 설비 데이터 타입 */
export interface EquipSearchItem {
  equipCode: string;
  equipName: string;
  processCode?: string | null;
  processName?: string | null;
  lineCode?: string | null;
  useYn?: string | null;
}

interface EquipSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (equip: EquipSearchItem) => void;
  /** 공정 코드 — 지정 시 해당 공정 소속 설비만 조회 */
  processCode?: string;
  /** 이력 조회용: 미사용(useYn='N') 설비도 포함 */
  includeInactive?: boolean;
}

export default function EquipSearchModal({
  isOpen,
  onClose,
  onSelect,
  processCode,
  includeInactive,
}: EquipSearchModalProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<EquipSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEquips = useCallback(
    async (search: string) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 200 };
        if (search.trim()) params.search = search.trim();
        if (processCode) params.processCode = processCode;
        if (!includeInactive) params.useYn = "Y";
        const res = await api.get("/equipment/equips", { params });
        const raw = res.data?.data;
        setData(Array.isArray(raw) ? raw : raw?.data ?? []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [processCode, includeInactive],
  );

  /** 모달 열릴 때 초기화 및 자동 조회 */
  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    fetchEquips("");
  }, [isOpen, fetchEquips]);

  const handleSearch = useCallback(() => {
    fetchEquips(keyword);
  }, [fetchEquips, keyword]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch],
  );

  const handleRowClick = useCallback(
    (row: EquipSearchItem) => {
      onSelect(row);
      onClose();
    },
    [onSelect, onClose],
  );

  const columns = useMemo<ColumnDef<EquipSearchItem, unknown>[]>(
    () => [
      { accessorKey: "equipCode", header: t("equipment.equipCode", "설비코드"), size: 150 },
      { accessorKey: "equipName", header: t("equipment.equipName", "설비명"), size: 220 },
      { accessorKey: "processName", header: t("master.process.processName", "공정명"), size: 160 },
      { accessorKey: "lineCode", header: t("master.line.lineCode", "라인코드"), size: 120 },
    ],
    [t],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("equipment.equipSearch", "설비 검색")}
      size="xl"
    >
      <div className="flex items-end gap-2 mb-3">
        <Input
          placeholder={t("equipment.equipSearchPlaceholder", "설비코드 또는 설비명 검색...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
          autoFocus
        />
        <Button onClick={handleSearch} className="flex-shrink-0">
          {t("common.search")}
        </Button>
      </div>

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
