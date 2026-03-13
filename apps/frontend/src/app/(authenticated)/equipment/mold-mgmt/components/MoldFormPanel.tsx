"use client";

/**
 * @file equipment/mold-mgmt/components/MoldFormPanel.tsx
 * @description 금형 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **editData**: null이면 신규 등록, 값이 있으면 수정 모드
 * 2. **PartSearchModal**: 품목코드 검색 모달
 * 3. **폐기처리**: PATCH /equipment/molds/retire/:id
 * 4. 읽기전용: currentShots, status, lastMaintenanceDate, nextMaintenanceDate
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Trash2 } from "lucide-react";
import { Button, Input, ComCodeBadge, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import api from "@/services/api";

interface MoldEditData {
  id: number; moldCode: string; moldName: string; moldType: string;
  itemCode: string; cavity: number; currentShots: number; guaranteedShots: number;
  maintenanceCycle: number; status: string; lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null; location: string; maker: string;
  purchaseDate: string | null; remarks: string;
}

interface FormState {
  moldCode: string; moldName: string; moldType: string; itemCode: string;
  cavity: string; guaranteedShots: string; maintenanceCycle: string;
  location: string; maker: string; purchaseDate: string; remarks: string;
}

const INIT: FormState = {
  moldCode: "", moldName: "", moldType: "", itemCode: "",
  cavity: "", guaranteedShots: "", maintenanceCycle: "",
  location: "", maker: "", purchaseDate: "", remarks: "",
};

interface Props { editData: MoldEditData | null; onClose: () => void; onSave: () => void; }

export default function MoldFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<FormState>(INIT);
  const [saving, setSaving] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [retireConfirm, setRetireConfirm] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        moldCode: editData.moldCode ?? "", moldName: editData.moldName ?? "",
        moldType: editData.moldType ?? "", itemCode: editData.itemCode ?? "",
        cavity: String(editData.cavity ?? ""), guaranteedShots: String(editData.guaranteedShots ?? ""),
        maintenanceCycle: String(editData.maintenanceCycle ?? ""),
        location: editData.location ?? "", maker: editData.maker ?? "",
        purchaseDate: editData.purchaseDate?.slice(0, 10) ?? "", remarks: editData.remarks ?? "",
      });
    } else { setForm(INIT); }
  }, [editData]);

  const sf = (key: keyof FormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = useCallback(async () => {
    if (!form.moldCode || !form.moldName) return;
    setSaving(true);
    try {
      const payload = {
        moldCode: form.moldCode, moldName: form.moldName,
        moldType: form.moldType || undefined, itemCode: form.itemCode || undefined,
        cavity: Number(form.cavity) || 0, guaranteedShots: Number(form.guaranteedShots) || 0,
        maintenanceCycle: Number(form.maintenanceCycle) || 0,
        location: form.location || undefined, maker: form.maker || undefined,
        purchaseDate: form.purchaseDate || undefined, remarks: form.remarks || undefined,
      };
      if (isEdit && editData) await api.patch(`/equipment/molds/${editData.id}`, payload);
      else await api.post("/equipment/molds", payload);
      onSave(); onClose();
    } catch { /* api interceptor */ } finally { setSaving(false); }
  }, [form, isEdit, editData, onSave, onClose]);

  const handleRetire = useCallback(async () => {
    if (!editData) return;
    try { await api.patch(`/equipment/molds/retire/${editData.id}`); onSave(); onClose(); }
    catch { /* api interceptor */ }
  }, [editData, onSave, onClose]);

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("equipment.mold.editTitle") : t("equipment.mold.createTitle")}
        </h2>
        <div className="flex items-center gap-2">
          {isEdit && editData?.status !== "RETIRED" && (
            <Button size="sm" variant="danger" onClick={() => setRetireConfirm(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />{t("equipment.mold.retire")}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.moldCode || !form.moldName}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("equipment.mold.moldCode")} value={form.moldCode}
            onChange={e => sf("moldCode", e.target.value)} fullWidth readOnly={isEdit} />
          <Input label={t("equipment.mold.moldName")} value={form.moldName}
            onChange={e => sf("moldName", e.target.value)} fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="MOLD_TYPE" includeAll={false}
            label={t("equipment.mold.moldType")} value={form.moldType}
            onChange={v => sf("moldType", v)} fullWidth />
          <div>
            <label className="block text-xs font-medium text-text mb-1">{t("equipment.mold.itemCode")}</label>
            <div className="flex gap-1">
              <Input value={form.itemCode} readOnly fullWidth />
              <Button size="sm" variant="secondary" onClick={() => setIsPartModalOpen(true)} className="flex-shrink-0">
                <Search className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label={t("equipment.mold.cavity")} type="number" value={form.cavity}
            onChange={e => sf("cavity", e.target.value)} fullWidth />
          <Input label={t("equipment.mold.guaranteedShots")} type="number" value={form.guaranteedShots}
            onChange={e => sf("guaranteedShots", e.target.value)} fullWidth />
          <Input label={t("equipment.mold.maintenanceCycle")} type="number" value={form.maintenanceCycle}
            onChange={e => sf("maintenanceCycle", e.target.value)} fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("equipment.mold.location")} value={form.location}
            onChange={e => sf("location", e.target.value)} fullWidth />
          <Input label={t("equipment.mold.maker")} value={form.maker}
            onChange={e => sf("maker", e.target.value)} fullWidth />
        </div>
        <Input label={t("equipment.mold.purchaseDate")} type="date" value={form.purchaseDate}
          onChange={e => sf("purchaseDate", e.target.value)} fullWidth />
        <Input label={t("common.remark")} value={form.remarks}
          onChange={e => sf("remarks", e.target.value)} fullWidth />
        {/* 읽기전용 현황 (수정모드) */}
        {isEdit && editData && (
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-muted">{t("equipment.mold.currentInfo")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">{t("equipment.mold.currentShots")}</label>
                <p className="font-mono text-sm font-bold text-text">{editData.currentShots?.toLocaleString() ?? 0}</p>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{t("equipment.mold.status")}</label>
                <ComCodeBadge groupCode="MOLD_STATUS" code={editData.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">{t("equipment.mold.lastMaint")}</label>
                <p className="text-sm text-text">{editData.lastMaintenanceDate?.slice(0, 10) ?? "-"}</p>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">{t("equipment.mold.nextMaint")}</label>
                <p className="text-sm text-text">{editData.nextMaintenanceDate?.slice(0, 10) ?? "-"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <PartSearchModal isOpen={isPartModalOpen} onClose={() => setIsPartModalOpen(false)}
        onSelect={(part: PartItem) => sf("itemCode", part.itemCode)} />
      <ConfirmModal isOpen={retireConfirm} onClose={() => setRetireConfirm(false)}
        onConfirm={handleRetire} title={t("equipment.mold.retire")}
        message={t("equipment.mold.retireConfirm")} />
    </div>
  );
}
