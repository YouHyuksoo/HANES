"use client";

/**
 * @file system/roles/page.tsx
 * @description 역할 관리 페이지 - 역할 CRUD + 메뉴 권한 트리 설정
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: RoleListPanel (역할 목록, 선택/수정/삭제)
 * 2. **우측 패널**: MenuPermissionTree (메뉴 권한 체크박스 트리)
 * 3. **ADMIN 역할**: 모든 메뉴 접근 가능, 권한 수정 불가
 * 4. **API**: /roles (CRUD), /roles/:id/permissions (권한 조회/저장)
 * 5. **RoleFormModal**: 역할 추가/수정 모달 (별도 파일)
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Shield, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, Button, ConfirmModal } from "@/components/ui";
import { api } from "@/services/api";
import { getAllMenuCodes } from "@/config/menuConfig";
import MenuPermissionTree from "./MenuPermissionTree";
import RoleFormModal, { type Role } from "./RoleFormModal";
import RoleListPanel from "./RoleListPanel";

export default function RolesPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // 권한 상태
  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(new Set());
  const [originalCodes, setOriginalCodes] = useState<Set<string>>(new Set());
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);

  // 모달 상태
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  /** 역할 목록 조회 */
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/roles");
      const data = res.data?.data ?? res.data;
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /** 역할 선택 시 권한 조회 */
  const handleSelectRole = useCallback(async (role: Role) => {
    setSelectedRole(role);
    setSuccessMsg("");

    if (role.code === "ADMIN") {
      const allCodes = new Set(getAllMenuCodes());
      setCheckedCodes(allCodes);
      setOriginalCodes(allCodes);
      return;
    }

    setPermLoading(true);
    try {
      const res = await api.get(`/roles/${role.id}/permissions`);
      const data = res.data?.data ?? res.data;
      const codes = new Set<string>(
        Array.isArray(data)
          ? data.map((p: { menuCode: string }) => p.menuCode)
          : []
      );
      setCheckedCodes(codes);
      setOriginalCodes(new Set(codes));
    } catch {
      setCheckedCodes(new Set());
      setOriginalCodes(new Set());
    } finally {
      setPermLoading(false);
    }
  }, []);

  /** 권한 저장 */
  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setPermSaving(true);
    try {
      await api.put(`/roles/${selectedRole.id}/permissions`, {
        menuCodes: Array.from(checkedCodes),
      });
      setOriginalCodes(new Set(checkedCodes));
      setSuccessMsg(t("system.roles.permissionsSaved"));
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      // 에러 무시
    } finally {
      setPermSaving(false);
    }
  };

  /** 권한 초기화 */
  const handleResetPermissions = () => {
    if (selectedRole) handleSelectRole(selectedRole);
  };

  /** 역할 삭제 처리 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      if (selectedRole?.id === deleteTarget.id) {
        setSelectedRole(null);
        setCheckedCodes(new Set());
        setOriginalCodes(new Set());
      }
      setDeleteTarget(null);
      fetchRoles();
    } catch {
      // 에러 무시
    }
  };

  const isAdmin = selectedRole?.code === "ADMIN";
  const hasChanges =
    !isAdmin &&
    selectedRole &&
    (checkedCodes.size !== originalCodes.size ||
      [...checkedCodes].some((c) => !originalCodes.has(c)));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            {t("system.roles.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("system.roles.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchRoles}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => { setEditingRole(null); setFormModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            {t("system.roles.addRole")}
          </Button>
        </div>
      </div>

      {/* 메인 콘텐츠: 좌측 역할 목록 + 우측 권한 트리 */}
      <div className="grid grid-cols-12 gap-4">
        {/* 좌측: 역할 목록 */}
        <div className="col-span-4">
          <RoleListPanel
            roles={roles}
            loading={loading}
            selectedRole={selectedRole}
            onSelect={handleSelectRole}
            onEdit={(role) => { setEditingRole(role); setFormModalOpen(true); }}
            onDelete={setDeleteTarget}
          />
        </div>

        {/* 우측: 메뉴 권한 트리 */}
        <div className="col-span-8">
          <Card>
            <CardContent>
              {selectedRole ? (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold text-text">
                    {t("system.roles.menuPermissions")} ({selectedRole.name})
                  </h2>

                  {successMsg && (
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300 text-center">
                      {successMsg}
                    </div>
                  )}

                  {permLoading ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : (
                    <MenuPermissionTree
                      checkedCodes={checkedCodes}
                      onCheckedChange={setCheckedCodes}
                      disabled={isAdmin}
                      isAdmin={isAdmin}
                    />
                  )}

                  {!isAdmin && (
                    <div className="flex justify-end gap-2 pt-4 border-t border-border">
                      <Button variant="secondary" size="sm" onClick={handleResetPermissions}>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {t("system.roles.resetPermissions")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePermissions}
                        disabled={permSaving || !hasChanges}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {permSaving ? t("common.saving") : t("system.roles.savePermissions")}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-text-muted">
                  <p className="text-sm">{t("system.roles.selectRole")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 역할 추가/수정 모달 */}
      <RoleFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        role={editingRole}
        onSaved={fetchRoles}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("common.delete")}
        message={t("system.roles.confirmDelete")}
        confirmText={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}
