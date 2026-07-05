"use client";

/**
 * @file production/order/components/JobOrderFormPanel.tsx
 * @description 작업지시 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. editingOrder=null → 신규 생성, editingOrder 있으면 수정
 * 3. 품목 선택 시 라우팅 자동 조회 → 공정순서 화살표 표시
 * 4. API: POST /production/job-orders (생성), PUT /production/job-orders/:id (수정)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { PartSearchModal, LineSelect, ProcessSelect, QtyInput } from "@/components/shared";
import { useProcessEquipmentOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

export interface JobOrderFormData {
  orderNo?: string;
  itemCode: string;
  lineCode?: string;
  processCode?: string;
  equipCode?: string;
  custPoNo?: string | null;
  planQty: number;
  planDate?: string;
  priority: number;
  remark?: string;
}

interface RoutingInfo {
  routingCode: string;
  routingName: string;
  processes: Array<{
    seq: number;
    processCode: string;
    processName: string;
    equipType?: string | null;
    jobOrderYn?: string | null;
  }>;
}

interface Props {
  editingOrder: JobOrderFormData | null;
  draftOrder?: Partial<JobOrderFormData>;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const INIT_FORM = {
  orderNo: "",
  itemCode: "",
  planQty: "",
  planDate: "",
  lineCode: "",
  processCode: "",
  equipCode: "",
  custPoNo: "",
  priority: "5",
  remark: "",
};

export default function JobOrderFormPanel({ editingOrder, draftOrder, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingOrder;
  const [saving, setSaving] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [routingInfo, setRoutingInfo] = useState<RoutingInfo | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  const [form, setForm] = useState({ ...INIT_FORM });

  const routingProcessOptions = useMemo(() => {
    if (!routingInfo) return [];
    return routingInfo.processes
      .filter((proc) => (proc.jobOrderYn ?? "Y") === "Y")
      .map((proc) => ({
        value: proc.processCode,
        label: `${proc.seq}. ${proc.processName} (${proc.processCode})`,
      }));
  }, [routingInfo]);
  const selectedRoutingProcess = useMemo(
    () => routingInfo?.processes.find((proc) => proc.processCode === form.processCode) ?? null,
    [routingInfo, form.processCode],
  );
  const { options: equipOptions, isLoading: equipLoading } = useProcessEquipmentOptions(
    form.processCode || undefined,
    selectedRoutingProcess?.equipType ?? undefined,
    !!form.processCode,
  );
  const noEquipForProcess = !!form.processCode && !equipLoading && equipOptions.length === 0;
  const jobOrderProcessCount = routingInfo
    ? routingInfo.processes.filter((proc) => (proc.jobOrderYn ?? "Y") === "Y").length
    : 0;

  /** 품목 기반 라우팅 자동 조회 */
  const fetchRouting = useCallback(async (itemCode: string) => {
    if (!itemCode) { setRoutingInfo(null); return; }
    setRoutingLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/by-item/${itemCode}`);
      setRoutingInfo(res.data?.data || null);
    } catch {
      setRoutingInfo(null);
    } finally {
      setRoutingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (editingOrder) {
      setForm({
        orderNo: editingOrder.orderNo || "",
        itemCode: editingOrder.itemCode || "",
        planQty: String(editingOrder.planQty ?? ""),
        planDate: editingOrder.planDate ? String(editingOrder.planDate).slice(0, 10) : "",
        lineCode: editingOrder.lineCode || "",
        processCode: editingOrder.processCode || "",
        equipCode: editingOrder.equipCode || "",
        custPoNo: editingOrder.custPoNo || "",
        priority: String(editingOrder.priority ?? "5"),
        remark: editingOrder.remark || "",
      });
      fetchRouting(editingOrder.itemCode);
    } else {
      setForm({
        ...INIT_FORM,
        orderNo: draftOrder?.orderNo || "",
        itemCode: draftOrder?.itemCode || "",
        planQty: draftOrder?.planQty != null ? String(draftOrder.planQty) : "",
        planDate: draftOrder?.planDate ? String(draftOrder.planDate).slice(0, 10) : "",
        lineCode: draftOrder?.lineCode || "",
        processCode: draftOrder?.processCode || "",
        equipCode: draftOrder?.equipCode || "",
        custPoNo: draftOrder?.custPoNo || "",
        priority: String(draftOrder?.priority ?? "5"),
        remark: draftOrder?.remark || "",
      });
      if (draftOrder?.itemCode) {
        fetchRouting(draftOrder.itemCode);
      } else {
        setRoutingInfo(null);
      }
    }
  }, [editingOrder, draftOrder, fetchRouting]);

  const setField = (key: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === "processCode") next.equipCode = "";
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || !form.planQty || !form.planDate) return;
    setSaving(true);
    try {
      const payload = {
        ...(form.orderNo.trim() ? { orderNo: form.orderNo.trim() } : {}),
        itemCode: form.itemCode,
        planQty: Number(form.planQty),
        planDate: form.planDate,
        lineCode: form.lineCode || undefined,
        processCode: form.processCode || undefined,
        equipCode: form.equipCode || undefined,
        custPoNo: form.custPoNo || undefined,
        priority: Number(form.priority),
        remark: form.remark || undefined,
      };
      if (isEdit && editingOrder?.orderNo) {
        await api.put(`/production/job-orders/${editingOrder.orderNo}`, payload);
      } else {
        await api.post("/production/job-orders", payload);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editingOrder, onSave, onClose]);

  return (
    <>
      <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-text">
            {isEdit ? t("production.order.editTitle") : t("production.order.createTitle")}
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || !form.itemCode || !form.planQty || !form.planDate}>
              {saving ? t("common.saving") : t("common.save", "저장")}
            </Button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* 기본정보 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("production.order.sectionBasic")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("production.order.orderNo")} value={form.orderNo}
                onChange={e => setField("orderNo", e.target.value)} disabled
                placeholder={!isEdit ? t("production.order.orderNoAuto", "저장 시 자동 생성") : undefined} fullWidth />
              <div>
                <label className="block text-xs font-medium text-text mb-1">{t("common.partName")}</label>
                <div className="flex gap-1">
                  <Input value={form.itemCode} readOnly
                    placeholder={t("common.partSearchPlaceholder")} fullWidth />
                  <button type="button" onClick={() => setPartSearchOpen(true)}
                    className="flex-shrink-0 h-[30px] w-[30px] flex items-center justify-center rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-surface hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                    title={t("common.partSearch")}>
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <QtyInput label={t("production.order.planQty")} value={Number(form.planQty) || 0}
                onChange={n => setField("planQty", n ? String(n) : "")} fullWidth />
              <Input label={`${t("production.order.planDate")} *`} type="date" value={form.planDate}
                onChange={e => setField("planDate", e.target.value)} fullWidth />
              <Input label={t("production.order.priority")} type="number" value={form.priority}
                onChange={e => setField("priority", e.target.value)} fullWidth />
              <Input label={t("production.order.custPoNo")} value={form.custPoNo}
                onChange={e => setField("custPoNo", e.target.value)}
                placeholder="PO-2026-0001" fullWidth />
            </div>
          </div>

          {/* 라우팅 정보 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">
              {t("production.order.sectionRouting")}
            </h3>
            {routingLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-muted p-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("common.loading")}
              </div>
            ) : routingInfo ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-text">{routingInfo.routingCode}</span>
                  <span className="text-text-muted">-</span>
                  <span className="text-text-muted">{routingInfo.routingName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 p-2 bg-surface rounded-lg border border-border">
                  {routingInfo.processes.map((proc, i) => (
                    <span key={proc.seq} className="flex items-center gap-1">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
                        {proc.processName}
                      </span>
                      {i < routingInfo.processes.length - 1 && (
                        <span className="text-text-muted">→</span>
                      )}
                    </span>
                  ))}
                </div>
                {!isEdit && routingInfo && (
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-text">저장 시 생성 구조</span>
                      <span className="text-[11px] text-text-muted">{routingInfo.routingCode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-sky-700 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                        <div className="text-[11px] font-semibold">품목지시</div>
                        <div className="text-sm font-bold">1건</div>
                      </div>
                      <div className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <div className="text-[11px] font-semibold">공정지시</div>
                        <div className="text-sm font-bold">{jobOrderProcessCount.toLocaleString()}건</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : form.itemCode ? (
              <p className="text-xs text-amber-500 dark:text-amber-400 p-2">
                {t("production.order.noRouting")}
              </p>
            ) : null}
          </div>

          {/* 라인 / 공정 / 설비 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <LineSelect label={t("production.order.line")} value={form.lineCode}
                onChange={v => setField("lineCode", v)} fullWidth />
              {routingInfo ? (
                <Select
                  label={t("production.order.process")}
                  value={form.processCode}
                  onChange={v => setField("processCode", v)}
                  options={routingProcessOptions}
                  placeholder={t("production.order.selectRoutingProcess", "라우팅 공정 선택")}
                  disabled={routingProcessOptions.length === 0}
                  fullWidth
                />
              ) : (
                <ProcessSelect label={t("production.order.process")} value={form.processCode}
                  onChange={v => setField("processCode", v)} fullWidth />
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-text">{t("production.order.equip")}</span>
                {equipLoading && (
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("common.loading")}
                  </span>
                )}
              </div>
              <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-border bg-surface p-1.5">
                <button
                  type="button"
                  onClick={() => setField("equipCode", "")}
                  className={`min-h-8 rounded border px-2 py-1 text-left text-xs transition-colors ${
                    !form.equipCode
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-background text-text-muted hover:border-primary/60 hover:bg-primary/5"
                  }`}
                >
                  {t("common.notSelected", "미지정")}
                </button>
                {equipOptions.map((option) => {
                  const selected = form.equipCode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setField("equipCode", option.value)}
                      title={option.label}
                      className={`min-h-8 rounded border px-2 py-1 text-left text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-background text-text hover:border-primary/60 hover:bg-primary/5"
                      }`}
                    >
                      <span className="block truncate">{option.label}</span>
                    </button>
                  );
                })}
                {!equipLoading && equipOptions.length === 0 && (
                  <div className="col-span-2 rounded border border-dashed border-border px-2 py-2 text-xs text-text-muted">
                    {form.processCode
                      ? t("production.order.noEquipForProcess")
                      : t("production.order.selectProcessFirstForEquip", "공정을 먼저 선택하면 해당 공정 설비만 표시됩니다.")}
                  </div>
                )}
              </div>
              {noEquipForProcess && (
                <p className="mt-1 text-xs text-amber-500 dark:text-amber-400">
                  {t("production.order.noEquipForProcess")}
                </p>
              )}
            </div>
          </div>

          {/* 비고 */}
          <div>
            <Input label={t("common.remark")} value={form.remark}
              onChange={e => setField("remark", e.target.value)} fullWidth />
          </div>

        </div>

      </div>

      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        allowedItemTypes={["FINISHED", "SEMI_PRODUCT"]}
        onSelect={(part) => {
          setForm(p => ({ ...p, itemCode: part.itemCode, processCode: "", equipCode: "" }));
          fetchRouting(part.itemCode);
        }}
      />
    </>
  );
}
