/**
 * @file src/app/(authenticated)/master/company/components/CompanyForm.tsx
 * @description 회사 추가/수정 오른쪽 슬라이드 패널 (사업장 관리 포함)
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **회사정보**: 기본정보 + 연락처 폼
 * 3. **사업장 관리**: 수정 모드에서 해당 회사의 사업장 CRUD
 * 4. API: POST/PUT /master/companies, GET/POST/DELETE /master/plants
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2, MapPin } from "lucide-react";
import { Button, Input, ConfirmModal } from "@/components/ui";
import api from "@/services/api";
import { Company, Plant } from "../types";

interface Props {
  editingCompany: Company | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function CompanyFormPanel({ editingCompany, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingCompany;

  const [form, setForm] = useState({
    companyCode: editingCompany?.companyCode || "",
    companyName: editingCompany?.companyName || "",
    bizNo: editingCompany?.bizNo || "",
    ceoName: editingCompany?.ceoName || "",
    address: editingCompany?.address || "",
    tel: editingCompany?.tel || "",
    fax: editingCompany?.fax || "",
    email: editingCompany?.email || "",
    remark: editingCompany?.remark || "",
  });
  const [saving, setSaving] = useState(false);

  // 사업장 관련 상태
  const [plants, setPlants] = useState<Plant[]>([]);
  const [newPlant, setNewPlant] = useState({ plantCode: "", plantName: "" });
  const [addingPlant, setAddingPlant] = useState(false);
  const [deletePlantTarget, setDeletePlantTarget] = useState<Plant | null>(null);

  useEffect(() => {
    setForm({
      companyCode: editingCompany?.companyCode || "",
      companyName: editingCompany?.companyName || "",
      bizNo: editingCompany?.bizNo || "",
      ceoName: editingCompany?.ceoName || "",
      address: editingCompany?.address || "",
      tel: editingCompany?.tel || "",
      fax: editingCompany?.fax || "",
      email: editingCompany?.email || "",
      remark: editingCompany?.remark || "",
    });
    setNewPlant({ plantCode: "", plantName: "" });
    setAddingPlant(false);
  }, [editingCompany]);

  /** 사업장 목록 조회 */
  const fetchPlants = useCallback(async () => {
    if (!editingCompany?.companyCode) { setPlants([]); return; }
    try {
      const res = await api.get("/master/plants", {
        params: { plantType: "PLANT", search: "", limit: "100" },
      });
      // company 필드로 필터링
      const all: Plant[] = res.data?.data ?? [];
      setPlants(all.filter((p) => p.company === editingCompany.companyCode));
    } catch {
      setPlants([]);
    }
  }, [editingCompany?.companyCode]);

  useEffect(() => {
    if (isEdit) fetchPlants();
  }, [isEdit, fetchPlants]);

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.companyCode.trim() || !form.companyName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        bizNo: form.bizNo || undefined,
        ceoName: form.ceoName || undefined,
        address: form.address || undefined,
        tel: form.tel || undefined,
        fax: form.fax || undefined,
        email: form.email || undefined,
        remark: form.remark || undefined,
      };
      if (isEdit && editingCompany?.id) {
        await api.put(`/master/companies/${editingCompany.id}`, payload);
      } else {
        await api.post("/master/companies", payload);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  };

  /** 사업장 추가 */
  const handleAddPlant = async () => {
    if (!newPlant.plantCode.trim() || !newPlant.plantName.trim()) return;
    try {
      await api.post("/master/plants", {
        plantCode: newPlant.plantCode,
        plantName: newPlant.plantName,
        plantType: "PLANT",
        company: editingCompany?.companyCode,
      });
      setNewPlant({ plantCode: "", plantName: "" });
      setAddingPlant(false);
      fetchPlants();
    } catch {
      // 에러는 api 인터셉터에서 처리
    }
  };

  /** 사업장 삭제 확인 후 실행 */
  const handleDeletePlantConfirm = async () => {
    if (!deletePlantTarget) return;
    try {
      await api.delete(`/master/plants/${deletePlantTarget.id}`);
      fetchPlants();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeletePlantTarget(null);
    }
  };

  return (
    <div className={`w-[520px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.company.editCompany") : t("master.company.addCompany")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 기본정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.company.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.company.companyCode")} placeholder="COMP-001"
              value={form.companyCode} onChange={(e) => setField("companyCode", e.target.value)}
              disabled={isEdit} fullWidth />
            <Input label={t("master.company.companyName")}
              value={form.companyName} onChange={(e) => setField("companyName", e.target.value)} fullWidth />
            <Input label={t("master.company.bizNo")} placeholder="123-45-67890"
              value={form.bizNo} onChange={(e) => setField("bizNo", e.target.value)} fullWidth />
            <Input label={t("master.company.ceoName")}
              value={form.ceoName} onChange={(e) => setField("ceoName", e.target.value)} fullWidth />
          </div>
        </div>

        {/* 연락처 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.company.sectionContact", "연락처")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("master.company.address")}
                value={form.address} onChange={(e) => setField("address", e.target.value)} fullWidth />
            </div>
            <Input label={t("master.company.tel")} placeholder="+84-274-1234-567"
              value={form.tel} onChange={(e) => setField("tel", e.target.value)} fullWidth />
            <Input label={t("master.company.fax")} placeholder="02-1234-5679"
              value={form.fax} onChange={(e) => setField("fax", e.target.value)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.company.email")} placeholder="info@company.com"
                value={form.email} onChange={(e) => setField("email", e.target.value)} fullWidth />
            </div>
          </div>
        </div>

        {/* 비고 */}
        <div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
            value={form.remark} onChange={(e) => setField("remark", e.target.value)} fullWidth />
        </div>

        {/* 사업장 관리 (수정 모드에서만 표시) */}
        {isEdit && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-text-muted flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {t("master.company.plantSection", "사업장")}
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-medium">
                  {plants.length}
                </span>
              </h3>
              {!addingPlant && (
                <button
                  onClick={() => setAddingPlant(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />{t("master.company.addPlant", "사업장 추가")}
                </button>
              )}
            </div>

            {/* 사업장 추가 폼 */}
            {addingPlant && (
              <div className="flex items-end gap-2 mb-2 p-2.5 bg-surface rounded-lg border border-border">
                <Input label={t("master.company.plantCode", "사업장코드")} placeholder="P001"
                  value={newPlant.plantCode} onChange={(e) => setNewPlant((p) => ({ ...p, plantCode: e.target.value }))} fullWidth />
                <Input label={t("master.company.plantName", "사업장명")} placeholder={t("master.company.plantName", "사업장명")}
                  value={newPlant.plantName} onChange={(e) => setNewPlant((p) => ({ ...p, plantName: e.target.value }))} fullWidth />
                <Button size="sm" onClick={handleAddPlant}
                  disabled={!newPlant.plantCode.trim() || !newPlant.plantName.trim()}
                  className="shrink-0">{t("common.add")}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setAddingPlant(false); setNewPlant({ plantCode: "", plantName: "" }); }}
                  className="shrink-0">{t("common.cancel")}</Button>
              </div>
            )}

            {/* 사업장 목록 */}
            {plants.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface">
                    <tr>
                      <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t("master.company.plantCode", "사업장코드")}</th>
                      <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t("master.company.plantName", "사업장명")}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plants.map((plant) => (
                      <tr key={plant.id} className="border-t border-border hover:bg-surface/50">
                        <td className="px-3 py-1.5 font-mono font-medium text-text">{plant.plantCode}</td>
                        <td className="px-3 py-1.5 text-text">{plant.plantName}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button onClick={() => setDeletePlantTarget(plant)}
                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-text-muted bg-surface rounded-lg border border-dashed border-border">
                {t("master.company.noPlant", "등록된 사업장이 없습니다.")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.companyCode.trim() || !form.companyName.trim()}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>

      <ConfirmModal
        isOpen={!!deletePlantTarget}
        onClose={() => setDeletePlantTarget(null)}
        onConfirm={handleDeletePlantConfirm}
        variant="danger"
        message={t("master.company.deletePlantConfirm", {
          name: deletePlantTarget?.plantName || "",
          defaultValue: `사업장 '${deletePlantTarget?.plantName || ""}'을(를) 삭제하시겠습니까?`,
        })}
      />
    </div>
  );
}
