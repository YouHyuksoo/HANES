"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/AddInspectItemModal.tsx
 * @description 설비에 점검항목 추가 모달 - API로 직접 생성
 *
 * 초보자 가이드:
 * 1. 선택된 설비에 새 점검항목을 등록하는 폼 모달
 * 2. API: POST /master/equip-inspect-items
 * 3. seq는 현재 최대값 + 1로 자동 설정
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  currentMaxSeq: number;
  onAdded: () => void;
}

export default function AddInspectItemModal({ isOpen, onClose, equipCode, equipName, currentMaxSeq, onAdded }: Props) {
  const { t } = useTranslation();
  const [itemName, setItemName] = useState("");
  const [inspectType, setInspectType] = useState<"DAILY" | "PERIODIC">("DAILY");
  const [criteria, setCriteria] = useState("");
  const [cycle, setCycle] = useState("DAILY");
  const [seq, setSeq] = useState(String(currentMaxSeq + 1));
  const [saving, setSaving] = useState(false);


  const resetForm = () => {
    setItemName("");
    setInspectType("DAILY");
    setCriteria("");
    setCycle("DAILY");
    setSeq(String(currentMaxSeq + 1));
  };

  const handleSave = async () => {
    if (!itemName.trim()) return;
    setSaving(true);
    try {
      await api.post("/master/equip-inspect-items", {
        equipCode,
        inspectType,
        seq: parseInt(seq, 10) || (currentMaxSeq + 1),
        itemName: itemName.trim(),
        criteria: criteria.trim() || null,
        cycle,
        useYn: "Y",
      });
      resetForm();
      onAdded();
    } catch { /* 에러 처리 */ }
    finally { setSaving(false); }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("master.equipInspect.linkItem", "점검항목 추가")} size="lg">
      {/* 대상 설비 표시 */}
      <div className="mb-4 p-3 rounded-lg bg-surface border border-border">
        <span className="text-sm text-text-muted">{t("master.equipInspect.targetEquip", "대상 설비")}: </span>
        <span className="font-mono font-medium text-text">{equipCode}</span>
        <span className="text-sm text-text-muted ml-2">{equipName}</span>
      </div>

      <div className="space-y-4">
        <Input label={t("master.equipInspect.itemName")} value={itemName}
          onChange={e => setItemName(e.target.value)} placeholder={t("master.equipInspect.itemNamePlaceholder", "점검항목명 입력")} fullWidth />

        <div className="grid grid-cols-3 gap-4">
          <ComCodeSelect label={t("master.equipInspect.inspectType")} groupCode="INSPECT_TYPE" includeAll={false}
            value={inspectType} onChange={v => setInspectType(v as "DAILY" | "PERIODIC")} />
          <ComCodeSelect label={t("master.equipInspect.cycle")} groupCode="PM_CYCLE_TYPE" includeAll={false}
            value={cycle} onChange={setCycle} />
          <Input label={t("master.equipInspect.seq")} type="number" value={seq}
            onChange={e => setSeq(e.target.value)} fullWidth />
        </div>

        <Input label={t("master.equipInspect.criteria")} value={criteria}
          onChange={e => setCriteria(e.target.value)} placeholder={t("master.equipInspect.criteriaPlaceholder", "판정기준 입력")} fullWidth />
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={handleClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={!itemName.trim() || saving}>
          {saving ? t("common.saving", "저장 중...") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
