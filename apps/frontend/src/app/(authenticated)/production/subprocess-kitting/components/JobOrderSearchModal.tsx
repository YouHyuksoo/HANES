"use client";

/**
 * @file components/JobOrderSearchModal.tsx
 * @description 작업지시 검색·선택 모달 — itemType 필터를 지원한다 (SEMI_PRODUCT / FINISHED 등).
 *   선택 시 품목·계획수량·상태를 부모로 전달해 자동 표시한다.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Modal, Input, ComCodeBadge } from "@/components/ui";
import api from "@/services/api";

export interface JobOrderPick {
  orderNo: string;
  itemCode: string;
  itemName?: string;
  planQty: number;
  goodQty?: number;
  status: string;
  processCode?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (order: JobOrderPick) => void;
  itemType?: string;
}

export default function JobOrderSearchModal({ isOpen, onClose, onSelect, itemType }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<JobOrderPick[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/job-orders", {
        params: {
          limit: 100,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(itemType ? { itemType } : {}),
        },
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(list as JobOrderPick[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, itemType]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("production.kitting.selectOrder", "작업지시 선택")} size="xl">
      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchOrders(); } }}
            placeholder={t("production.kitting.orderSearchPlaceholder", "작업지시번호·품목 검색")}
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
            fullWidth
          />
        </div>
        <div className="border border-border rounded overflow-auto max-h-[55vh]">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border sticky top-0">
              <tr className="text-text-muted text-xs">
                <th className="px-3 py-2 text-left font-semibold">{t("production.kitting.orderNo", "작업지시번호")}</th>
                <th className="px-3 py-2 text-left font-semibold">{t("common.partCode", "품목코드")}</th>
                <th className="px-3 py-2 text-left font-semibold">{t("common.partName", "품목명")}</th>
                <th className="px-3 py-2 text-right font-semibold">{t("production.kitting.planQty", "계획수량")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("common.status", "상태")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-text-muted">{t("common.loading", "불러오는 중...")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-text-muted">{t("common.noData", "데이터가 없습니다")}</td></tr>
              ) : rows.map((row) => (
                <tr
                  key={row.orderNo}
                  className="border-b border-border/70 hover:bg-primary/10 cursor-pointer"
                  onClick={() => { onSelect(row); onClose(); }}
                >
                  <td className="px-3 py-2 font-mono text-xs">{row.orderNo}</td>
                  <td className="px-3 py-2 text-xs">{row.itemCode}</td>
                  <td className="px-3 py-2 text-xs">{row.itemName || "-"}</td>
                  <td className="px-3 py-2 text-right text-xs">{(row.planQty ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">
                    <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
