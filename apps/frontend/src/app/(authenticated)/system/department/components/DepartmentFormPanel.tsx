/**
 * @file system/department/components/DepartmentFormPanel.tsx
 * @description 부서 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **상위부서 Select**: 현재 부서 목록에서 선택 가능
 * 3. **API**: POST /system/departments (생성), PUT /system/departments/:id (수정)
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "@/components/ui";
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

interface Props {
  editingDept: Department | null;
  departments: Department[];
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function DepartmentFormPanel({ editingDept, departments, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingDept;

  const [form, setForm] = useState({
    deptCode: editingDept?.deptCode ?? "",
    deptName: editingDept?.deptName ?? "",
    parentDeptCode: editingDept?.parentDeptCode ?? "",
    sortOrder: String(editingDept?.sortOrder ?? 0),
    managerName: editingDept?.managerName ?? "",
    remark: editingDept?.remark ?? "",
    useYn: editingDept?.useYn ?? "Y",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setForm({
      deptCode: editingDept?.deptCode ?? "",
      deptName: editingDept?.deptName ?? "",
      parentDeptCode: editingDept?.parentDeptCode ?? "",
      sortOrder: String(editingDept?.sortOrder ?? 0),
      managerName: editingDept?.managerName ?? "",
      remark: editingDept?.remark ?? "",
      useYn: editingDept?.useYn ?? "Y",
    });
    setFormError("");
  }, [editingDept]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

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
      .filter((d) => d.useYn === "Y" && d.deptCode !== editingDept?.deptCode)
      .forEach((d) => opts.push({ value: d.deptCode, label: `${d.deptCode} - ${d.deptName}` }));
    return opts;
  }, [departments, editingDept, t]);

  const handleSubmit = async () => {
    setFormError("");
    if (!form.deptCode.trim() || !form.deptName.trim()) {
      setFormError(t("common.requiredField", "필수 항목을 입력하세요."));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        deptCode: form.deptCode.trim(),
        deptName: form.deptName.trim(),
        parentDeptCode: form.parentDeptCode || undefined,
        sortOrder: parseInt(form.sortOrder) || 0,
        managerName: form.managerName.trim() || undefined,
        remark: form.remark.trim() || undefined,
        useYn: form.useYn,
      };
      if (isEdit && editingDept) {
        await api.put(`/system/departments/${editingDept.id}`, payload);
      } else {
        await api.post("/system/departments", payload);
      }
      onSave();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("system.department.editDepartment") : t("system.department.addDepartment")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.deptCode.trim() || !form.deptName.trim()}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {formError && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            {formError}
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("system.department.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("system.department.deptCode")}
              value={form.deptCode}
              onChange={e => setField("deptCode", e.target.value)}
              disabled={isEdit}
              fullWidth
              required
            />
            <Input
              label={t("system.department.deptName")}
              value={form.deptName}
              onChange={e => setField("deptName", e.target.value)}
              fullWidth
              required
            />
            <Select
              label={t("system.department.parentDeptCode")}
              value={form.parentDeptCode}
              onChange={v => setField("parentDeptCode", v)}
              options={parentOptions}
              fullWidth
            />
            <Input
              label={t("system.department.sortOrder")}
              type="number"
              value={form.sortOrder}
              onChange={e => setField("sortOrder", e.target.value)}
              fullWidth
            />
            <Input
              label={t("system.department.managerName")}
              value={form.managerName}
              onChange={e => setField("managerName", e.target.value)}
              fullWidth
            />
            <Select
              label={t("system.department.useYn")}
              value={form.useYn}
              onChange={v => setField("useYn", v)}
              options={useYnOptions}
              fullWidth
            />
          </div>
        </div>

        <div>
          <Input
            label={t("system.department.remark")}
            value={form.remark}
            onChange={e => setField("remark", e.target.value)}
            fullWidth
          />
        </div>
      </div>
    </div>
  );
}
