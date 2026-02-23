"use client";

/**
 * @file MenuPermissionTree.tsx
 * @description 메뉴 권한 트리 컴포넌트 - 체크박스 트리로 메뉴 접근 권한을 설정
 *
 * 초보자 가이드:
 * 1. **menuConfig**: 전역 메뉴 설정에서 트리를 렌더링
 * 2. **체크박스 로직**: 부모 체크 시 하위 전체 체크, 일부만 체크 시 indeterminate 표시
 * 3. **disabled**: ADMIN 역할 선택 시 모든 체크박스 비활성화
 * 4. **MenuTreeNode**: 개별 트리 노드 컴포넌트 (별도 파일)
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { menuConfig } from "@/config/menuConfig";
import MenuTreeNode from "./MenuTreeNode";

interface MenuPermissionTreeProps {
  /** 현재 체크된 메뉴 코드 Set */
  checkedCodes: Set<string>;
  /** 체크 상태 변경 콜백 */
  onCheckedChange: (codes: Set<string>) => void;
  /** 모든 체크박스 비활성화 여부 (ADMIN용) */
  disabled?: boolean;
  /** ADMIN 안내 메시지 표시 여부 */
  isAdmin?: boolean;
}

/**
 * 메뉴 권한 트리 메인 컴포넌트
 * menuConfig를 기반으로 체크박스 트리를 렌더링하며,
 * 부모/자식 간 체크 연동 로직을 처리합니다.
 */
export default function MenuPermissionTree({
  checkedCodes,
  onCheckedChange,
  disabled = false,
  isAdmin = false,
}: MenuPermissionTreeProps) {
  const { t } = useTranslation();

  /** 개별 메뉴 토글 */
  const handleToggle = useCallback(
    (code: string, checked: boolean) => {
      const next = new Set(checkedCodes);
      if (checked) {
        next.add(code);
      } else {
        next.delete(code);
      }
      onCheckedChange(next);
    },
    [checkedCodes, onCheckedChange]
  );

  /** 부모 메뉴 토글 (하위 전체 체크/해제) */
  const handleToggleParent = useCallback(
    (parentCode: string, childCodes: string[], checked: boolean) => {
      const next = new Set(checkedCodes);
      if (checked) {
        next.add(parentCode);
        childCodes.forEach((c) => next.add(c));
      } else {
        next.delete(parentCode);
        childCodes.forEach((c) => next.delete(c));
      }
      onCheckedChange(next);
    },
    [checkedCodes, onCheckedChange]
  );

  /** 전체 선택/해제 */
  const handleSelectAll = useCallback(
    (selectAll: boolean) => {
      if (selectAll) {
        const allCodes = new Set<string>();
        menuConfig.forEach((item) => {
          allCodes.add(item.code);
          item.children?.forEach((child) => allCodes.add(child.code));
        });
        onCheckedChange(allCodes);
      } else {
        onCheckedChange(new Set());
      }
    },
    [onCheckedChange]
  );

  return (
    <div className="space-y-3">
      {/* ADMIN 안내 메시지 */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {t("system.roles.adminAllAccess")}
          </span>
        </div>
      )}

      {/* 전체 선택/해제 버튼 */}
      {!disabled && (
        <div className="flex gap-2 pb-2 border-b border-border">
          <button
            onClick={() => handleSelectAll(true)}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            {t("system.roles.selectAll")}
          </button>
          <span className="text-text-muted">|</span>
          <button
            onClick={() => handleSelectAll(false)}
            className="text-xs text-text-muted hover:text-text font-medium"
          >
            {t("system.roles.deselectAll")}
          </button>
        </div>
      )}

      {/* 메뉴 트리 */}
      <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {menuConfig.map((item) => (
          <MenuTreeNode
            key={item.code}
            item={item}
            checkedCodes={checkedCodes}
            onToggle={handleToggle}
            onToggleParent={handleToggleParent}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
