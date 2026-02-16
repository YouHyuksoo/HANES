/**
 * @file src/app/(authenticated)/master/part/components/PartFormModal.tsx
 * @description 품목 추가/수정 모달 - API 연동 (Oracle TM_ITEMS 기준 10개 핵심 컬럼)
 *
 * 초보자 가이드:
 * 1. **기본정보**: 품목코드, 품번, 품명, 유형, 규격, 리비전 등
 * 2. **수량/관리**: 박스입수량, LOT단위, 안전재고, 유효기간, 택타임
 * 3. **API**: POST /master/parts (생성), PUT /master/parts/:id (수정)
 */

"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@/components/ui";
import api from "@/services/api";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import { Part, PRODUCT_TYPE_OPTIONS } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingPart: Part | null;
  onSave: () => void;
}

export default function PartFormModal({ isOpen, onClose, editingPart, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingPart;
  const { options: supplierOptions } = usePartnerOptions("SUPPLIER");
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");

  const partTypeOptions = useMemo(() => [
    { value: "RAW", label: t("inventory.stock.raw", "원자재") },
    { value: "WIP", label: t("inventory.stock.wip", "반제품") },
    { value: "FG", label: t("inventory.stock.fg", "완제품") },
  ], [t]);

  const iqcOptions = [
    { value: "Y", label: "Y (대상)" },
    { value: "N", label: "N (비대상)" },
  ];

  const [form, setForm] = useState(() => ({
    partCode: editingPart?.partCode || "",
    partName: editingPart?.partName || "",
    partNo: editingPart?.partNo || "",
    custPartNo: editingPart?.custPartNo || "",
    partType: (editingPart?.partType || "RAW") as "RAW" | "WIP" | "FG",
    productType: editingPart?.productType || "",
    spec: editingPart?.spec || "",
    rev: editingPart?.rev || "",
    unit: editingPart?.unit || "EA",
    vendor: editingPart?.vendor || "",
    customer: editingPart?.customer || "",
    boxQty: editingPart?.boxQty ?? 0,
    lotUnitQty: editingPart?.lotUnitQty ?? 0,
    safetyStock: editingPart?.safetyStock ?? 0,
    tactTime: editingPart?.tactTime ?? 0,
    expiryDate: editingPart?.expiryDate ?? 0,
    iqcYn: editingPart?.iqcYn || "Y",
    remark: editingPart?.remark || "",
  }));
  const [saving, setSaving] = useState(false);

  const setField = (key: string, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.partCode.trim() || !form.partName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        partNo: form.partNo || undefined,
        custPartNo: form.custPartNo || undefined,
        productType: form.productType || undefined,
        spec: form.spec || undefined,
        rev: form.rev || undefined,
        vendor: form.vendor || undefined,
        customer: form.customer || undefined,
        remark: form.remark || undefined,
        lotUnitQty: form.lotUnitQty || undefined,
      };

      if (isEdit && editingPart?.id) {
        await api.put(`/master/parts/${editingPart.id}`, payload);
      } else {
        await api.post("/master/parts", payload);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={isEdit ? t("master.part.editPart") : t("master.part.addPart")} size="xl">

      {/* 기본정보 섹션 */}
      <h3 className="text-sm font-semibold text-text-muted mb-3">
        {t("master.part.sectionBasic", "기본정보")}
      </h3>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Input label={t("master.part.partCode")} placeholder="1111"
          value={form.partCode} onChange={e => setField("partCode", e.target.value)}
          disabled={isEdit} fullWidth />
        <Input label={t("master.part.partNo", "품번")} placeholder="ECW01331AA-C-0A1"
          value={form.partNo} onChange={e => setField("partNo", e.target.value)} fullWidth />
        <Input label={t("master.part.custPartNo", "고객품번")} placeholder="HMC-001"
          value={form.custPartNo} onChange={e => setField("custPartNo", e.target.value)} fullWidth />
        <Input label={t("master.part.rev", "리비전")} placeholder="A"
          value={form.rev} onChange={e => setField("rev", e.target.value)} fullWidth />
        <div className="col-span-2">
          <Input label={t("master.part.partName")} placeholder="HNS ASSY"
            value={form.partName} onChange={e => setField("partName", e.target.value)} fullWidth />
        </div>
        <Select label={t("master.part.type")} options={partTypeOptions}
          value={form.partType} onChange={v => setField("partType", v)} fullWidth />
        <Select label={t("master.part.productType", "제품유형")}
          options={PRODUCT_TYPE_OPTIONS.filter(o => o.value)}
          value={form.productType} onChange={v => setField("productType", v)} fullWidth />
        <div className="col-span-2">
          <Input label={t("master.part.spec")} placeholder="Fuse to Minus Cable"
            value={form.spec} onChange={e => setField("spec", e.target.value)} fullWidth />
        </div>
        <Input label={t("master.part.unit")} placeholder="EA, M, KG"
          value={form.unit} onChange={e => setField("unit", e.target.value)} fullWidth />
        <Select label={t("master.part.iqcFlag", "IQC대상")} options={iqcOptions}
          value={form.iqcYn} onChange={v => setField("iqcYn", v)} fullWidth />
      </div>

      {/* 거래처/수량 섹션 */}
      <h3 className="text-sm font-semibold text-text-muted mb-3">
        {t("master.part.sectionQty", "거래처 / 수량관리")}
      </h3>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Select label={t("master.part.vendor")} options={supplierOptions}
          value={form.vendor} onChange={v => setField("vendor", v)} fullWidth />
        <Select label={t("master.part.customer")} options={customerOptions}
          value={form.customer} onChange={v => setField("customer", v)} fullWidth />
        <Input label={t("master.part.boxQty", "박스입수량")} type="number" placeholder="50"
          value={String(form.boxQty)} onChange={e => setField("boxQty", Number(e.target.value))} fullWidth />
        <Input label={t("master.part.lotUnitQty", "LOT단위수량")} type="number" placeholder="500"
          value={String(form.lotUnitQty)} onChange={e => setField("lotUnitQty", Number(e.target.value))} fullWidth />
        <Input label={t("master.part.safetyStock")} type="number" placeholder="100"
          value={String(form.safetyStock)} onChange={e => setField("safetyStock", Number(e.target.value))} fullWidth />
        <Input label={t("master.part.tactTime", "택타임(초)")} type="number" placeholder="0"
          value={String(form.tactTime)} onChange={e => setField("tactTime", Number(e.target.value))} fullWidth />
        <Input label={t("master.part.expiryDate", "유효기간(일)")} type="number" placeholder="365"
          value={String(form.expiryDate)} onChange={e => setField("expiryDate", Number(e.target.value))} fullWidth />
        <Input label={t("master.part.leadTime", "리드타임(일)")} type="number" placeholder="7"
          fullWidth />
      </div>

      {/* 비고 */}
      <div className="mb-4">
        <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
          value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.partCode.trim() || !form.partName.trim()}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </Modal>
  );
}
