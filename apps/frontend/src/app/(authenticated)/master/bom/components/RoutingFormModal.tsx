"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/RoutingFormModal.tsx
 * @description 라우팅 추가/수정 폼 모달 - API 연동 (POST/PUT /master/routings)
 *
 * 초보자 가이드:
 * 1. **editingItem = null**: 추가 모드 → POST /master/routings
 * 2. **editingItem != null**: 수정 모드 → PUT /master/routings/:id
 * 3. partId는 자동으로 설정 (부모에서 전달)
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, Input } from "@/components/ui";
import api from "@/services/api";
import { RoutingItem } from "../types";

interface RoutingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingItem: RoutingItem | null;
  partId: string;
}

export default function RoutingFormModal({ isOpen, onClose, onSave, editingItem, partId }: RoutingFormModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [seq, setSeq] = useState("1");
  const [processCode, setProcessCode] = useState("");
  const [processName, setProcessName] = useState("");
  const [processType, setProcessType] = useState("");
  const [equipType, setEquipType] = useState("");
  const [stdTime, setStdTime] = useState("");
  const [setupTime, setSetupTime] = useState("");
  const [wireLength, setWireLength] = useState("");
  const [stripLength, setStripLength] = useState("");
  const [crimpHeight, setCrimpHeight] = useState("");
  const [crimpWidth, setCrimpWidth] = useState("");
  const [weldCondition, setWeldCondition] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setSeq(String(editingItem.seq));
      setProcessCode(editingItem.processCode);
      setProcessName(editingItem.processName);
      setProcessType(editingItem.processType || "");
      setEquipType(editingItem.equipType || "");
      setStdTime(editingItem.stdTime != null ? String(editingItem.stdTime) : "");
      setSetupTime(editingItem.setupTime != null ? String(editingItem.setupTime) : "");
      setWireLength(editingItem.wireLength != null ? String(editingItem.wireLength) : "");
      setStripLength(editingItem.stripLength != null ? String(editingItem.stripLength) : "");
      setCrimpHeight(editingItem.crimpHeight != null ? String(editingItem.crimpHeight) : "");
      setCrimpWidth(editingItem.crimpWidth != null ? String(editingItem.crimpWidth) : "");
      setWeldCondition(editingItem.weldCondition || "");
    } else {
      setSeq("1"); setProcessCode(""); setProcessName(""); setProcessType("");
      setEquipType(""); setStdTime(""); setSetupTime(""); setWireLength("");
      setStripLength(""); setCrimpHeight(""); setCrimpWidth(""); setWeldCondition("");
    }
  }, [isOpen, editingItem]);

  const toNum = (v: string) => v ? Number(v) : undefined;

  const handleSave = async () => {
    if (!processCode || !processName) return;
    setSaving(true);
    try {
      const body = {
        partId, seq: Number(seq), processCode, processName,
        processType: processType || undefined, equipType: equipType || undefined,
        stdTime: toNum(stdTime), setupTime: toNum(setupTime),
        wireLength: toNum(wireLength), stripLength: toNum(stripLength),
        crimpHeight: toNum(crimpHeight), crimpWidth: toNum(crimpWidth),
        weldCondition: weldCondition || undefined, useYn: "Y",
      };
      if (editingItem) {
        await api.put(`/master/routings/${editingItem.id}`, body);
      } else {
        await api.post("/master/routings", body);
      }
      onSave();
      onClose();
    } catch { /* API 에러는 인터셉터에서 처리 */ }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? t("master.routing.editRouting") : t("master.routing.addRouting")} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Input label={t("master.routing.seq")} type="number" value={seq} onChange={(e) => setSeq(e.target.value)} fullWidth />
          <Input label={t("master.routing.processCode")} value={processCode} onChange={(e) => setProcessCode(e.target.value)} placeholder="CUT-01" fullWidth />
          <Input label={t("master.routing.processName")} value={processName} onChange={(e) => setProcessName(e.target.value)} placeholder="전선절단" fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.routing.processType")} value={processType} onChange={(e) => setProcessType(e.target.value)} placeholder="CUT" fullWidth />
          <Input label={t("master.routing.equipType")} value={equipType} onChange={(e) => setEquipType(e.target.value)} placeholder={t("master.routing.equipTypePlaceholder")} fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.routing.stdTimeSec")} type="number" step="0.1" value={stdTime} onChange={(e) => setStdTime(e.target.value)} placeholder="5.5" fullWidth />
          <Input label={t("master.routing.setupTimeSec")} type="number" step="0.1" value={setupTime} onChange={(e) => setSetupTime(e.target.value)} placeholder="10" fullWidth />
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-text-muted mb-3">{t("master.routing.processDetailTitle")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("master.routing.wireLength")} type="number" step="0.1" value={wireLength} onChange={(e) => setWireLength(e.target.value)} fullWidth />
            <Input label={t("master.routing.stripLength")} type="number" step="0.1" value={stripLength} onChange={(e) => setStripLength(e.target.value)} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label={t("master.routing.crimpHeight")} type="number" step="0.01" value={crimpHeight} onChange={(e) => setCrimpHeight(e.target.value)} fullWidth />
            <Input label={t("master.routing.crimpWidth")} type="number" step="0.01" value={crimpWidth} onChange={(e) => setCrimpWidth(e.target.value)} fullWidth />
          </div>
          <div className="mt-4">
            <Input label={t("master.routing.weldCondition")} value={weldCondition} onChange={(e) => setWeldCondition(e.target.value)}
              placeholder={t("master.routing.weldConditionPlaceholder")} fullWidth />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !processCode || !processName}>
          {saving ? t("common.loading") : editingItem ? t("common.edit") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
