"use client";

/**
 * @file src/app/(authenticated)/production/repair/page.tsx
 * @description 수리관리 페이지 - 수리등록/이력조회/수리실 재고 관리
 *
 * 초보자 가이드:
 * 1. 상단: 통계 카드 (입고/수리중/완료)
 * 2. 필터: 수리일자, 상태, 발생공정, 수리자, 검색어
 * 3. DataGrid: 수리 목록 (행 클릭 → 수정 모달)
 * 4. API: GET /production/repairs (목록), POST/PUT/DELETE (CRUD)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  RefreshCw,
  Plus,
  Wrench,
  PackageCheck,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Input,
  StatCard,
  ConfirmModal,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect, ProcessSelect, WorkerSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import api from "@/services/api";
import RepairFormModal from "./components/RepairFormModal";
import type { RepairOrderData } from "./components/RepairFormModal";
import { createRepairGridColumns } from "./repairColumns";
import type { RepairItem } from "./repairColumns";

export default function RepairPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<RepairItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceProcessFilter, setSourceProcessFilter] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchText, setSearchText] = useState("");

  // 모달 상태
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<RepairOrderData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RepairItem | null>(null);

  /** 목록 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (sourceProcessFilter) params.sourceProcess = sourceProcessFilter;
      if (workerFilter) params.workerId = workerFilter;
      if (startDate) params.repairDateFrom = startDate;
      if (endDate) params.repairDateTo = endDate;
      const res = await api.get("/production/repairs", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, sourceProcessFilter, workerFilter, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** 통계 */
  const stats = useMemo(() => {
    const received = data.filter((d) => d.status === "RECEIVED").length;
    const inRepair = data.filter((d) => d.status === "IN_REPAIR").length;
    const completed = data.filter((d) => d.status === "COMPLETED").length;
    return { received, inRepair, completed };
  }, [data]);

  /** 행 클릭 → 상세 조회 → 수정 모달 */
  const handleRowClick = useCallback(async (row: RepairItem) => {
    try {
      const dateStr = typeof row.repairDate === "string"
        ? row.repairDate.substring(0, 10)
        : new Date(row.repairDate).toISOString().substring(0, 10);
      const res = await api.get(`/production/repairs/${dateStr}/${row.seq}`);
      const detail = res.data?.data;
      setEditData({
        ...detail,
        repairDate: dateStr,
      });
      setFormOpen(true);
    } catch {
      // 에러는 api interceptor에서 처리
    }
  }, []);

  /** 삭제 */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const dateStr = typeof deleteTarget.repairDate === "string"
        ? deleteTarget.repairDate.substring(0, 10)
        : new Date(deleteTarget.repairDate).toISOString().substring(0, 10);
      await api.delete(`/production/repairs/${dateStr}/${deleteTarget.seq}`);
      fetchData();
    } catch {
      // 에러는 api interceptor에서 처리
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  /** 신규 등록 */
  const handleNew = useCallback(() => {
    setEditData(null);
    setFormOpen(true);
  }, []);

  /** 컬럼 정의 */
  const columns = useMemo(
    () => createRepairGridColumns({ t, onDeleteRepair: setDeleteTarget }),
    [t]
  );

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary dark:text-slate-100">
            {t("production.repair.title")}
          </h1>
          <p className="text-sm text-text-muted">{t("production.repair.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
          </Button>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1" /> {t("production.repair.registerRepair")}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label={t("production.repair.totalReceived")}
          value={stats.received}
          icon={PackageCheck}
          color="blue"
        />
        <StatCard
          label={t("production.repair.totalInRepair")}
          value={stats.inRepair}
          icon={Wrench}
          color="orange"
        />
        <StatCard
          label={t("production.repair.totalCompleted")}
          value={stats.completed}
          icon={Clock}
          color="green"
        />
      </div>

      {/* 필터 + DataGrid */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            onRowClick={handleRowClick}
            enableColumnFilter
            enableExport
            exportFileName="repair-management"
            maxHeight="calc(100vh - 340px)"
            toolbarLeft={
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder={t("production.repair.searchPlaceholder")}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="w-64"
                />
                <ComCodeSelect
                  groupCode="REPAIR_RESULT"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  labelPrefix={t("production.repair.status")}
                  className="w-40"
                />
                <ProcessSelect
                  value={sourceProcessFilter}
                  onChange={setSourceProcessFilter}
                  labelPrefix={t("production.repair.sourceProcess")}
                  className="w-40"
                />
                <DateRangeFilter from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM REPAIRS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent>
      </Card>

      {/* 수리 등록/수정 모달 */}
      <RepairFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchData}
        editData={editData}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("common.delete")}
        message={t("production.repair.deleteConfirm")}
      />
    </div>
  );
}
