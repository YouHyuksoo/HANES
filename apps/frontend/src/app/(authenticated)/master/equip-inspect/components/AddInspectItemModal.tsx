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
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@/components/ui";
import api from "@/services/api";
import { InspectItemPoolRow } from "../types";

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
  const [poolItems, setPoolItems] = useState<InspectItemPoolRow[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState("");
  const [inspectType, setInspectType] = useState<InspectItemPoolRow["inspectType"]>("DAILY");
  const [seq, setSeq] = useState(String(currentMaxSeq + 1));
  const [saving, setSaving] = useState(false);

  const typeOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
    { value: "PM", label: t("master.equipInspect.typePM", "예방보전") },
    { value: "WORKER", label: t("master.equipInspect.typeWorker", "작업자설비점검") },
  ], [t]);

  useEffect(() => {
    if (!isOpen) return;
    setSeq(String(currentMaxSeq + 1));
    setInspectType("DAILY");
    setSelectedItemCode("");
  }, [isOpen, currentMaxSeq]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedItemCode("");
    (async () => {
      try {
        const res = await api.get("/master/equip-inspect-item-pool", {
          params: { useYn: "Y", inspectType, limit: "1000" },
        });
        setPoolItems(res.data?.data ?? []);
      } catch {
        setPoolItems([]);
      }
    })();
  }, [isOpen, inspectType]);

  const selectedItem = useMemo(
    () => poolItems.find(item => item.itemCode === selectedItemCode) || null,
    [poolItems, selectedItemCode],
  );

  const poolOptions = useMemo(() => poolItems.map(item => ({
    value: item.itemCode,
    label: `${item.itemCode} - ${item.itemName}`,
  })), [poolItems]);

  const resetForm = () => {
    setSelectedItemCode("");
    setInspectType("DAILY");
    setSeq(String(currentMaxSeq + 1));
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await api.post("/master/equip-inspect-items", {
        equipCode,
        itemCode: selectedItem.itemCode,
        inspectType,
        seq: parseInt(seq, 10) || (currentMaxSeq + 1),
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
        <Select
          label={t("master.equipInspect.inspectType")}
          options={typeOptions}
          value={inspectType}
          onChange={value => setInspectType(value as InspectItemPoolRow["inspectType"])}
          fullWidth
        />

        <Select
          label={t("master.equipInspect.itemName", "점검항목")}
          placeholder={t("master.equipInspect.selectPoolItem", "점검항목 마스터 선택")}
          options={poolOptions}
          value={selectedItemCode}
          onChange={setSelectedItemCode}
          fullWidth
        />

        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.equipInspect.itemCode", "항목코드")} value={selectedItem?.itemCode || ""}
            disabled fullWidth />
          <Input label={t("master.equipInspect.seq")} type="number" value={seq}
            onChange={e => setSeq(e.target.value)} fullWidth />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.equipInspect.cycle")} value={selectedItem?.cycle || ""}
            disabled fullWidth />
          <Input label={t("master.equipInspect.criteria")} value={selectedItem?.criteria || ""}
            disabled fullWidth />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={handleClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={!selectedItem || saving}>
          {saving ? t("common.saving", "저장 중...") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
