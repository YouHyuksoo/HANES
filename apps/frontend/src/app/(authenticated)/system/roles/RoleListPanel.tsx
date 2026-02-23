"use client";

/**
 * @file RoleListPanel.tsx
 * @description 역할 목록 좌측 패널 컴포넌트
 *
 * 초보자 가이드:
 * 1. **역할 카드**: 클릭 시 선택, code/name/isSystem 배지 표시
 * 2. **선택 하이라이트**: bg-primary/10 + border-l-2 border-primary
 * 3. **isSystem 역할**: 삭제 버튼 숨김
 * 4. **수정/삭제**: 각 역할 카드에 아이콘 버튼 제공
 */
import { useTranslation } from "react-i18next";
import { Edit2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import type { Role } from "./RoleFormModal";

interface RoleListPanelProps {
  /** 역할 목록 */
  roles: Role[];
  /** 로딩 중 여부 */
  loading: boolean;
  /** 현재 선택된 역할 */
  selectedRole: Role | null;
  /** 역할 선택 콜백 */
  onSelect: (role: Role) => void;
  /** 역할 수정 콜백 */
  onEdit: (role: Role) => void;
  /** 역할 삭제 콜백 */
  onDelete: (role: Role) => void;
}

export default function RoleListPanel({
  roles,
  loading,
  selectedRole,
  onSelect,
  onEdit,
  onDelete,
}: RoleListPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => onSelect(role)}
              className={`p-3 rounded-lg cursor-pointer transition-all border
                ${
                  selectedRole?.id === role.id
                    ? "bg-primary/10 border-l-2 border-primary dark:bg-primary/20"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50"
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-text truncate">
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      {t("system.roles.isSystem")}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(role);
                    }}
                    className="p-1 hover:bg-surface rounded"
                    title={t("common.edit")}
                  >
                    <Edit2 className="w-3.5 h-3.5 text-primary" />
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(role);
                      }}
                      className="p-1 hover:bg-surface rounded"
                      title={t("common.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-text-muted mt-1">
                {role.code}
                {role.description && ` - ${role.description}`}
              </div>
            </div>
          ))}

          {!loading && roles.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">
              {t("common.noData")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
