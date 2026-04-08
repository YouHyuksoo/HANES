/**
 * @file src/components/shared/OrderSearchModal.tsx
 * @description 작업지시 검색 모달 — 검색 + DataGrid 기반
 *
 * 초보자 가이드:
 * 1. 작업지시번호를 검색하고 선택할 수 있는 공통 모달
 * 2. onSelect: 행 클릭 시 선택된 작업지시 정보를 부모에 전달
 * 3. 검색어 입력 → Enter 또는 검색 버튼 → API 호출 → DataGrid 표시
 *
 * 사용 예:
 * <OrderSearchModal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   onSelect={(order) => setOrderNo(order.orderNo)}
 * />
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

/** 작업지시 데이터 타입 */
export interface OrderItem {
  orderNo: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  status: string;
}

interface OrderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (order: OrderItem) => void;
}

export default function OrderSearchModal({
  isOpen,
  onClose,
  onSelect,
}: OrderSearchModalProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  /** 모달 열릴 때 초기화 및 자동 조회 */
  useEffect(() => {
    if (!isOpen) return;
    setKeyword("");
    fetchOrders("");
  }, [isOpen]);

  /** API 호출 */
  const fetchOrders = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/production/job-orders", { params });
      const raw = res.data?.data;
      setData(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 검색 실행 */
  const handleSearch = useCallback(() => {
    fetchOrders(keyword);
  }, [fetchOrders, keyword]);

  /** Enter 키 검색 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  /** 행 클릭 → 선택 후 닫기 */
  const handleRowClick = useCallback(
    (row: OrderItem) => {
      onSelect(row);
      onClose();
    },
    [onSelect, onClose]
  );

  /** DataGrid 컬럼 정의 */
  const columns = useMemo<ColumnDef<OrderItem, unknown>[]>(
    () => [
      { accessorKey: "orderNo", header: t("production.jobOrder.orderNo", "작업지시번호"), size: 180 },
      { accessorKey: "itemCode", header: t("common.partCode"), size: 140 },
      { accessorKey: "itemName", header: t("common.partName"), size: 200 },
      { accessorKey: "orderQty", header: t("production.jobOrder.orderQty", "지시수량"), size: 100 },
      { accessorKey: "status", header: t("common.status"), size: 100 },
    ],
    [t]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={t("quality.fai.orderSearch", "작업지시 검색")} size="xl">
      {/* 검색 바 */}
      <div className="flex items-end gap-2 mb-3">
        <Input
          placeholder={t("quality.fai.orderSearchPlaceholder", "작업지시번호 또는 품목 검색...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        <Button onClick={handleSearch} className="flex-shrink-0">
          {t("common.search")}
        </Button>
      </div>

      {/* 작업지시 목록 */}
      <DataGrid
        data={data}
        columns={columns}
        isLoading={loading}
        onRowClick={handleRowClick}
        pageSize={10}
        enableColumnFilter={false}
        enableColumnReordering={false}
        maxHeight="400px"
      />
    </Modal>
  );
}
