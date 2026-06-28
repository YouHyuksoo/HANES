"use client";

/**
 * @file components/EquipBomPanel.tsx
 * @description 설비별 BOM 품목 관리 우측 슬라이드 패널 — 특정 설비(equipCode)의 BOM 품목 목록·등록·수정·삭제.
 *
 * 참고:
 * - BOM 품목은 ITEM_MASTERS 등 다른 마스터와 연동이 없는 "설비 BOM 전용 자유 등록 부품"이다.
 * - 복합키 (equipCode, bomItemCode)가 PK. 요청 body에는 equipCode 포함.
 * - API:
 *   GET    /master/equip-bom/items?equipCode=XXX
 *   POST   /master/equip-bom/items
 *   PUT    /master/equip-bom/items/:equipCode/:bomItemCode
 *   DELETE /master/equip-bom/items/:equipCode/:bomItemCode
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, X, RefreshCw } from "lucide-react";
import { Button, Input, Select, Modal, ConfirmModal } from "@/components/ui";
import { EquipBomItem, BomItemType, BOM_ITEM_TYPE_COLORS } from "../types";
import api from "@/services/api";
import { QtyInput } from "@/components/shared";

interface ItemFormState {
  itemCode: string;
  itemName: string;
  itemType: BomItemType;
  spec: string;
  maker: string;
  unit: string;
  unitPrice: string;
  replacementCycle: string;
  stockQty: string;
  safetyStock: string;
  useYn: string;
}

const EMPTY_ITEM_FORM: ItemFormState = {
  itemCode: "",
  itemName: "",
  itemType: "PART",
  spec: "",
  maker: "",
  unit: "EA",
  unitPrice: "",
  replacementCycle: "",
  stockQty: "0",
  safetyStock: "0",
  useYn: "Y",
};

interface EquipBomPanelProps {
  equipCode: string;
  equipName: string;
  onClose: () => void;
}

export default function EquipBomPanel({ equipCode, equipName, onClose }: EquipBomPanelProps) {
  const { t } = useTranslation();

  const [bomItems, setBomItems] = useState<EquipBomItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipBomItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [deleteItemTarget, setDeleteItemTarget] = useState<EquipBomItem | null>(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: "", message: "" });

  const bomItemTypeLabels = useMemo<Record<BomItemType, string>>(() => ({
    PART: t("master.equip.bomItemTypePart", "부품"),
    CONSUMABLE: t("master.equip.bomItemTypeConsumable", "소모품"),
  }), [t]);

  // ===== 데이터 로드 (해당 설비 BOM 품목) =====
  const fetchBomItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/equip-bom/items", { params: { equipCode } });
      if (res.data.success) setBomItems(res.data.data || []);
    } catch (e) {
      console.error("Failed to fetch BOM items:", e);
    } finally {
      setLoading(false);
    }
  }, [equipCode]);

  useEffect(() => {
    fetchBomItems();
  }, [fetchBomItems]);

  // ===== 핸들러 =====
  const openItemCreate = useCallback(() => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setFormOpen(true);
  }, []);

  const openItemEdit = (item: EquipBomItem) => {
    setEditingItem(item);
    setItemForm({
      itemCode: item.bomItemCode,
      itemName: item.bomItemName,
      itemType: item.itemType,
      spec: item.spec || "",
      maker: item.maker || "",
      unit: item.unit,
      unitPrice: item.unitPrice?.toString() || "",
      replacementCycle: item.replacementCycle?.toString() || "",
      stockQty: item.stockQty.toString(),
      safetyStock: item.safetyStock.toString(),
      useYn: item.useYn,
    });
    setFormOpen(true);
  };

  const handleSaveItem = async () => {
    try {
      const body = {
        equipCode,
        bomItemCode: itemForm.itemCode,
        bomItemName: itemForm.itemName,
        itemType: itemForm.itemType,
        spec: itemForm.spec || undefined,
        maker: itemForm.maker || undefined,
        unit: itemForm.unit,
        unitPrice: itemForm.unitPrice ? parseFloat(itemForm.unitPrice) : undefined,
        replacementCycle: itemForm.replacementCycle ? parseInt(itemForm.replacementCycle) : undefined,
        stockQty: parseFloat(itemForm.stockQty) || 0,
        safetyStock: parseFloat(itemForm.safetyStock) || 0,
        useYn: itemForm.useYn,
      };

      if (editingItem) {
        await api.put(
          `/master/equip-bom/items/${encodeURIComponent(editingItem.equipCode)}/${encodeURIComponent(editingItem.bomItemCode)}`,
          body,
        );
      } else {
        await api.post("/master/equip-bom/items", body);
      }
      setFormOpen(false);
      fetchBomItems();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      console.error("Save item failed:", e);
      setAlertModal({ open: true, title: t("common.error"), message: err.response?.data?.message || t("common.saveFailed", "저장에 실패했습니다.") });
    }
  };

  const handleDeleteItemConfirm = async () => {
    if (!deleteItemTarget) return;
    try {
      await api.delete(
        `/master/equip-bom/items/${encodeURIComponent(deleteItemTarget.equipCode)}/${encodeURIComponent(deleteItemTarget.bomItemCode)}`,
      );
      fetchBomItems();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      console.error("Delete item failed:", e);
      setAlertModal({ open: true, title: t("common.error"), message: err.response?.data?.message || t("common.deleteFailed", "삭제에 실패했습니다.") });
    } finally {
      setDeleteItemTarget(null);
    }
  };

  // ===== 렌더 =====
  return (
    <div className="w-[480px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text truncate">
          {t("master.equip.bomPanelTitle", "{{name}} BOM", { name: equipName })}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="secondary" onClick={fetchBomItems}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={openItemCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t("common.add", "등록")}
          </Button>
          <button onClick={onClose} className="p-1.5 hover:bg-surface rounded" aria-label={t("common.close", "닫기")}>
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="text-text-muted border-b border-border">
              <th className="px-2 py-2 text-center w-16">{t("common.actions", "작업")}</th>
              <th className="px-2 py-2 text-left">{t("master.equip.itemType", "유형")}</th>
              <th className="px-2 py-2 text-left">{t("master.equip.itemCode", "품목코드")}</th>
              <th className="px-2 py-2 text-left">{t("master.equip.itemName", "품목명")}</th>
              <th className="px-2 py-2 text-right">{t("master.equip.stockQty", "재고")}</th>
            </tr>
          </thead>
          <tbody>
            {bomItems.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-text-muted">
                  {t("master.equip.noBomItems", "등록된 BOM 품목이 없습니다.")}
                </td>
              </tr>
            )}
            {bomItems.map((item) => {
              const isLow = item.stockQty <= item.safetyStock;
              return (
                <tr key={item.bomItemCode} className="border-b border-border hover:bg-surface/60">
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openItemEdit(item)} className="p-1 hover:bg-surface rounded">
                        <Edit2 className="w-3.5 h-3.5 text-primary" />
                      </button>
                      <button onClick={() => setDeleteItemTarget(item)} className="p-1 hover:bg-surface rounded">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`px-2 py-0.5 text-[10px] rounded-full ${BOM_ITEM_TYPE_COLORS[item.itemType]}`}>
                      {bomItemTypeLabels[item.itemType]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono">{item.bomItemCode}</td>
                  <td className="px-2 py-1.5">
                    <div className="leading-tight">
                      <div>{item.bomItemName}</div>
                      {(item.spec || item.maker) && (
                        <div className="text-[10px] text-text-muted">{[item.maker, item.spec].filter(Boolean).join(" / ")}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={`font-mono ${isLow ? "text-red-500 font-bold" : ""}`}>
                      {(item.stockQty ?? 0).toLocaleString()} {item.unit}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 등록/수정 폼 모달 */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingItem ? t("master.equip.editBomItem", "BOM 품목 수정") : t("master.equip.addBomItem", "BOM 품목 등록")}
        size="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionBasic", "기본정보")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.equip.itemCode", "품목코드")} value={itemForm.itemCode} onChange={(e) => setItemForm({ ...itemForm, itemCode: e.target.value })} fullWidth disabled={!!editingItem} />
              <Input label={t("master.equip.itemName", "품목명")} value={itemForm.itemName} onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })} fullWidth />
              <Select label={t("master.equip.itemType", "유형")} options={[{ value: "PART", label: bomItemTypeLabels.PART }, { value: "CONSUMABLE", label: bomItemTypeLabels.CONSUMABLE }]} value={itemForm.itemType} onChange={(v) => setItemForm({ ...itemForm, itemType: v as BomItemType })} fullWidth />
              <Input label={t("master.equip.unit", "단위")} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} fullWidth />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionSpec", "규격 / 구매정보")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.equip.maker", "제조사")} value={itemForm.maker} onChange={(e) => setItemForm({ ...itemForm, maker: e.target.value })} fullWidth />
              <Input label={t("master.equip.spec", "규격")} value={itemForm.spec} onChange={(e) => setItemForm({ ...itemForm, spec: e.target.value })} fullWidth />
              <Input label={t("master.equip.unitPrice", "단가")} type="number" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} fullWidth />
              <Input label={t("master.equip.replacementCycle", "교체주기(일)")} type="number" value={itemForm.replacementCycle} onChange={(e) => setItemForm({ ...itemForm, replacementCycle: e.target.value })} fullWidth />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionStock", "재고")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <QtyInput label={t("master.equip.stockQty", "현재재고")} value={Number(itemForm.stockQty) || 0} onChange={(n) => setItemForm({ ...itemForm, stockQty: n ? String(n) : "" })} fullWidth />
              <QtyInput label={t("master.equip.safetyStock", "안전재고")} value={Number(itemForm.safetyStock) || 0} onChange={(n) => setItemForm({ ...itemForm, safetyStock: n ? String(n) : "" })} fullWidth />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{t("common.cancel", "취소")}</Button>
            <Button onClick={handleSaveItem} disabled={!itemForm.itemCode.trim() || !itemForm.itemName.trim()}>
              {editingItem ? t("common.edit", "수정") : t("common.add", "등록")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleDeleteItemConfirm}
        variant="danger"
        message={t("common.deleteConfirmMessage", "{{name}} 을(를) 삭제하시겠습니까?", { name: `'${deleteItemTarget?.bomItemName || ""}'` })}
      />

      {/* 알림 모달 */}
      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setAlertModal({ ...alertModal, open: false })}>{t("common.confirm")}</Button>
        </div>
      </Modal>
    </div>
  );
}
