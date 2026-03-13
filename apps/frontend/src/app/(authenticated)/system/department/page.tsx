"use client";

/**
 * @file src/app/(authenticated)/system/department/page.tsx
 * @description 부서 관리 페이지 - DataGrid 기반 CRUD + 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 부서 목록 표시/정렬/페이지네이션
 * 2. **우측 패널**: 추가/수정 폼은 우측 슬라이드 패널에서 처리
 * 3. **ConfirmModal**: 삭제 확인 다이얼로그
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, RefreshCw, Building, Search } from "lucide-react";
import {
  Card, CardContent, Button, Input, ConfirmModal,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/services/api";
import DepartmentFormPanel from "./components/DepartmentFormPanel";

interface Department {
  id: string;
  deptCode: string;
  deptName: string;
  parentDeptCode: string | null;
  sortOrder: number;
  managerName: string | null;
  remark: string | null;
  useYn: string;
  createdAt: string;
}

function DepartmentPage() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const panelAnimateRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/system/departments", {
        params: { search: search || undefined, limit: 200 },
      });
      const result = res.data?.data ?? res.data;
      setDepartments(Array.isArray(result) ? result : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingDept(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/system/departments/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      /* ignore */
    }
  };

  const columns = useMemo<ColumnDef<Department>[]>(
    () => [
      {
        id: "actions",
        header: t("common.actions"),
        size: 100,
        meta: { align: "center" as const, filterType: "none" as const },
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                panelAnimateRef.current = !isPanelOpen;
                setEditingDept(row.original);
                setIsPanelOpen(true);
              }}
              className="p-1 hover:bg-surface rounded"
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
              className="p-1 hover:bg-surface rounded"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
      { accessorKey: "deptCode", header: t("system.department.deptCode"), size: 120, meta: { filterType: "text" as const } },
      { accessorKey: "deptName", header: t("system.department.deptName"), size: 180, meta: { filterType: "text" as const } },
      {
        accessorKey: "parentDeptCode",
        header: t("system.department.parentDeptCode"),
        size: 120,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => getValue() || "-",
      },
      { accessorKey: "sortOrder", header: t("system.department.sortOrder"), size: 80, meta: { filterType: "number" as const } },
      {
        accessorKey: "managerName",
        header: t("system.department.managerName"),
        size: 120,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => getValue() || "-",
      },
      {
        accessorKey: "useYn",
        header: t("system.department.useYn"),
        size: 80,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                v === "Y"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {v === "Y" ? t("common.yes", "사용") : t("common.no", "미사용")}
            </span>
          );
        },
      },
      {
        accessorKey: "remark",
        header: t("system.department.remark"),
        size: 200,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => getValue() || "-",
      },
    ],
    [t, isPanelOpen]
  );

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Building className="w-7 h-7 text-primary" />
              {t("system.department.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("system.department.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingDept(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> {t("system.department.addDepartment")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={departments}
              columns={columns}
              isLoading={loading}
              emptyMessage={t("system.department.emptyMessage")}
              enableExport
              enableColumnFilter
              exportFileName={t("system.department.title")}
              onRowClick={(row) => { if (isPanelOpen) setEditingDept(row); }}
              toolbarLeft={
                <Input
                  placeholder={t("system.department.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              }
            />
          </CardContent>
        </Card>
      </div>

      {isPanelOpen && (
        <DepartmentFormPanel
          editingDept={editingDept}
          departments={departments}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("system.department.deleteDepartment")}
        message={t("system.department.deleteConfirm", { name: deleteTarget?.deptName })}
        confirmText={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}

export default DepartmentPage;
