"use client";

/**
 * @file master/code/components/GroupList.tsx
 * @description 공통코드 그룹 목록 (좌측 패널)
 *
 * 초보자 가이드:
 * 1. **그룹 선택**: 클릭 시 해당 그룹의 상세 코드를 우측에 표시
 * 2. **검색**: 그룹코드명으로 필터링
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui";
import type { ComCodeGroup } from "../types";

interface GroupListProps {
  groups: ComCodeGroup[];
  selectedGroup: string;
  onSelect: (groupCode: string) => void;
  isLoading: boolean;
}

export default function GroupList({ groups, selectedGroup, onSelect, isLoading }: GroupListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return groups;
    const keyword = search.toUpperCase();
    const keywordLower = search.toLowerCase();
    return groups.filter((g) => {
      if (g.groupCode.includes(keyword)) return true;
      // 그룹 설명(번역)으로도 검색 가능
      const desc = t(`comCodeGroup.${g.groupCode}`, { defaultValue: "" });
      return desc.toLowerCase().includes(keywordLower);
    });
  }, [groups, search, t]);

  return (
    <Card padding="none" className="flex-1 flex flex-col min-h-0">
      <CardHeader
        title={t("master.code.groupCode")}
        subtitle={`${groups.length}${t("master.code.groupsCount", { defaultValue: "개 그룹" })}`}
        className="px-4 pt-4"
      />
      <CardContent className="flex-1 flex flex-col min-h-0 px-4 pb-4">
        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="py-8 text-center text-text-muted text-sm">
              {t("common.loading", { defaultValue: "로딩중..." })}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              {t("common.noData", { defaultValue: "데이터가 없습니다" })}
            </div>
          ) : (
            filtered.map((group) => (
              <button
                key={group.groupCode}
                onClick={() => onSelect(group.groupCode)}
                className={`w-full flex justify-between items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedGroup === group.groupCode
                    ? "bg-primary text-white"
                    : "hover:bg-surface-hover text-text"
                }`}
              >
                <div className="text-left min-w-0">
                  <div className="font-mono text-xs truncate">{group.groupCode}</div>
                  <div
                    className={`text-[11px] truncate ${
                      selectedGroup === group.groupCode
                        ? "text-white/70"
                        : "text-text-muted"
                    }`}
                  >
                    {t(`comCodeGroup.${group.groupCode}`, { defaultValue: group.groupCode })}
                  </div>
                </div>
                <span
                  className={`ml-2 flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
                    selectedGroup === group.groupCode
                      ? "bg-white/20 text-white"
                      : "bg-surface text-text-muted"
                  }`}
                >
                  {group.count}
                </span>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
