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
import { Plus, Edit2, Trash2, RefreshCw, Users, Search } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/services/api";
import UserFormPanel from "./components/UserFormPanel";

interface User {
  id: string;
  email: string;
  name: string | null;
  empNo: string | null;
  dept: string | null;
  role: string;
  status: string;
  photoUrl: string | null;
  pdaRoleCode: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** 사용자 아바타 (이미지 로드 실패 시 기본 아이콘 폴백) */
function UserAvatar({ photoUrl }: { photoUrl: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (!photoUrl || imgError) {
    return (
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <Users className="w-5 h-5 text-primary" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
      <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
    </div>
  );
}

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
    ADMIN: t("system.users.roleAdmin"),
    MANAGER: t("system.users.roleManager"),
    OPERATOR: t("system.users.roleOperator"),
    VIEWER: t("system.users.roleViewer"),
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
      await api.delete(`/users/${deleteTarget.id}`);
      fetchUsers();
    } catch { /* ignore */ }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, fetchUsers]);

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingUser(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "photoUrl", header: t("system.users.photo"), size: 60,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => <UserAvatar photoUrl={getValue() as string | null} />,
    },
    { accessorKey: "email", header: t("system.users.email"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "name", header: t("system.users.name"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "empNo", header: t("system.users.empNo"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "dept", header: t("system.users.dept"), size: 100, meta: { filterType: "text" as const } },
    {
      accessorKey: "role", header: t("system.users.role"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const role = getValue() as string;
        const colorMap: Record<string, string> = {
          ADMIN: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
          MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
          OPERATOR: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
          VIEWER: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${colorMap[role] || ""}`}>
            {roleLabel[role] || role}
          </span>
        );
      },
    },
    {
      accessorKey: "status", header: t("system.users.status"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${
            status === "ACTIVE"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}>
            {status === "ACTIVE" ? t("system.users.statusActive") : t("system.users.statusInactive")}
          </span>
        );
      },
    },
    {
      accessorKey: "lastLoginAt", header: t("system.users.lastLogin"), size: 150,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleString("ko-KR") : "-";
      },
    },
  ], [t, roleLabel, isPanelOpen]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />{t("system.users.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("system.users.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchUsers}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingUser(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("system.users.addUser")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={users}
              columns={columns}
              isLoading={loading}
              emptyMessage={t("system.users.emptyMessage")}
              enableColumnPinning
              enableColumnFilter
              enableExport
              exportFileName={t("system.users.title")}
              onRowClick={(row) => { if (isPanelOpen) setEditingUser(row); }}
              toolbarLeft={
                <Input
                  placeholder={t("system.users.searchPlaceholder")}
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
        <UserFormPanel
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
        title={t("system.users.deleteUser")}
        message={t("system.users.deleteConfirm", { name: deleteTarget?.name || deleteTarget?.email })}
        confirmText={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}
