"use client";

/**
 * @file MenuTreeNode.tsx
 * @description 메뉴 트리 개별 노드 컴포넌트 (부모 메뉴 + 하위 메뉴 렌더링)
 *
 * 초보자 가이드:
 * 1. **IndeterminateCheckbox**: HTML indeterminate 상태를 ref로 직접 설정
 * 2. **부모 노드**: 하위 메뉴가 있으면 토글 가능한 트리 노드
 * 3. **자식 노드**: 개별 체크박스로 권한 토글
 * 4. **체크 상태**: 전체 체크/일부 체크(indeterminate)/미체크 3가지 상태
 */
import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MenuConfigItem } from "@/config/menuConfig";

/** 개별 체크박스 + indeterminate 지원 */
function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-border text-primary
        focus:ring-primary focus:ring-offset-0
        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
        accent-primary"
    />
  );
}

interface MenuTreeNodeProps {
  /** 메뉴 설정 항목 */
  item: MenuConfigItem;
  /** 현재 체크된 메뉴 코드 Set */
  checkedCodes: Set<string>;
  /** 개별 메뉴 토글 콜백 */
  onToggle: (code: string, checked: boolean) => void;
  /** 부모 메뉴 토글 콜백 (하위 전체 체크/해제) */
  onToggleParent: (parentCode: string, childCodes: string[], checked: boolean) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/** 메뉴 트리 노드 (부모 메뉴 + 하위 메뉴) */
export default function MenuTreeNode({
  item,
  checkedCodes,
  onToggle,
  onToggleParent,
  disabled,
}: MenuTreeNodeProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;

  // 부모 체크 상태 계산
  const childCodes = item.children?.map((c) => c.code) ?? [];
  const checkedChildCount = childCodes.filter((c) => checkedCodes.has(c)).length;
  const allChecked = hasChildren
    ? checkedChildCount === childCodes.length
    : checkedCodes.has(item.code);
  const someChecked = hasChildren ? checkedChildCount > 0 && !allChecked : false;

  const handleParentChange = (checked: boolean) => {
    if (hasChildren) {
      onToggleParent(item.code, childCodes, checked);
    } else {
      onToggle(item.code, checked);
    }
  };

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md
          hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-muted" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <IndeterminateCheckbox
          checked={allChecked}
          indeterminate={someChecked}
          disabled={disabled}
          onChange={handleParentChange}
        />

        <span className={`text-sm ${hasChildren ? "font-semibold text-text" : "text-text"}`}>
          {t(item.labelKey)}
        </span>

        {item.code && !hasChildren && (
          <span className="text-xs text-text-muted ml-1">({item.code})</span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="ml-6 border-l border-border/50 pl-2">
          {item.children!.map((child) => (
            <div
              key={child.code}
              className="flex items-center gap-2 py-1.5 px-2 rounded-md
                hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span className="w-5" />
              <IndeterminateCheckbox
                checked={checkedCodes.has(child.code)}
                indeterminate={false}
                disabled={disabled}
                onChange={(checked) => onToggle(child.code, checked)}
              />
              <span className="text-sm text-text">{t(child.labelKey)}</span>
              <span className="text-xs text-text-muted ml-1">({child.code})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
