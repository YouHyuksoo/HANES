"use client";

/**
 * @file quality/ppap/components/PpapFormPanel.tsx
 * @description PPAP 등록/수정/상세보기 모달
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정/상세
 * 2. 품목검색(PartSearchModal), 고객, PPAP레벨, 사유 등 입력
 * 3. 하단에 PpapElementChecklist로 18개 요소 체크리스트 표시
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal } from "@/components/ui";
import { ComCodeSelect, PartSearchModal, PartnerSelect } from "@/components/shared";
import api from "@/services/api";
import PpapElementChecklist from "./PpapElementChecklist";

/** 폼 데이터 타입 */
interface PpapFormData {
  itemCode: string; itemName: string; customerCode: string;
  customerName: string; ppapLevel: number; reason: string; remark: string;
}
const INIT: PpapFormData = { itemCode: "", itemName: "", customerCode: "", customerName: "", ppapLevel: 3, reason: "", remark: "" };

interface Props {
  isOpen: boolean;
  editData: {
    ppapNo: string;
    itemCode: string;
    itemName: string;
    customerCode: string;
    customerName: string;
    ppapLevel: number;
    reason: string;
    status: string;
    remark: string;
    submittedAt: string;
    approvedAt: string;
    completionRate: number;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function PpapFormPanel({ isOpen, editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<PpapFormData>(INIT);
  const [saving, setSaving] = useState(false);
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [elements, setElements] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (editData) {
      setForm({
        itemCode: editData.itemCode ?? "",
        itemName: editData.itemName ?? "",
        customerCode: editData.customerCode ?? "",
        customerName: editData.customerName ?? "",
        ppapLevel: editData.ppapLevel ?? 3,
        reason: editData.reason ?? "",
        remark: editData.remark ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof PpapFormData, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.reason) return;
    setSaving(true);
    try {
      const payload = { ...form, elements };
      if (isEdit && editData) {
        await api.patch(`/quality/ppap/${editData.ppapNo}`, payload);
      } else {
        await api.post("/quality/ppap", payload);
      }
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, elements, isEdit, editData, onSave, onClose]);

  const isReadonly = isEdit && !["DRAFT", "REJECTED"].includes(editData?.status ?? "");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg"
      title={isReadonly ? `${t("common.detail")} - PPAP` : (isEdit ? `${t("common.edit")} - PPAP` : t("quality.ppap.create"))}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          {!isReadonly && (
            <Button size="sm" onClick={handleSave} disabled={saving || !form.itemCode || !form.reason}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          )}
        </div>
      }>
      <div className="space-y-4 text-xs">
        {/* 상태 / 제출일 / 승인일 (수정 시 읽기 전용) */}
        {isEdit && editData && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-0.5">{t("common.status")}</label>
              <span className="text-xs font-semibold text-text">{editData.status}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-0.5">{t("quality.ppap.submittedAt")}</label>
              <span className="text-xs text-text">{editData.submittedAt?.slice(0, 10) ?? "-"}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-0.5">{t("quality.ppap.approvedAt")}</label>
              <span className="text-xs text-text">{editData.approvedAt?.slice(0, 10) ?? "-"}</span>
            </div>
          </div>
        )}

        {/* 품목코드 / 품목명 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label={t("quality.ppap.itemCode")} value={form.itemCode} readOnly
              onClick={() => !isReadonly && setShowPartSearch(true)} fullWidth
              className="cursor-pointer" />
          </div>
          <Input label={t("quality.ppap.itemName")} value={form.itemName} readOnly fullWidth />
        </div>

        {/* 고객 */}
        <PartnerSelect partnerType="CUSTOMER"
          label={t("quality.ppap.customerCode")} value={form.customerCode}
          onChange={v => setField("customerCode", v)} fullWidth disabled={isReadonly} />

        {/* PPAP 레벨 / 사유 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">{t("quality.ppap.ppapLevel")}</label>
            <select value={form.ppapLevel} onChange={e => setField("ppapLevel", Number(e.target.value))}
              disabled={isReadonly}
              className="w-full h-8 px-2 rounded-md border border-border bg-white dark:bg-slate-900 text-text text-xs disabled:opacity-50">
              {[1, 2, 3, 4, 5].map(lv => (
                <option key={lv} value={lv}>Level {lv}</option>
              ))}
            </select>
          </div>
          <ComCodeSelect groupCode="PPAP_REASON" includeAll={false}
            label={t("quality.ppap.reason")} value={form.reason}
            onChange={v => setField("reason", v)} fullWidth disabled={isReadonly} />
        </div>

        {/* 비고 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">{t("common.remark")}</label>
          <textarea value={form.remark} onChange={e => setField("remark", e.target.value)}
            disabled={isReadonly}
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900 text-text px-3 py-2 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50" />
        </div>

        {/* PPAP 요소 체크리스트 */}
        <PpapElementChecklist ppapLevel={form.ppapLevel} elements={elements}
          onChange={setElements} readonly={!!isReadonly}
          completionRate={editData?.completionRate} />
      </div>

      {/* 품목 검색 모달 */}
      {showPartSearch && (
        <PartSearchModal
          isOpen={showPartSearch}
          onClose={() => setShowPartSearch(false)}
          onSelect={(part) => {
            setField("itemCode", part.itemCode);
            setField("itemName", part.itemName);
            setShowPartSearch(false);
          }}
        />
      )}
    </Modal>
  );
}
