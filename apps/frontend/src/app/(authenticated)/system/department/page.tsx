"use client";

/**
 * @file src/app/(authenticated)/system/department/page.tsx
 * @description 부서 관리 페이지 - DataGrid 기반 CRUD
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 부서 목록 표시/정렬/페이지네이션
 * 2. **Modal**: 부서 추가/수정 폼
 * 3. **ConfirmModal**: 삭제 확인 다이얼로그
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, RefreshCw, Building, Search } from "lucide-react";
import {
  Card, CardContent, Button, Input, Modal, ConfirmModal, Select,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/services/api";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [search, setSearch] = useState("");

  // 폼 상태
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formParent, setFormParent] = useState("");
  const [formSort, setFormSort] = useState("0");
  const [formManager, setFormManager] = useState("");
  const [formRemark, setFormRemark] = useState("");
  const [formUseYn, setFormUseYn] = useState("Y");
  const [formError, setFormError] = useState("");

  const useYnOptions = useMemo(
    () => [
      { value: "Y", label: t("common.yes", "사용") },
      { value: "N", label: t("common.no", "미사용") },
    ],
    [t]
  );

  const parentOptions = useMemo(() => {
    const opts = [{ value: "", label: t("common.none", "없음") }];
    departments
      .filter((d) => d.useYn === "Y")
      .forEach((d) => opts.push({ value: d.deptCode, label: `${d.deptCode} - ${d.deptName}` }));
    return opts;
  }, [departments, t]);

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

  const openCreateModal = () => {
    setEditing(null);
    setFormCode("");
    setFormName("");
    setFormParent("");
    setFormSort("0");
    setFormManager("");
    setFormRemark("");
    setFormUseYn("Y");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditing(dept);
    setFormCode(dept.deptCode);
    setFormName(dept.deptName);
    setFormParent(dept.parentDeptCode || "");
    setFormSort(String(dept.sortOrder));
    setFormManager(dept.managerName || "");
    setFormRemark(dept.remark || "");
    setFormUseYn(dept.useYn);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formCode.trim() || !formName.trim()) {
      setFormError(t("common.requiredField", "필수 항목을 입력하세요."));
      return;
    }
    try {
      const payload = {
        deptCode: formCode.trim(),
        deptName: formName.trim(),
        parentDeptCode: formParent || undefined,
        sortOrder: parseInt(formSort) || 0,
        managerName: formManager || undefined,
        remark: formRemark || undefined,
        useYn: formUseYn,
      };
      if (editing) {
        await api.put(`/system/departments/${editing.id}`, payload);
      } else {
        await api.post("/system/departments", payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || t("common.saveFailed"));
    }
  };

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
      { accessorKey: "deptCode", header: t("system.department.deptCode"), size: 120 },
      { accessorKey: "deptName", header: t("system.department.deptName"), size: 180 },
      {
        accessorKey: "parentDeptCode",
        header: t("system.department.parentDeptCode"),
        size: 120,
        cell: ({ getValue }) => getValue() || "-",
      },
      { accessorKey: "sortOrder", header: t("system.department.sortOrder"), size: 80 },
      {
        accessorKey: "managerName",
        header: t("system.department.managerName"),
        size: 120,
        cell: ({ getValue }) => getValue() || "-",
      },
      {
        accessorKey: "useYn",
        header: t("system.department.useYn"),
        size: 80,
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
        cell: ({ getValue }) => getValue() || "-",
      },
      {
        id: "actions",
        header: t("common.actions"),
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button onClick={() => openEditModal(row.original)} className="p-1 hover:bg-surface rounded">
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
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
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" /> {t("system.department.addDepartment")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <DataGrid
            data={departments}
            columns={columns}
            isLoading={loading}
            emptyMessage={t("system.department.emptyMessage")}
            enableExport
            exportFileName={t("system.department.title")}
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

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? t("system.department.editDepartment") : t("system.department.addDepartment")}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("system.department.deptCode")}
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              disabled={!!editing}
              fullWidth
              required
            />
            <Input
              label={t("system.department.deptName")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("system.department.parentDeptCode")}
              value={formParent}
              onChange={(v) => setFormParent(v)}
              options={parentOptions}
              fullWidth
            />
            <Input
              label={t("system.department.sortOrder")}
              type="number"
              value={formSort}
              onChange={(e) => setFormSort(e.target.value)}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("system.department.managerName")}
              value={formManager}
              onChange={(e) => setFormManager(e.target.value)}
              fullWidth
            />
            <Select
              label={t("system.department.useYn")}
              value={formUseYn}
              onChange={(v) => setFormUseYn(v)}
              options={useYnOptions}
              fullWidth
            />
          </div>
          <Input
            label={t("system.department.remark")}
            value={formRemark}
            onChange={(e) => setFormRemark(e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit}>
              {editing ? t("common.edit") : t("common.add")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 */}
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
