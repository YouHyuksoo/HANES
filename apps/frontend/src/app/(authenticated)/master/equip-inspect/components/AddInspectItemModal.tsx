"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import { InspectItemMasterRow } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  inspectType: InspectItemMasterRow["inspectType"];
  onAdded: () => void;
}

export default function AddInspectItemModal({ isOpen, onClose, equipCode, equipName, inspectType, onAdded }: Props) {
  const { t } = useTranslation();
  const [masterItems, setMasterItems] = useState<InspectItemMasterRow[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState("");
  const [selectedEquipType, setSelectedEquipType] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const itemTypeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.equipInspect.itemTypeVisual", "판정형"),
    MEASURE: t("master.equipInspect.itemTypeMeasure", "측정형"),
  }), [t]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedItemCode("");
    setSelectedEquipType("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedItemCode("");
    (async () => {
      try {
        const params: Record<string, string> = { useYn: "Y", inspectType, limit: "1000" };
        if (selectedEquipType) params.equipType = selectedEquipType;
        const res = await api.get("/master/equip-inspect-item-masters", { params });
        setMasterItems(res.data?.data ?? []);
      } catch {
        setMasterItems([]);
      }
    })();
  }, [isOpen, inspectType, selectedEquipType]);

  const selectedItem = useMemo(
    () => masterItems.find(item => item.itemCode === selectedItemCode) || null,
    [masterItems, selectedItemCode],
  );

  const masterOptions = useMemo(() => masterItems.map(item => ({
    value: item.itemCode,
    label: `${item.itemCode} - ${item.itemName}`,
  })), [masterItems]);

  const resetForm = () => {
    setSelectedItemCode("");
    setSelectedEquipType("");
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await api.post("/master/equip-inspect-items", {
        equipCode,
        itemCode: selectedItem.itemCode,
        inspectType,
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
      <div className="mb-4 p-3 rounded-lg bg-surface border border-border flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-muted">{t("master.equipInspect.targetEquip", "대상 설비")}: </span>
        <span className="font-mono font-medium text-text">{equipCode}</span>
        <span className="text-sm text-text-muted">{equipName}</span>
        <ComCodeBadge groupCode="INSPECT_TYPE" code={inspectType} />
      </div>

      <div className="space-y-4">
        <ComCodeSelect
          label={t("master.equipInspect.equipType", "설비유형")}
          groupCode="EQUIP_TYPE"
          value={selectedEquipType}
          onChange={setSelectedEquipType}
          placeholder={t("common.all", "전체")}
          fullWidth
        />

        <div>
          <Select
            label={t("master.equipInspect.itemName", "점검항목")}
            placeholder={t("master.equipInspect.selectPoolItem", "점검항목 마스터 선택")}
            options={masterOptions}
            value={selectedItemCode}
            onChange={setSelectedItemCode}
            fullWidth
          />
          {masterOptions.length === 0 && (
            <p className="mt-1 text-xs text-text-muted">
              {t("master.equipInspect.noPoolForType", "이 설비유형/점검유형에 등록된 점검항목 마스터가 없습니다. 점검항목 마스터에서 먼저 등록하세요.")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.equipInspect.itemCode", "항목코드")} value={selectedItem?.itemCode || ""} disabled fullWidth />
          <Input
            label={t("master.equipInspect.itemType", "판정구분")}
            value={selectedItem ? (itemTypeLabels[selectedItem.itemType] || "") : ""}
            disabled fullWidth
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.equipInspect.cycle")} value={selectedItem?.cycle || ""} disabled fullWidth />
          <Input
            label={selectedItem?.itemType === "MEASURE" ? t("master.equipInspect.spec", "규격") : t("master.equipInspect.criteria")}
            value={
              selectedItem?.itemType === "MEASURE"
                ? `${selectedItem.lslValue ?? ""} ~ ${selectedItem.uslValue ?? ""}${selectedItem.unit ? ` (${selectedItem.unit})` : ""}`
                : selectedItem?.criteria || ""
            }
            disabled fullWidth
          />
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
