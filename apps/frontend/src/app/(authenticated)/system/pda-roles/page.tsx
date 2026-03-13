"use client";

/**
 * @file system/pda-roles/page.tsx
 * @description PDA 역할 관리 페이지 — 역할 CRUD + 메뉴 권한 체크박스
 *
 * 초보자 가이드:
 * 1. DataGrid로 역할 목록 표시 (코드, 이름, 설명, 활성여부, 메뉴 수)
 * 2. 생성/수정 모달: 역할 정보 + PDA 메뉴 체크박스
 * 3. API: /system/pda-roles (CRUD), /system/pda-roles/menu-codes (메뉴코드 목록)
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  ConfirmModal,
} from "@/components/ui";
import { api } from "@/services/api";
import PdaRoleFormModal from "./PdaRoleFormModal";

interface PdaRoleMenu {
  id: number;
  menuCode: string;
  isActive: boolean;
}

export interface PdaRole {
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  menus: PdaRoleMenu[];
  createdAt: string;
}

export default function PdaRolesPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<PdaRole[]>([]);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PdaRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PdaRole | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/system/pda-roles");
      const data = res.data?.data ?? res.data;
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  const handleEdit = (role: PdaRole) => {
    setEditingRole(role);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/system/pda-roles/${deleteTarget.code}`);
      await fetchRoles();
    } catch {
      /* ignore */
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditingRole(null);
    fetchRoles();
  };

  return (
    <div className="p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("system.pdaRoles.title")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoles}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            {t("system.pdaRoles.add")}
          </Button>
        </div>
      </div>

      {/* 역할 목록 */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {t("system.pdaRoles.code")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {t("system.pdaRoles.name")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {t("system.pdaRoles.description")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {t("system.pdaRoles.menuCount")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {t("common.status")}
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.code}
                  className="border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {role.code}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {role.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {role.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {role.menus?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        role.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {role.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(role)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400 dark:text-slate-500"
                  >
                    {t("system.pdaRoles.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 생성/수정 모달 */}
      <PdaRoleFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingRole(null);
        }}
        onSaved={handleSaved}
        editingRole={editingRole}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("system.pdaRoles.deleteTitle")}
        message={t("system.pdaRoles.deleteMsg", {
          name: deleteTarget?.name ?? "",
        })}
        confirmText={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}
