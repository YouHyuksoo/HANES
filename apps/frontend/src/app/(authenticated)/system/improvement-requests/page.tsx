"use client";

/**
 * @file system/improvement-requests/page.tsx
 * @description 개선요청 관리 페이지 — 키워드·날짜·상태 필터 + 페이지네이션 + 상태 변경
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import {
  improvementRequestService,
  ImprRequestItem,
} from "@/services/improvementRequestService";
import ImprovementDetailModal from "./components/ImprovementDetailModal";

const STATUS_TABS = ["ALL", "PENDING", "IN_PROGRESS", "DONE"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-700 border-yellow-400 bg-yellow-50 dark:text-yellow-300 dark:border-yellow-600 dark:bg-yellow-900/30",
  IN_PROGRESS: "text-blue-700 border-blue-400 bg-blue-50 dark:text-blue-300 dark:border-blue-600 dark:bg-blue-900/30",
  DONE: "text-emerald-700 border-emerald-400 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-600 dark:bg-emerald-900/30",
};

const STATUS_I18N: Record<string, string> = {
  PENDING: "improvement.statusPending",
  IN_PROGRESS: "improvement.statusInProgress",
  DONE: "improvement.statusDone",
};

const PAGE_SIZE = 20;

export default function ImprovementRequestsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusTab>("ALL");
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [items, setItems] = useState<ImprRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const keywordRef = useRef(keyword);
  keywordRef.current = keyword;

  const load = useCallback(async (p: number, status: StatusTab, kw: string, from: string, to: string) => {
    setIsLoading(true);
    try {
      const res = await improvementRequestService.list({
        status: status === "ALL" ? undefined : status,
        keyword: kw.trim() || undefined,
        fromDate: from || undefined,
        toDate: to || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, statusFilter, keyword, fromDate, toDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, fromDate, toDate]);

  const handleSearch = () => {
    setPage(1);
    load(1, statusFilter, keyword, fromDate, toDate);
  };

  const handleReset = () => {
    setKeyword("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setStatusFilter("ALL");
    load(1, "ALL", "", "", "");
  };

  const handleStatusTab = (s: StatusTab) => {
    setStatusFilter(s);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-4 h-full flex flex-col min-h-0">
      <h1 className="text-lg font-bold text-text flex-shrink-0">{t("improvement.managePage")}</h1>

      {/* 검색 필터 */}
      <div className="flex-shrink-0 flex flex-wrap gap-2 p-3 bg-surface rounded-lg border border-border items-end">
        {/* 키워드 */}
        <div className="flex-1 min-w-[180px]">
          <p className="text-xs text-text-muted mb-1">{t("common.keyword", "키워드")}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("improvement.keywordPlaceholder", "설명 또는 페이지 검색")}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 등록일 범위 */}
        <div>
          <p className="text-xs text-text-muted mb-1">{t("common.fromDate", "시작일")}</p>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">{t("common.toDate", "종료일")}</p>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 버튼 */}
        <button
          onClick={handleSearch}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {t("common.search", "조회")}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm border border-border text-text-muted hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          {t("common.reset", "초기화")}
        </button>
      </div>

      {/* 상태 탭 */}
      <div className="flex-shrink-0 flex gap-1 border-b border-border">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => handleStatusTab(s)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === s
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {s === "ALL" ? t("common.all", "전체") : t(STATUS_I18N[s])}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted self-center pr-2">{total}{t("common.countSuffix", "건")}</span>
      </div>

      {/* 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-text-muted py-8 text-center">{t("common.loading", "로딩 중...")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">{t("improvement.empty", "등록된 개선요청이 없습니다")}</p>
        ) : (
          <div className="space-y-2 pb-4">
            {items.map((item) => (
              <div
                key={item.imprId}
                onClick={() => setSelectedId(item.imprId)}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover cursor-pointer transition-colors"
              >
                <span className={`mt-0.5 px-2 py-0.5 text-xs font-semibold rounded border flex-shrink-0 ${STATUS_COLORS[item.status] ?? ""}`}>
                  {t(STATUS_I18N[item.status] ?? "")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text line-clamp-2">{item.description}</p>
                  <p className="text-xs text-text-muted mt-1 truncate">
                    {item.pageUrl}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {item.requesterNm ?? item.requesterId} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex justify-center gap-1 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-40 hover:bg-surface-hover transition-colors"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 text-sm border rounded transition-colors ${
                  p === page ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-surface-hover"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-40 hover:bg-surface-hover transition-colors"
          >
            ›
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedId && (
        <ImprovementDetailModal
          imprId={selectedId}
          onClose={() => setSelectedId(null)}
          onStatusChanged={() => load(page, statusFilter, keyword, fromDate, toDate)}
        />
      )}
    </div>
  );
}
