"use client";

/**
 * @file src/app/(authenticated)/quality/rework-inspect/page.tsx
 * @description 재작업 후 검사 페이지 - IATF 16949 재작업 완료 건 재검증 검사 실적 입력
 *
 * 초보자 가이드:
 * 1. **재검사 대기 목록**: status=INSPECT_PENDING 인 ReworkOrder 조회
 * 2. **검사 등록**: 행의 [재검사] 버튼 클릭 → InspectFormModal 에서 입력
 * 3. **StatCard**: 재검사대기 건수, 합격 건수, 불합격 건수
 * 4. API: GET /quality/reworks?status=INSPECT_PENDING, POST /quality/rework-inspects
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  RefreshCw,
  ClipboardCheck,
  Clock,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Input,
  StatCard,
  ComCodeBadge,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import InspectFormModal, {
  type InspectTarget,
} from "./components/InspectFormModal";

/** 재작업 지시 행 타입 */
interface ReworkOrder {
  id: number;
  reworkNo: string;
  itemCode: string;
  itemName: string;
  reworkQty: number;
  resultQty: number;
  workerCode: string;
  endAt: string;
  status: string;
}

export default function ReworkInspectPage() {
  const { t } = useTranslation();

  /* ── 상태 ── */
  const [data, setData] = useState<ReworkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<InspectTarget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);

  /* ── 목록 조회 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        status: "INSPECT_PENDING",
        limit: "5000",
      };
      if (searchText) params.search = searchText;
      const res = await api.get("/quality/reworks", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  /* ── 통계 조회 ── */
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/quality/reworks/stats");
      const rawStats: { status: string; count: string }[] = res.data?.data ?? [];
      setPassCount(Number(rawStats.find((s) => s.status === "PASS")?.count ?? 0));
      setFailCount(Number(rawStats.find((s) => s.status === "FAIL")?.count ?? 0));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [fetchData, fetchStats]);

  /* ── 모달 열기 ── */
  const openInspectModal = useCallback((row: ReworkOrder) => {
    setSelectedTarget({
      id: row.id,
      reworkNo: row.reworkNo,
      itemCode: row.itemCode,
      reworkQty: row.reworkQty,
      resultQty: row.resultQty,
    });
    setIsModalOpen(true);
  }, []);

  /* ── 등록 성공 콜백 ── */
  const handleSuccess = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTarget(null);
    fetchData();
    fetchStats();
  }, [fetchData, fetchStats]);

  /* ── 컬럼 정의 ── */
  const columns = useMemo<ColumnDef<ReworkOrder>[]>(
    () => [
      {
        accessorKey: "reworkNo",
        header: t("quality.rework.reworkNo"),
        size: 170,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="text-primary font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "itemCode",
        header: t("quality.rework.itemCode"),
        size: 120,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "itemName",
        header: t("quality.rework.itemName"),
        size: 160,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "reworkQty",
        header: t("quality.rework.reworkQty"),
        size: 90,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-right block">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "resultQty",
        header: t("quality.rework.resultQty"),
        size: 90,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-right block">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "workerCode",
        header: t("quality.rework.worker"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "endAt",
        header: t("quality.rework.complete"),
        size: 140,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return v ? new Date(v).toLocaleString() : "-";
        },
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        size: 110,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="REWORK_STATUS" code={getValue() as string} />
        ),
      },
      {
        id: "actions",
        header: t("common.manage"),
        size: 100,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <Button size="sm" variant="secondary" onClick={() => openInspectModal(row.original)}>
            <ClipboardCheck className="w-4 h-4 mr-1" />
            {t("quality.rework.inspect")}
          </Button>
        ),
      },
    ],
    [t, openInspectModal],
  );

  /* ── 렌더링 ── */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("quality.rework.inspectTitle")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.rework.inspectSubtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label={t("quality.rework.statsInspectPending")}
          value={data.length}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          label={t("quality.rework.statusPASS")}
          value={passCount}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label={t("quality.rework.statusFAIL")}
          value={failCount}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* 데이터 그리드 */}
      <Card>
        <CardContent>
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("quality.rework.inspectTitle")}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder={t("common.search")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 검사 등록 모달 */}
      <InspectFormModal
        isOpen={isModalOpen}
        target={selectedTarget}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTarget(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
