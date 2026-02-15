"use client";

/**
 * @file src/app/(authenticated)/master/label/components/LabelGrid.tsx
 * @description 라벨 출력 대상 항목 선택 테이블 - 체크박스 기반 다중 선택
 *
 * 초보자 가이드:
 * 1. **전체 선택**: 헤더 체크박스로 전체 토글
 * 2. **개별 선택**: 행 클릭 또는 체크박스로 개별 토글
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui";
import { LabelItem } from "../types";

interface LabelGridProps {
  items: LabelItem[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export default function LabelGrid({ items, selectedIds, onSelectionChange }: LabelGridProps) {
  const { t } = useTranslation();

  const toggleItem = useCallback((id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const toggleAll = useCallback(() => {
    onSelectionChange(selectedIds.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  }, [items, selectedIds.size, onSelectionChange]);

  return (
    <Card><CardContent>
      <div className="overflow-auto max-h-[600px] rounded-lg border border-border">
        <table className="text-sm w-full">
          <thead className="bg-background sticky top-0">
            <tr>
              <th className="px-3 py-2.5 w-10 border-b border-border">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={toggleAll}
                  className="accent-primary"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-text border-b border-border">{t("master.label.code")}</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text border-b border-border">{t("master.label.name")}</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text border-b border-border">{t("master.label.subInfo")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`cursor-pointer transition-colors border-b border-border last:border-b-0 ${
                  selectedIds.has(item.id) ? "bg-primary/5" : idx % 2 === 0 ? "bg-surface" : "bg-background/50"
                } hover:bg-primary/10`}
              >
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="accent-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2.5 font-mono text-text">{item.code}</td>
                <td className="px-3 py-2.5 text-text">{item.name}</td>
                <td className="px-3 py-2.5 text-text-muted">{item.sub || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  );
}
