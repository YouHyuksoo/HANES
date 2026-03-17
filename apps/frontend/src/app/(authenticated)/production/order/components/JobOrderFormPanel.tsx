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

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PartSearchModal, LineSelect } from "@/components/shared";
import api from "@/services/api";

export interface JobOrderFormData {
  orderNo: string;
  itemCode: string;
  lineCode?: string;
  custPoNo?: string | null;
  planQty: number;
  planDate?: string;
  priority: number;
  remark?: string;
}

interface RoutingInfo {
  routingCode: string;
  routingName: string;
  processes: Array<{ seq: number; processCode: string; processName: string }>;
}

interface Props {
  editingOrder: JobOrderFormData | null;
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
  custPoNo: "",
  priority: "5",
  remark: "",
  autoCreateChildren: false,
};

export default function JobOrderFormPanel({ editingOrder, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingOrder;
  const [saving, setSaving] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [routingInfo, setRoutingInfo] = useState<RoutingInfo | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  const generateOrderNo = useCallback(() => {
    const d = new Date();
    const prefix = `JO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `${prefix}-${seq}`;
  }, []);

  const [form, setForm] = useState({ ...INIT_FORM });

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
        custPoNo: editingOrder.custPoNo || "",
        priority: String(editingOrder.priority ?? "5"),
        remark: editingOrder.remark || "",
        autoCreateChildren: false,
      });
      fetchRouting(editingOrder.itemCode);
    } else {
      setForm({ ...INIT_FORM, orderNo: generateOrderNo() });
      setRoutingInfo(null);
    }
  }, [editingOrder, generateOrderNo, fetchRouting]);

  const setField = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || !form.planQty) return;
    setSaving(true);
    try {
      const payload = {
        orderNo: form.orderNo,
        itemCode: form.itemCode,
        planQty: Number(form.planQty),
        planDate: form.planDate || undefined,
        lineCode: form.lineCode || undefined,
        custPoNo: form.custPoNo || undefined,
        priority: Number(form.priority),
        remark: form.remark || undefined,
        autoCreateChildren: form.autoCreateChildren,
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
            <Button size="sm" onClick={handleSubmit} disabled={saving || !form.itemCode || !form.planQty}>
              {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
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
                onChange={e => setField("orderNo", e.target.value)} disabled={isEdit} fullWidth />
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
              <Input label={t("production.order.planQty")} type="number" value={form.planQty}
                onChange={e => setField("planQty", e.target.value)} fullWidth />
              <Input label={t("production.order.planDate")} type="date" value={form.planDate}
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
              </div>
            ) : form.itemCode ? (
              <p className="text-xs text-amber-500 dark:text-amber-400 p-2">
                {t("production.order.noRouting")}
              </p>
            ) : null}
          </div>

          {/* 라인 */}
          <div>
            <LineSelect label={t("production.order.line")} value={form.lineCode}
              onChange={v => setField("lineCode", v)} fullWidth />
          </div>

          {/* 비고 */}
          <div>
            <Input label={t("common.remark")} value={form.remark}
              onChange={e => setField("remark", e.target.value)} fullWidth />
          </div>

          {/* BOM 자동생성 (신규 시만) */}
          {!isEdit && (
            <label className="flex items-center gap-2 text-xs text-text cursor-pointer p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <input type="checkbox" checked={form.autoCreateChildren}
                onChange={e => setField("autoCreateChildren", e.target.checked)}
                className="w-4 h-4 rounded accent-primary" />
              {t("production.order.autoCreateChildren")}
            </label>
          )}
        </div>

      </div>

      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={(part) => {
          setForm(p => ({ ...p, itemCode: part.itemCode }));
          fetchRouting(part.itemCode);
        }}
      />
    </>
  );
}
