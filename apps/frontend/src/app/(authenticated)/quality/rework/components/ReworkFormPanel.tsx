"use client";

/**
 * @file quality/rework/components/ReworkFormPanel.tsx
 * @description 재작업 지시 등록/수정 우측 슬라이드 패널 — 품목검색 + 라우팅 공정 연동
 *
 * 초보자 가이드:
 * 1. **PartSearchModal**: 품목검색 모달로 품목 선택
 * 2. **라우팅 자동 조회**: 품목 선택 시 PROCESS_MAPS 라우팅 자동 fetch
 * 3. **공정 선택**: 체크박스로 재작업할 공정을 선택/해제
 * 4. editData=null → 신규 등록, editData 있으면 수정
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search, Layers, AlertCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { LineSelect, EquipSelect, WorkerSelect, ComCodeSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import api from "@/services/api";

interface ProcessItem {
  processCode: string;
  processName: string;
  seq: number;
  processType: string | null;
  equipType: string | null;
}

interface ReworkFormData {
  itemCode: string;
  itemName: string;
  reworkQty: string;
  defectType: string;
  reworkMethod: string;
  lineCode: string;
  equipCode: string;
  workerId: string;
  remark: string;
}

const INIT: ReworkFormData = {
  itemCode: "", itemName: "", reworkQty: "", defectType: "",
  reworkMethod: "", lineCode: "", equipCode: "", workerId: "", remark: "",
};

export interface ReworkEditData {
  reworkNo: string;
  itemCode: string;
  itemName: string;
  reworkQty: number;
  defectType: string;
  reworkMethod: string;
  lineCode: string;
  equipCode: string;
  workerId: string;
  remark: string;
}

interface Props {
  editData: ReworkEditData | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function ReworkFormPanel({ editData, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<ReworkFormData>(INIT);
  const [saving, setSaving] = useState(false);

  /* ── 품목검색 모달 ── */
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);

  /* ── 라우팅 공정 ── */
  const [routingProcesses, setRoutingProcesses] = useState<ProcessItem[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<Set<number>>(new Set());
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingFetched, setRoutingFetched] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        itemCode: editData.itemCode ?? "",
        itemName: editData.itemName ?? "",
        reworkQty: String(editData.reworkQty ?? ""),
        defectType: editData.defectType ?? "",
        reworkMethod: editData.reworkMethod ?? "",
        lineCode: editData.lineCode ?? "",
        equipCode: editData.equipCode ?? "",
        workerId: editData.workerId ?? "",
        remark: editData.remark ?? "",
      });
      // 수정 모드: 품목코드로 라우팅 자동 조회
      if (editData.itemCode) {
        fetchRouting(editData.itemCode);
      }
    } else {
      setForm(INIT);
      setRoutingProcesses([]);
      setSelectedProcesses(new Set());
      setRoutingFetched(false);
    }
  }, [editData]);

  const setField = (key: keyof ReworkFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  /** 라우팅 조회 — 품목코드 기반 공정 목록 fetch */
  const fetchRouting = useCallback(async (itemCode: string) => {
    if (!itemCode) return;
    setRoutingLoading(true);
    try {
      const res = await api.get("/master/routings", {
        params: { itemCode, limit: 100 },
      });
      const items: ProcessItem[] = res.data?.data ?? [];
      setRoutingProcesses(items);
      setSelectedProcesses(new Set(items.map((_: ProcessItem, i: number) => i)));
    } catch {
      setRoutingProcesses([]);
    } finally {
      setRoutingLoading(false);
      setRoutingFetched(true);
    }
  }, []);

  /** 품목 선택 핸들러 */
  const handlePartSelect = useCallback((part: PartItem) => {
    setField("itemCode", part.itemCode);
    setField("itemName", part.itemName ?? "");
    // 품목 선택 시 라우팅 자동 조회
    fetchRouting(part.itemCode);
  }, [fetchRouting]);

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.reworkQty) return;
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        itemName: form.itemName,
        reworkQty: Number(form.reworkQty) || 0,
        defectType: form.defectType || undefined,
        reworkMethod: form.reworkMethod,
        lineCode: form.lineCode || undefined,
        equipCode: form.equipCode || undefined,
        workerId: form.workerId || undefined,
        remark: form.remark || undefined,
        processItems: routingProcesses
          .filter((_, idx) => selectedProcesses.has(idx))
          .map(p => ({
            processCode: p.processCode,
            processName: p.processName,
            seq: p.seq,
            workerId: form.workerId || undefined,
            lineCode: form.lineCode || undefined,
            equipCode: form.equipCode || undefined,
          })),
      };
      if (isEdit && editData) {
        await api.put(`/quality/reworks/${editData.reworkNo}`, payload);
      } else {
        await api.post("/quality/reworks", payload);
      }
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSave, onClose, routingProcesses, selectedProcesses]);

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 (고정) */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("quality.rework.edit") : t("quality.rework.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.itemCode || !form.reworkQty}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* ── 품목 선택 ── */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("quality.rework.itemCode")}
          </h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label={t("quality.rework.itemCode")}
                value={form.itemCode}
                readOnly
                placeholder={t("common.partSearch", "품목 검색")}
                fullWidth
              />
            </div>
            <Button size="sm" variant="secondary" onClick={() => setIsPartModalOpen(true)}
              className="mb-0.5 flex-shrink-0">
              <Search className="w-3.5 h-3.5 mr-1" />{t("common.search")}
            </Button>
          </div>
          {form.itemName && (
            <p className="mt-1 text-xs text-text-muted">{form.itemName}</p>
          )}
        </div>

        {/* ── 수량 / 불량유형 ── */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.rework.reworkQty")} type="number" value={form.reworkQty}
            onChange={e => setField("reworkQty", e.target.value)} fullWidth />
          <ComCodeSelect groupCode="DEFECT_TYPE" includeAll={false}
            label={t("quality.rework.defectType")} value={form.defectType}
            onChange={v => setField("defectType", v)} fullWidth />
        </div>

        {/* ── 라우팅 공정 선택 ── */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            {t("quality.rework.selectProcesses")}
          </h3>

          {routingLoading && (
            <div className="text-xs text-text-muted py-4 text-center">
              {t("common.loading", "로딩중...")}
            </div>
          )}

          {!routingLoading && routingFetched && routingProcesses.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 rounded-lg border border-border bg-surface dark:bg-slate-800 text-text-muted text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t("master.bom.noRoutingData")}</span>
            </div>
          )}

          {!routingLoading && !routingFetched && !form.itemCode && (
            <div className="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-border text-text-muted text-xs">
              <Search className="w-4 h-4 flex-shrink-0" />
              <span>품목을 먼저 선택하세요</span>
            </div>
          )}

          {routingProcesses.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted">
                  {selectedProcesses.size}/{routingProcesses.length} {t("common.selected", "선택")}
                </span>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox"
                    checked={selectedProcesses.size === routingProcesses.length}
                    onChange={e => {
                      if (e.target.checked) setSelectedProcesses(new Set(routingProcesses.map((_, i) => i)));
                      else setSelectedProcesses(new Set());
                    }}
                    className="w-3.5 h-3.5 rounded text-primary" />
                  {t("common.selectAll")}
                </label>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto border border-border rounded-lg p-2">
                {routingProcesses.map((proc, idx) => (
                  <label key={idx}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-xs
                      ${selectedProcesses.has(idx) ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-surface"}`}>
                    <input type="checkbox"
                      checked={selectedProcesses.has(idx)}
                      onChange={e => {
                        const next = new Set(selectedProcesses);
                        if (e.target.checked) next.add(idx); else next.delete(idx);
                        setSelectedProcesses(next);
                      }}
                      className="w-3.5 h-3.5 rounded text-primary" />
                    <span className="text-text-muted w-6 text-center">{proc.seq}</span>
                    <span className="font-medium text-text">{proc.processCode}</span>
                    <span className="text-text-muted flex-1">{proc.processName}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── 라인 / 설비 / 작업자 ── */}
        <div className="grid grid-cols-1 gap-3">
          <LineSelect label={t("quality.rework.line")} value={form.lineCode}
            onChange={v => setField("lineCode", v)} fullWidth />
          <EquipSelect label={t("quality.rework.equip")} value={form.equipCode}
            onChange={v => setField("equipCode", v)} fullWidth />
          <WorkerSelect label={t("quality.rework.worker")} value={form.workerId}
            onChange={v => setField("workerId", v)} fullWidth />
        </div>

        {/* ── 재작업방법 ── */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.rework.reworkMethod")}
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.reworkMethod}
            onChange={e => setField("reworkMethod", e.target.value)}
          />
        </div>

        {/* ── 비고 ── */}
        <Input label={t("common.remark")} value={form.remark}
          onChange={e => setField("remark", e.target.value)} fullWidth />
      </div>

      {/* 품목검색 모달 */}
      <PartSearchModal
        isOpen={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        onSelect={handlePartSelect}
      />
    </div>
  );
}
