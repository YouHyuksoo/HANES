"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FlaskConical, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import ReinspectModal, { type ReinspectTarget } from "./components/ReinspectModal";

interface ShelfLifeItem {
  matUid: string;
  itemCode: string;
  itemName?: string | null;
  currentQty?: number | null;
  unit?: string | null;
  expireDate?: string | null;
  expiryStatus: string;
  daysUntilExpiry: number | null;
  vendor?: string | null;
}

const expiryColors: Record<string, string> = {
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  NEAR_EXPIRY: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
};

function ShelfLifeReinspectContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialMatUid = searchParams.get("matUid") ?? "";

  // 재검사 대상 목록
  const [targets, setTargets] = useState<ShelfLifeItem[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");

  // 검사 모달
  const [modalTarget, setModalTarget] = useState<ReinspectTarget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const res = await api.get("/material/shelf-life", { params: { limit: "5000" } });
      const rows: ShelfLifeItem[] = res.data?.data ?? [];
      // 만료/임박 LOT만 재검사 대상
      setTargets(rows.filter((r) => r.expiryStatus === "EXPIRED" || r.expiryStatus === "NEAR_EXPIRY"));
    } catch {
      setTargets([]);
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const openModal = useCallback((item: ShelfLifeItem) => {
    setModalTarget({
      matUid: item.matUid,
      itemCode: item.itemCode,
      itemName: item.itemName,
      unit: item.unit,
      currentQty: item.currentQty,
      expireDate: item.expireDate,
      daysUntilExpiry: item.daysUntilExpiry,
    });
    setIsModalOpen(true);
  }, []);

  // URL ?matUid= 지정 시 대상 목록 로드 후 1회만 자동 오픈한다.
  // (매번 열면 모달을 닫아도 effect가 재실행되어 다시 열려 닫을 수 없게 된다)
  const autoOpenedMatUid = useRef<string | null>(null);
  useEffect(() => {
    if (!initialMatUid || targets.length === 0) return;
    if (autoOpenedMatUid.current === initialMatUid) return;
    const found = targets.find((tg) => tg.matUid === initialMatUid);
    if (found) {
      autoOpenedMatUid.current = initialMatUid;
      openModal(found);
    }
  }, [initialMatUid, targets, openModal]);

  const handleSubmitted = useCallback(() => {
    fetchTargets();
  }, [fetchTargets]);

  const expiryOptions = useMemo(() => [
    { value: "", label: `${t("material.shelfLife.nearExpiry")} + ${t("material.shelfLife.expired")}` },
    { value: "EXPIRED", label: t("material.shelfLife.expired") },
    { value: "NEAR_EXPIRY", label: t("material.shelfLife.nearExpiry") },
  ], [t]);

  const visibleTargets = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    return targets.filter((d) =>
      (!expiryFilter || d.expiryStatus === expiryFilter) &&
      (!s ||
        d.matUid?.toLowerCase().includes(s) ||
        d.itemCode?.toLowerCase().includes(s) ||
        (d.itemName ?? "").toLowerCase().includes(s)),
    );
  }, [targets, searchText, expiryFilter]);

  const targetColumns = useMemo<ColumnDef<ShelfLifeItem>[]>(() => [
    {
      id: "actions", header: t("material.col.inspect", "검사"), size: 100, enableSorting: false,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <button
          className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          onClick={() => openModal(row.original)}>
          <FlaskConical className="h-3.5 w-3.5" />
          {t("material.shelfLife.reinspect")}
        </button>
      ),
    },
    {
      accessorKey: "matUid", header: "LOT No.", size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const } },
    {
      accessorKey: "currentQty", header: t("material.shelfLife.currentQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{(row.original.currentQty ?? 0).toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "expireDate", header: t("material.shelfLife.expireDate"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => { const v = getValue() as string; return v ? new Date(v).toLocaleDateString() : "-"; },
    },
    {
      accessorKey: "daysUntilExpiry", header: t("material.shelfLife.remainDays"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const days = getValue() as number | null;
        if (days === null) return <span className="text-text-muted">-</span>;
        const cls = days < 0 ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400";
        return <span className={`font-medium ${cls}`}>{days}{t("material.shelfLife.days")}</span>;
      },
    },
    {
      accessorKey: "expiryStatus", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const label = getValue() as string;
        const displayName = label === "EXPIRED" ? t("material.shelfLife.expired") : t("material.shelfLife.nearExpiry");
        return <span className={`rounded px-2 py-0.5 text-xs font-medium ${expiryColors[label] || ""}`}>{displayName}</span>;
      },
    },
  ], [t, openModal]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text">
            <FlaskConical className="h-7 w-7 text-primary" />
            {t("material.shelfLife.reinspectTitle")}
          </h1>
          <p className="mt-1 text-text-muted">{t("material.shelfLife.reinspectSubtitle", "유수명자재 재검사 대상을 선택해 검사항목별로 검사합니다. 이력은 유수명자재 검사이력 화면에서 조회합니다.")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchTargets}>
          <RefreshCw className={`mr-1 h-4 w-4 ${targetsLoading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 재검사 대상 목록 */}
      <Card className="min-h-0 flex-1 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={visibleTargets}
            columns={targetColumns}
            isLoading={targetsLoading}
            enableColumnFilter
            enableExport
            exportFileName={t("material.shelfLife.reinspectTarget", "재검사 대상")}
            toolbarLeft={
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="min-w-0 flex-1">
                  <Input placeholder={t("material.shelfLife.searchPlaceholder")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={expiryOptions} value={expiryFilter} onChange={setExpiryFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ReinspectModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setModalTarget(null); }}
        target={modalTarget}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

export default function ShelfLifeReinspectPage() {
  return (
    <Suspense>
      <ShelfLifeReinspectContent />
    </Suspense>
  );
}
