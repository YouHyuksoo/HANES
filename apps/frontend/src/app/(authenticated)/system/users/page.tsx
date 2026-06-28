"use client";

/**
 * @file src/app/(authenticated)/system/users/page.tsx
 * @description 사용자 관리 페이지 - DataGrid 기반 CRUD + 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 사용자 목록 표시/정렬/페이지네이션
 * 2. **UserFormPanel**: 우측 슬라이드 패널로 추가/수정 처리
 * 3. **ConfirmModal**: 삭제 확인 다이얼로그
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Users, Search } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { api } from "@/services/api";
import UserFormPanel from "./components/UserFormPanel";
import { createUsersGridColumns, type User } from "./usersColumns";

export default function UserPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const panelAnimateRef = useRef(true);

  const roleLabel: Record<string, string> = useMemo(() => ({
    ADMIN: t("system.users.roleAdmin", "관리자"),
    MANAGER: t("system.users.roleManager", "매니저"),
    OPERATOR: t("system.users.roleOperator", "작업자"),
    VIEWER: t("system.users.roleViewer", "조회자"),
  }), [t]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/users", { params: { search: search || undefined } });
      const result = res.data?.data ?? res.data;
      setUsers(Array.isArray(result) ? result : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingUser(null);
    panelAnimateRef.current = true;
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.email}`);
      fetchUsers();
    } catch { /* ignore */ }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, fetchUsers]);

  const columns = useMemo(() => createUsersGridColumns({
    t,
    roleLabel,
    onEditUser: (user) => { panelAnimateRef.current = !isPanelOpen; setEditingUser(user); setIsPanelOpen(true); },
    onDeleteUser: (user) => setDeleteTarget(user),
  }), [t, roleLabel, isPanelOpen]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />{t("system.users.title", "사용자 관리")}
            </h1>
            <p className="text-text-muted mt-1">{t("system.users.subtitle", "시스템 사용자를 관리합니다.")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchUsers}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh", "새로고침")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingUser(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("system.users.addUser", "사용자 추가")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={users}
              columns={columns}
              isLoading={loading}
              emptyMessage={t("system.users.emptyMessage", "등록된 사용자가 없습니다.")}
              enableColumnPinning
              enableColumnFilter
              enableExport
              exportFileName={t("system.users.title", "사용자 관리")}
              onRowClick={(row) => { if (isPanelOpen) setEditingUser(row); }}
              toolbarLeft={
                <Input
                  placeholder={t("system.users.searchPlaceholder", "이름/이메일 검색")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              }
            
            sqlQuery={`SELECT *\nFROM USERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      {isPanelOpen && (
        <UserFormPanel
          key={editingUser?.email ?? "__new__"}
          editingUser={editingUser}
          onClose={handlePanelClose}
          onSave={fetchUsers}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("system.users.deleteUser", "사용자 삭제")}
        message={t("system.users.deleteConfirm", "{{name}} 사용자를 삭제하시겠습니까?", { name: deleteTarget?.name || deleteTarget?.email })}
        confirmText={t("common.delete", "삭제")}
        variant="danger"
      />
    </div>
  );
}
