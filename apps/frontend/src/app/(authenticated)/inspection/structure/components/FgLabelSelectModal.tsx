"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import api from "@/services/api";

interface FgLabelRow {
  fgBarcode: string;
  itemCode: string;
  orderNo: string | null;
  status: string;
  issuedAt: string;
  inspectPassYn: string | null;
}

interface FgLabelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (barcode: string) => void;
}

export default function FgLabelSelectModal({
  isOpen,
  onClose,
  onSelect,
}: FgLabelSelectModalProps) {
  const { t } = useTranslation();

  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<FgLabelRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    fetchLabels("");
  }, [isOpen]);

  const fetchLabels = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/quality/continuity-inspect/fg-labels", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    fetchLabels(keyword);
  }, [fetchLabels, keyword]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const handleRowClick = useCallback((row: FgLabelRow) => {
    onSelect(row.fgBarcode);
    onClose();
  }, [onSelect, onClose]);

  const columns = useMemo<ColumnDef<FgLabelRow>[]>(() => [
    {
      accessorKey: "fgBarcode", header: "FG Barcode", size: 150,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-primary">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "itemCode", header: t("master.part.partCode", "품목코드"), size: 120,
    },
    {
      accessorKey: "orderNo", header: t("production.result.orderNo", "작업지시"), size: 140,
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "status", header: t("common.status", "상태"), size: 100,
    },
    {
      accessorKey: "inspectPassYn", size: 80,
      header: () => <StatusHeaderHelp label={t("quality.inspect.judgement", "판정")} codeType="JUDGE_YN" align="center" />,
      cell: ({ getValue }) => <StatusBadge codeType="JUDGE_YN" value={getValue() as string} />,
    },
  ], [t]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("inspection.structure.selectLabel", "FG 라벨 선택")}
      size="xl"
    >
      <div className="flex items-end gap-2 mb-3">
        <Input
          placeholder={t("inspection.structure.searchLabelPlaceholder", "FG 바코드 또는 품목코드 검색...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        <Button onClick={handleSearch}>{t("common.search")}</Button>
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
