/**
 * @file production/monthly-plan/components/IssueJobOrderModal.tsx
 * @description 월간생산계획에서 작업지시를 발행하는 모달
 *
 * 초보자 가이드:
 * 1. **계획 요약**: 선택된 생산계획의 주요 정보를 읽기전용으로 표시
 * 2. **발행수량**: 잔여수량 이내에서 지시 발행 수량 입력
 * 3. **라인/우선순위**: 계획의 기본값을 상속받되 변경 가능
 * 4. **BOM 반제품 자동생성**: 체크 시 하위 BOM 항목도 함께 생성
 * 5. **API**: POST /production/prod-plans/:planNo/issue-job-order
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui";
import api from "@/services/api";
import { ProdPlanItem } from "./types";

interface IssueJobOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: ProdPlanItem | null;
}

/** 라인 옵션 타입 */
interface LineOption {
  value: string;
  label: string;
}

export default function IssueJobOrderModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: IssueJobOrderModalProps) {
  const { t } = useTranslation();

  const remainQty = useMemo(
    () => (plan ? plan.planQty - plan.orderQty : 0),
    [plan],
  );

  const [issueQty, setIssueQty] = useState(0);
  const [planDate, setPlanDate] = useState("");
  const [lineCode, setLineCode] = useState("");
  const [priority, setPriority] = useState(5);
  const [autoChildren, setAutoChildren] = useState(false);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lineOptions, setLineOptions] = useState<LineOption[]>([]);

  /* 라인 옵션 로드 */
  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/master/prod-lines")
      .then((res) => {
        const items = res.data?.data ?? [];
        setLineOptions(
          items.map((l: { lineCode: string; lineName: string }) => ({
            value: l.lineCode,
            label: l.lineName,
          })),
        );
      })
      .catch(() => setLineOptions([]));
  }, [isOpen]);

  /* plan 변경 시 초기값 세팅 */
  useEffect(() => {
    if (!plan) return;
    const remain = plan.planQty - plan.orderQty;
    setIssueQty(remain > 0 ? remain : 0);
    setPlanDate("");
    setLineCode(plan.lineCode ?? "");
    setPriority(plan.priority ?? 5);
    setAutoChildren(false);
    setRemark("");
  }, [plan]);

  const handleSubmit = useCallback(async () => {
    if (!plan || issueQty <= 0) return;
    setSubmitting(true);
    try {
      await api.post(
        `/production/prod-plans/${plan.planNo}/issue-job-order`,
        {
          issueQty,
          planDate: planDate || undefined,
          lineCode: lineCode || undefined,
          priority,
          autoCreateChildren: autoChildren,
          remark: remark || undefined,
        },
      );
      onSuccess();
    } catch {
      /* api interceptor handles toast */
    } finally {
      setSubmitting(false);
    }
  }, [plan, issueQty, planDate, lineCode, priority, autoChildren, remark, onSuccess]);

  const lineSelectOptions = useMemo(
    () => [{ value: "", label: t("common.select") }, ...lineOptions],
    [t, lineOptions],
  );

  if (!plan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("monthlyPlan.issueJobOrder")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            disabled={issueQty <= 0 || issueQty > remainQty}
          >
            <Send className="w-4 h-4 mr-1" />
            {t("monthlyPlan.issueJobOrder")}
          </Button>
        </>
      }
    >
      {/* 계획 요약 정보 */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-muted mb-2">
          {t("monthlyPlan.planInfo")}
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 bg-background dark:bg-slate-800 rounded-md text-sm">
          <div>
            <span className="text-text-muted">{t("monthlyPlan.planNo")}:</span>{" "}
            <span className="font-mono font-medium text-text">{plan.planNo}</span>
          </div>
          <div>
            <span className="text-text-muted">{t("common.partName")}:</span>{" "}
            <span className="font-medium text-text">
              {plan.part?.itemName ?? "-"}{" "}
              <span className="text-text-muted text-xs">({plan.itemCode})</span>
            </span>
          </div>
          <div>
            <span className="text-text-muted">{t("monthlyPlan.planQty")}:</span>{" "}
            <span className="font-medium text-text">{plan.planQty.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-text-muted">{t("monthlyPlan.issuedQty")}:</span>{" "}
            <span className="font-medium text-text">{plan.orderQty.toLocaleString()}</span>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted">{t("monthlyPlan.remainQty")}:</span>{" "}
            <span
              className={`font-bold ${
                remainQty > 0
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {remainQty.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("monthlyPlan.issueQty")} <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            value={issueQty}
            onChange={(e) => setIssueQty(Number(e.target.value))}
            min={1}
            max={remainQty}
            fullWidth
          />
          {issueQty > remainQty && (
            <p className="text-xs text-red-500 mt-1">{t("monthlyPlan.noRemainQty")}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("monthlyPlan.planMonth")}
          </label>
          <Input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            fullWidth
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("monthlyPlan.lineCode")}
          </label>
          <Select
            options={lineSelectOptions}
            value={lineCode}
            onChange={setLineCode}
            fullWidth
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("monthlyPlan.priority")}
          </label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            min={1}
            max={10}
            fullWidth
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="autoChildren"
            checked={autoChildren}
            onChange={(e) => setAutoChildren(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="autoChildren" className="text-sm text-text cursor-pointer">
            {t("monthlyPlan.autoCreateChildren")}
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-text mb-1">
            {t("common.remark")}
          </label>
          <Input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            fullWidth
          />
        </div>
      </div>
    </Modal>
  );
}
