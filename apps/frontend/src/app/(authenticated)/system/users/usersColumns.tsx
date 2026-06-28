"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import { Edit2, Trash2, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface User {
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

interface CreateUsersGridColumnsOptions {
  t: TFunction;
  roleLabel: Record<string, string>;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export function createUsersGridColumns({
  t,
  roleLabel,
  onEditUser,
  onDeleteUser,
}: CreateUsersGridColumnsOptions): ColumnDef<User>[] {
  return [
    {
      id: "actions", header: t("common.actions", "관리"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditUser(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteUser(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "photoUrl", header: t("system.users.photo", "사진"), size: 60,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => <UserAvatar photoUrl={getValue() as string | null} />,
    },
    { accessorKey: "email", header: t("system.users.email", "이메일"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "name", header: t("system.users.name", "이름"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "empNo", header: t("system.users.empNo", "사원번호"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "dept", header: t("system.users.dept", "부서"), size: 100, meta: { filterType: "text" as const } },
    {
      accessorKey: "role", header: t("system.users.role", "역할"), size: 90,
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
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("system.users.status", "상태")} codeType="GENERAL_STATUS" align="center" />,
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="GENERAL_STATUS" value={getValue() as string} />,
    },
    {
      accessorKey: "lastLoginAt", header: t("system.users.lastLogin", "최근 로그인"), size: 150,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleString() : "-";
      },
    },
  ];
}
