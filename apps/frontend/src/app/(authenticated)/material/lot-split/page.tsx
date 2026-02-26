"use client";

/**
 * @file src/app/(authenticated)/material/lot-split/page.tsx
 * @description 자재분할 페이지 - LOT 분할 관리
 *
 * 초보자 가이드:
 * 1. **LOT 분할**: 하나의 LOT에서 일부 수량을 분리하여 새 LOT 생성
 * 2. **추적성**: 분할 후에도 parentLotId로 추적 가능
 * 3. API: GET /material/lot-split, POST /material/lot-split
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Scissors, Search, RefreshCw, GitBranch } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface SplittableLot {
  id: string;
  matUid: string;
  itemCode?: string;
  itemName?: string;
  currentQty: number;
  unit?: string;
  vendor?: string;
  status: string;
}

export default function LotSplitPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<SplittableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<SplittableLot | null>(null);
  const [splitForm, setSplitForm] = useState({ splitQty: "", remark: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/material/lot-split", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    totalQty: data.reduce((s, d) => s + d.currentQty, 0),
  }), [data]);

  const handleSplit = useCallback(async () => {
    if (!selectedLot || !splitForm.splitQty) return;
    setSaving(true);
    try {
      await api.post("/material/lot-split", {
        sourceLotId: selectedLot.id,
        splitQty: Number(splitForm.splitQty),
        remark: splitForm.remark || undefined,
      });
      setIsModalOpen(false);
      setSplitForm({ splitQty: "", remark: "" });
      setSelectedLot(null);
      fetchData();
    } catch (e) {
      console.error("Split failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedLot, splitForm, fetchData]);

  const columns = useMemo<ColumnDef<SplittableLot>[]>(() => [
    {
      accessorKey: "matUid", header: "LOT No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "currentQty", header: t("material.lotSplit.currentQty"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span className="font-semibold">{row.original.currentQty.toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "vendor", header: t("material.lotSplit.vendor"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      id: "actions", header: "", size: 90, meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" onClick={() => {
          setSelectedLot(row.original);
          setSplitForm({ splitQty: "", remark: "" });
          setIsModalOpen(true);
        }}>
          <Scissors className="w-4 h-4 mr-1" />{t("material.lotSplit.split")}
        </Button>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-primary" />{t("material.lotSplit.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.lotSplit.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("material.lotSplit.stats.total")} value={stats.total} icon={GitBranch} color="blue" />
        <StatCard label={t("material.lotSplit.stats.totalQty")} value={stats.totalQty.toLocaleString()} icon={Scissors} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("material.lotSplit.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.lotSplit.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("material.lotSplit.splitTitle")} size="lg">
        {selectedLot && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-alt dark:bg-surface rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-muted">LOT:</span> <span className="font-mono font-medium">{selectedLot.matUid}</span></div>
                <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedLot.itemCode}</span></div>
                <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedLot.itemName}</div>
                <div><span className="text-text-muted">{t("material.lotSplit.currentQty")}:</span> <span className="font-semibold">{selectedLot.currentQty.toLocaleString()} {selectedLot.unit || ""}</span></div>
              </div>
            </div>
            <Input label={t("material.lotSplit.splitQty")} type="number" placeholder="0"
              value={splitForm.splitQty} onChange={e => setSplitForm(p => ({ ...p, splitQty: e.target.value }))} fullWidth />
            <Input label={t("material.lotSplit.remark")} placeholder={t("material.lotSplit.remarkPlaceholder")}
              value={splitForm.remark} onChange={e => setSplitForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSplit}
                disabled={saving || !splitForm.splitQty || Number(splitForm.splitQty) <= 0 || Number(splitForm.splitQty) >= selectedLot.currentQty}>
                {saving ? t("common.saving") : <><Scissors className="w-4 h-4 mr-1" />{t("material.lotSplit.split")}</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
