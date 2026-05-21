"use client";

/**
 * @file system/improvement-requests/page.tsx
 * @description 개선요청 관리 페이지 — 목록 조회 + 상태 필터 + 상세 모달
 *
 * 초보자 가이드:
 * 1. 상태 탭(ALL/PENDING/IN_PROGRESS/DONE)으로 필터링
 * 2. 행 클릭 시 ImprovementDetailModal 오픈
 * 3. 상태 변경 후 목록 자동 새로고침
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  improvementRequestService,
  ImprRequestItem,
} from "@/services/improvementRequestService";
import ImprovementDetailModal from "./components/ImprovementDetailModal";

const STATUS_TABS = ["ALL", "PENDING", "IN_PROGRESS", "DONE"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_I18N_KEYS: Record<string, string> = {
  PENDING: "statusPending",
  IN_PROGRESS: "statusInProgress",
  DONE: "statusDone",
};

export default function ImprovementRequestsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusTab>("ALL");
  const [items, setItems] = useState<ImprRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await improvementRequestService.list({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 50,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const tabLabel = (s: StatusTab) => {
    if (s === "ALL") return "전체";
    return t(`improvement.${STATUS_I18N_KEYS[s]}`);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold text-text">{t("improvement.managePage")}</h1>

      {/* 상태 탭 */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === s
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {tabLabel(s)}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted self-center pr-2">{total}건</span>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <p className="text-sm text-text-muted py-8 text-center">로딩 중...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">등록된 개선요청이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.imprId}
              onClick={() => setSelectedId(item.imprId)}
              className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover cursor-pointer transition-colors"
            >
              <span className={`mt-0.5 px-2 py-0.5 text-xs font-semibold rounded flex-shrink-0 ${STATUS_COLORS[item.status] ?? ""}`}>
                {t(`improvement.${STATUS_I18N_KEYS[item.status]}`)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{item.description}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {item.pageUrl} · {item.requesterNm ?? item.requesterId} · {new Date(item.createdAt).toLocaleString("ko-KR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selectedId && (
        <ImprovementDetailModal
          imprId={selectedId}
          onClose={() => setSelectedId(null)}
          onStatusChanged={load}
        />
      )}
    </div>
  );
}
