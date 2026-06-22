/**
 * @file quality/defect/components/DefectFormPanel.tsx
 * @description 불량 수동 등록 패널 — 검사불량 입력과 동일한 우측 슬라이드 패널 패턴
 *
 * 초보자 가이드:
 * 1. 제품 바코드 스캔(주 식별자) 또는 작업지시 번호로 대상 생산실적 식별
 * 2. 불량유형 선택 시 등급(defectGrade)·범위(defectScope) 자동 표시
 * 3. 수량·원인 입력 후 저장: POST /quality/defect-logs
 *    (검사를 통하지 않고 발생한 불량을 직접 등록하는 화면)
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScanLine, AlertTriangle, Plus } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import api from "@/services/api";
import toast from "react-hot-toast";

export interface DefectCodeOption {
  defectCode: string;
  defectName: string;
  defectGrade: string;
  defectScope: string;
}

interface Props {
  isOpen: boolean;
  defectCodeOptions: DefectCodeOption[];
  defectCodeLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const INITIAL_FORM = { prdUid: "", workOrderNo: "", defectCode: "", qty: "", cause: "" };

/** API 에러에서 사용자용 메시지 추출 */
function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

/** 불량등급별 텍스트 색상 (파스텔 배경 대신 텍스트/테두리로 구분) */
function gradeClass(grade: string): string {
  switch (grade?.toUpperCase()) {
    case "CRITICAL": return "text-red-600 dark:text-red-400 border-red-400 dark:border-red-700";
    case "MAJOR": return "text-orange-600 dark:text-orange-400 border-orange-400 dark:border-orange-700";
    case "MINOR": return "text-yellow-700 dark:text-yellow-500 border-yellow-400 dark:border-yellow-700";
    default: return "text-text-muted border-border";
  }
}

export default function DefectFormPanel({
  isOpen,
  defectCodeOptions,
  defectCodeLoading,
  onClose,
  onSave,
  animate = true,
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  /** 패널이 열릴 때마다 폼 초기화 */
  useEffect(() => {
    if (isOpen) setForm(INITIAL_FORM);
  }, [isOpen]);

  const defectFormOptions = useMemo(
    () =>
      defectCodeOptions.map((code) => ({
        value: code.defectCode,
        label: `${code.defectCode} - ${code.defectName} (${code.defectGrade})`,
      })),
    [defectCodeOptions],
  );

  const selected = useMemo(
    () => defectCodeOptions.find((c) => c.defectCode === form.defectCode) ?? null,
    [defectCodeOptions, form.defectCode],
  );

  const canSave =
    (form.prdUid.trim() !== "" || form.workOrderNo.trim() !== "") && form.defectCode !== "";

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await api.post("/quality/defect-logs", {
        ...(form.prdUid.trim() && { prdUid: form.prdUid.trim() }),
        ...(form.workOrderNo.trim() && { workOrderNo: form.workOrderNo.trim() }),
        defectCode: form.defectCode,
        ...(selected?.defectName && { defectName: selected.defectName }),
        qty: Number(form.qty) || 1,
        ...(form.cause.trim() && { cause: form.cause.trim() }),
      });
      toast.success(t("common.register"));
      onSave();
      onClose();
    } catch (e) {
      toast.error(errMessage(e, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${
        animate ? "animate-slide-in-right" : ""
      }`}
    >
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          {t("quality.defect.register", "불량 등록")}
        </h2>
        {isOpen && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {!isOpen ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
            <Plus className="w-16 h-16 opacity-20" />
            <p className="text-sm text-center">
              {t("quality.defect.panelPlaceholder", "불량 등록 버튼을 눌러 신규 불량을 입력하세요")}
            </p>
          </div>
        ) : (
          <>
            {/* 불량 대상 */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">
                {t("quality.defect.target", "불량 대상")}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    {t("quality.defect.productBarcode", "제품 바코드")}
                  </label>
                  <Input
                    autoFocus
                    placeholder={t("quality.defect.productBarcodePlaceholder", "제품 바코드를 스캔하세요")}
                    value={form.prdUid}
                    onChange={(e) => setForm((p) => ({ ...p, prdUid: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    leftIcon={<ScanLine className="w-4 h-4" />}
                    className="font-mono"
                    fullWidth
                  />
                </div>
                <Input
                  label={t("quality.defect.workOrderNoOptional", "작업지시 번호 (선택)")}
                  placeholder="WO-XXXX"
                  value={form.workOrderNo}
                  onChange={(e) => setForm((p) => ({ ...p, workOrderNo: e.target.value }))}
                  fullWidth
                />
              </div>
            </div>

            {/* 불량 정보 */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">
                {t("quality.defect.info", "불량 정보")}
              </h3>
              <div className="space-y-3">
                <Select
                  label={t("quality.defect.defectType", "불량유형")}
                  options={defectFormOptions}
                  value={form.defectCode}
                  onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))}
                  disabled={defectCodeLoading}
                  placeholder={t("quality.defect.defectType", "불량유형")}
                  fullWidth
                />

                {/* 선택된 불량코드의 등급·범위 */}
                {selected && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-surface p-2.5">
                      <div className="text-[11px] text-text-muted">
                        {t("quality.defect.grade", "불량등급")}
                      </div>
                      <div
                        className={`mt-1 inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold ${gradeClass(
                          selected.defectGrade,
                        )}`}
                      >
                        {selected.defectGrade || "-"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface p-2.5">
                      <div className="text-[11px] text-text-muted">
                        {t("quality.defect.scope", "불량범위")}
                      </div>
                      <div className="mt-1 text-xs font-medium text-text">
                        {selected.defectScope || "-"}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t("quality.defect.quantity", "수량")}
                    type="number"
                    min="1"
                    placeholder="1"
                    value={form.qty}
                    onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                    fullWidth
                  />
                  <Input
                    label={t("quality.defect.cause", "원인")}
                    placeholder={t("quality.defect.causePlaceholder", "불량 원인")}
                    value={form.cause}
                    onChange={(e) => setForm((p) => ({ ...p, cause: e.target.value }))}
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* 안내 */}
            <p className="text-[11px] text-text-muted bg-surface/50 border border-border/50 rounded p-2 leading-relaxed">
              {t(
                "quality.defect.registerHint",
                "제품 바코드를 스캔하면 해당 제품의 생산실적에 불량이 연결됩니다. 바코드가 없으면 작업지시 번호 기준 최신 생산실적에 연결됩니다.",
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
