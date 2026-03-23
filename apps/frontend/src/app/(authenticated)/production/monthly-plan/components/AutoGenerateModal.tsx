/**
 * @file production/monthly-plan/components/AutoGenerateModal.tsx
 * @description 자동 생산계획 편성(MPS) 모달 - 수주/CAPA 기반 자동 계획 생성
 *
 * 초보자 가이드:
 * 1. **필터**: 대상월, 납기 기간(시작~종료), 고객 선택
 * 2. **미리보기**: 수주별 납기일/수량/CAPA 확인 후 체크박스로 선택
 * 3. **편성 실행**: 선택된 수주만 생산계획 DRAFT로 생성
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select, ConfirmModal } from "@/components/ui";
import api from "@/services/api";
import AutoPlanPreview, { type AutoPlanPreviewData } from "./AutoPlanPreview";

interface AutoGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CustomerOption {
  value: string;
  label: string;
}

export default function AutoGenerateModal({
  isOpen,
  onClose,
  onSuccess,
}: AutoGenerateModalProps) {
  const { t } = useTranslation();

  /* 다음달 기본값 */
  const defaultMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [month, setMonth] = useState(defaultMonth);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [preview, setPreview] = useState<AutoPlanPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

  const handleToggle = useCallback((index: number) => {
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (!preview) return;
    setSelectedIndexes(prev =>
      prev.size === preview.items.length
        ? new Set()
        : new Set(preview.items.map((_, i) => i)),
    );
  }, [preview]);

  const selectedCount = useMemo(() => selectedIndexes.size, [selectedIndexes]);

  /* 월 변경 시 날짜 범위 자동 세팅 */
  useEffect(() => {
    if (!month) return;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    setStartDate(`${month}-01`);
    setEndDate(`${month}-${String(lastDay).padStart(2, "0")}`);
  }, [month]);

  /* 모달 열릴 때 초기화 + 고객 목록 로드 */
  useEffect(() => {
    if (!isOpen) return;
    setPreview(null);
    setMonth(defaultMonth);
    setCustomerId("");
    api.get("/shipping/customer-orders", { params: { limit: 1000 } })
      .then(res => {
        const orders = res.data?.data ?? [];
        const unique = new Map<string, string>();
        for (const o of orders) {
          if (o.customerId && !unique.has(o.customerId)) {
            unique.set(o.customerId, o.customerName || o.customerId);
          }
        }
        setCustomerOptions([
          { value: "", label: t("common.all") },
          ...Array.from(unique, ([v, l]) => ({ value: v, label: l })),
        ]);
      })
      .catch(() => setCustomerOptions([{ value: "", label: t("common.all") }]));
  }, [isOpen, defaultMonth, t]);

  /** 미리보기 */
  const handlePreview = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { month };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (customerId) body.customerId = customerId;
      const res = await api.post("/production/prod-plans/auto-generate/preview", body);
      const data = res.data?.data ?? null;
      setPreview(data);
      if (data) setSelectedIndexes(new Set(data.items.map((_: unknown, i: number) => i)));
    } catch { /* api interceptor */ }
    finally { setLoading(false); }
  }, [month, startDate, endDate, customerId]);

  /** 편성 실행 */
  const handleGenerate = useCallback(async () => {
    setShowConfirm(false);
    setGenerating(true);
    try {
      const selectedItems = preview?.items
        .filter((_, i) => selectedIndexes.has(i))
        .map(item => ({ itemCode: item.itemCode, customerId: item.customerId, planQty: item.planQty }));
      await api.post("/production/prod-plans/auto-generate", { month, selectedItems });
      onSuccess();
    } catch { /* api interceptor */ }
    finally { setGenerating(false); }
  }, [month, preview, selectedIndexes, onSuccess]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t("monthlyPlan.autoGenerate.title")}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={generating}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowConfirm(true)}
              disabled={!preview || selectedCount === 0}
              isLoading={generating}
            >
              {t("monthlyPlan.autoGenerate.execute")} ({selectedCount})
            </Button>
          </>
        }
      >
        {/* 필터 영역 */}
        <div className="flex gap-3 mb-4 items-end flex-wrap">
          <div className="w-40">
            <label className="block text-sm font-medium text-text mb-1">
              {t("monthlyPlan.autoGenerate.month")}
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-600"
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-text mb-1">
              {t("monthlyPlan.autoGenerate.dueDateStart")}
            </label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-text mb-1">
              {t("monthlyPlan.autoGenerate.dueDateEnd")}
            </label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
          </div>
          <div className="w-44">
            <label className="block text-sm font-medium text-text mb-1">
              {t("monthlyPlan.customer")}
            </label>
            <Select options={customerOptions} value={customerId} onChange={setCustomerId} fullWidth />
          </div>
          <Button variant="secondary" onClick={handlePreview} isLoading={loading}>
            {t("monthlyPlan.autoGenerate.preview")}
          </Button>
        </div>

        {/* 미리보기 결과 */}
        {preview && (
          <AutoPlanPreview
            preview={preview}
            selectedIndexes={selectedIndexes}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
          />
        )}

        {!preview && !loading && (
          <div className="text-center text-text-muted py-12">
            {t("monthlyPlan.autoGenerate.emptyGuide")}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleGenerate}
        variant="danger"
        message={t("monthlyPlan.autoGenerate.confirmDelete", {
          count: preview?.existingDraftCount || 0,
        })}
      />
    </>
  );
}
