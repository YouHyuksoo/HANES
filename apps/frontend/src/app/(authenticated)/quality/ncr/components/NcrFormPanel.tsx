"use client";

/**
 * @file quality/ncr/components/NcrFormPanel.tsx
 * @description 부적합 보고서 발행·편집 패널 (우측 슬라이드, 액션 버튼 상단 — 프로젝트 표준)
 *
 * 초보자 가이드:
 * 1. 대상구분과 발견단계는 별개 축이다. 원자재 불량을 조립공정에서 발견하는 경우가 있어
 *    둘을 따로 고른다.
 * 2. 처리방안 선택지는 대상구분에 따라 순서만 바뀐다(원자재면 반품이 맨 앞).
 *    강제로 막지는 않는다 — 원자재인데 특채 같은 예외가 실제로 있다.
 * 3. 종결된 보고서는 서버가 수정을 거부한다(품질기록). 화면도 편집을 막는다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Input } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import api from "@/services/api";
import { DISPOSITION_PRIORITY, type NcrReport, type NcrTargetType } from "../types";

interface Props {
  editData: NcrReport | null;
  onClose: () => void;
  onSave: () => void;
}

interface FormState {
  targetType: string;
  foundStage: string;
  itemCode: string;
  lotNo: string;
  serialNo: string;
  orderNo: string;
  poNo: string;
  vendorCode: string;
  inspectQty: string;
  defectQty: string;
  defectCode: string;
  defectGrade: string;
  description: string;
  dueDate: string;
  issueDept: string;
  remark: string;
}

const EMPTY: FormState = {
  targetType: "RAW_MATERIAL", foundStage: "IQC", itemCode: "", lotNo: "", serialNo: "",
  orderNo: "", poNo: "", vendorCode: "", inspectQty: "", defectQty: "",
  defectCode: "", defectGrade: "", description: "", dueDate: "", issueDept: "", remark: "",
};

export default function NcrFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(editData);
  const isClosed = editData?.status === "CLOSED";

  useEffect(() => {
    if (!editData) { setForm(EMPTY); return; }
    setForm({
      targetType: editData.targetType,
      foundStage: editData.foundStage,
      itemCode: editData.itemCode ?? "",
      lotNo: editData.lotNo ?? "",
      serialNo: editData.serialNo ?? "",
      orderNo: editData.orderNo ?? "",
      poNo: editData.poNo ?? "",
      vendorCode: editData.vendorCode ?? "",
      inspectQty: editData.inspectQty?.toString() ?? "",
      defectQty: editData.defectQty?.toString() ?? "",
      defectCode: editData.defectCode ?? "",
      defectGrade: editData.defectGrade ?? "",
      description: editData.description ?? "",
      dueDate: editData.dueDate?.slice(0, 10) ?? "",
      issueDept: editData.issueDept ?? "",
      remark: editData.remark ?? "",
    });
  }, [editData]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** 대상구분에 맞는 불량코드 그룹 — 완제품·반제품은 통전, 그 외는 외관 계열을 먼저 쓴다 */
  const defectCodeGroup = useMemo(
    () => (form.foundStage === "IQC" ? "VISUAL_DEFECT" : "CONTINUITY_DEFECT"),
    [form.foundStage],
  );

  const canSave = form.itemCode.trim() && form.targetType && form.foundStage;

  const handleSave = useCallback(async () => {
    if (!canSave || isClosed) return;
    setSaving(true);
    try {
      const payload = {
        targetType: form.targetType,
        foundStage: form.foundStage,
        itemCode: form.itemCode.trim(),
        ...(form.lotNo.trim() ? { lotNo: form.lotNo.trim() } : {}),
        ...(form.serialNo.trim() ? { serialNo: form.serialNo.trim() } : {}),
        ...(form.orderNo.trim() ? { orderNo: form.orderNo.trim() } : {}),
        ...(form.poNo.trim() ? { poNo: form.poNo.trim() } : {}),
        ...(form.vendorCode.trim() ? { vendorCode: form.vendorCode.trim() } : {}),
        ...(form.inspectQty ? { inspectQty: Number(form.inspectQty) } : {}),
        ...(form.defectQty ? { defectQty: Number(form.defectQty) } : {}),
        ...(form.defectCode ? { defectCode: form.defectCode } : {}),
        ...(form.defectGrade ? { defectGrade: form.defectGrade } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        ...(form.issueDept.trim() ? { issueDept: form.issueDept.trim() } : {}),
        ...(form.remark.trim() ? { remark: form.remark.trim() } : {}),
      };

      if (isEdit && editData) {
        await api.put(`/quality/ncr/${encodeURIComponent(editData.ncrNo)}`, payload);
      } else {
        await api.post("/quality/ncr", payload);
      }
      onSave();
      onClose();
    } catch {
      // 오류 토스트는 인터셉터가 띄운다
    } finally {
      setSaving(false);
    }
  }, [canSave, isClosed, form, isEdit, editData, onSave, onClose]);

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 — 액션 버튼은 상단(프로젝트 표준) */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit
            ? `${t("quality.ncr.edit", "부적합 보고서 수정")} · ${editData?.ncrNo}`
            : t("quality.ncr.issue", "부적합 보고서 발행")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel", "취소")}</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !canSave || isClosed}
            data-testid="ncr-save"
          >
            {t("common.save", "저장")}
          </Button>
        </div>
      </div>

      {isClosed && (
        <p className="px-5 py-2 text-[11px] text-text-muted border-b border-border">
          {t("quality.ncr.closedReadonly", "종결된 보고서는 수정할 수 없습니다. 필요하면 새로 발행하세요.")}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 구분 — 두 축을 나란히 */}
        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect
            groupCode="NCR_TARGET_TYPE"
            includeAll={false}
            label={t("quality.ncr.targetType", "대상구분")}
            value={form.targetType}
            onChange={(v) => set("targetType", v)}
            fullWidth
          />
          <ComCodeSelect
            groupCode="NCR_FOUND_STAGE"
            includeAll={false}
            label={t("quality.ncr.foundStage", "발견단계")}
            value={form.foundStage}
            onChange={(v) => set("foundStage", v)}
            fullWidth
          />
        </div>

        {/* 대상 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("common.partCode", "품번")} value={form.itemCode}
            onChange={(e) => set("itemCode", e.target.value)} fullWidth required />
          <Input label={t("quality.ncr.lotNo", "로트번호")} value={form.lotNo}
            onChange={(e) => set("lotNo", e.target.value)} fullWidth />
          <Input label={t("quality.ncr.serialNo", "시리얼")} value={form.serialNo}
            onChange={(e) => set("serialNo", e.target.value)} fullWidth />
          <Input label={t("production.result.orderNo", "작업지시")} value={form.orderNo}
            onChange={(e) => set("orderNo", e.target.value)} fullWidth />
          <Input label={t("quality.ncr.poNo", "P/O No")} value={form.poNo}
            onChange={(e) => set("poNo", e.target.value)} fullWidth />
          <Input label={t("quality.ncr.vendorCode", "공급업체")} value={form.vendorCode}
            onChange={(e) => set("vendorCode", e.target.value)} fullWidth />
        </div>

        {/* 수량 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.ncr.inspectQty", "검사수량")} value={form.inspectQty}
            onChange={(e) => set("inspectQty", e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="numeric" fullWidth />
          <Input label={t("quality.ncr.defectQty", "불량수량")} value={form.defectQty}
            onChange={(e) => set("defectQty", e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="numeric" fullWidth />
        </div>

        {/* 부적합 내용 */}
        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect
            groupCode={defectCodeGroup}
            includeAll={false}
            label={t("quality.ncr.defectCode", "부적합명")}
            value={form.defectCode}
            onChange={(v) => set("defectCode", v)}
            fullWidth
          />
          <ComCodeSelect
            groupCode="DEFECT_GRADE"
            includeAll={false}
            label={t("quality.ncr.defectGrade", "결함구분")}
            value={form.defectGrade}
            onChange={(v) => set("defectGrade", v)}
            fullWidth
          />
        </div>

        <div>
          <label className="block mb-1 font-medium text-text">
            {t("quality.ncr.description", "부적합 현상")}
          </label>
          <textarea
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
            rows={4}
            placeholder={t("quality.ncr.descriptionPlaceholder",
              "예: CN1 커넥터 3번 핀 압착 부위 피복 물림, 인장 시 단선 (2EA)")}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        {/* 발행 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t("quality.ncr.dueDate", "회신요구일")} value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)} fullWidth />
          <Input label={t("quality.ncr.issueDept", "발행부서")} value={form.issueDept}
            onChange={(e) => set("issueDept", e.target.value)} fullWidth />
        </div>

        <div>
          <label className="block mb-1 font-medium text-text">{t("common.remark", "비고")}</label>
          <textarea
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
            rows={2}
            value={form.remark}
            onChange={(e) => set("remark", e.target.value)}
          />
        </div>

        {/* 처리방안 힌트 — 대상구분에 맞는 순서를 보여준다(강제 아님) */}
        <p className="text-[11px] text-text-muted leading-relaxed">
          {t("quality.ncr.dispositionHint", "처리방안은 발행 후 목록에서 지정합니다.")}
          {" "}
          {t("quality.ncr.dispositionSuggest", "권장 순서")}:{" "}
          {DISPOSITION_PRIORITY[(form.targetType as NcrTargetType)]?.slice(0, 3)
            .map((d) => t(`comCode.NCR_DISPOSITION.${d}`, d)).join(" → ")}
        </p>
      </div>
    </div>
  );
}
