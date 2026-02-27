"use client";

/**
 * @file components/EquipBomTab.tsx
 * @description 설비 BOM 관리 탭 — 설비별 부품/소모품 관리
 *
 * 초보자 가이드:
 * 1. 설비 선택 → 해당 설비의 BOM 목록 표시
 * 2. BOM 품목 등록/수정/삭제 (부품/소모품 구분)
 * 3. 설비에 BOM 품목 연결/해제
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Edit2, Trash2, Search, RefreshCw, Link2, Unlink,
  Package, Droplets, Wrench, ChevronRight, Layers,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import {
  EquipMaster, EquipBomItem, EquipBomRel,
  BomItemType, BOM_ITEM_TYPE_COLORS, BOM_ITEM_TYPE_LABELS,
  seedEquipBomItems, seedEquipBomRels, seedEquipments,
} from "../types";
import api from "@/services/api";

// ========================================
// 타입 정의
// ========================================

type ViewMode = "by-equip" | "by-item";
type ItemFormMode = "item" | "rel" | null;

interface ItemFormState {
  id?: string;
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

interface RelFormState {
  id?: string;
  equipId: string;
  bomItemId: string;
  quantity: string;
  installDate: string;
  expireDate: string;
  remark: string;
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

const EMPTY_REL_FORM: RelFormState = {
  equipId: "",
  bomItemId: "",
  quantity: "1",
  installDate: "",
  expireDate: "",
  remark: "",
};

// ========================================
// 메인 컴포넌트
// ========================================

export default function EquipBomTab() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("by-equip");
  
  // 데이터 상태
  const [equipments, setEquipments] = useState<EquipMaster[]>(seedEquipments);
  const [bomItems, setBomItems] = useState<EquipBomItem[]>(seedEquipBomItems);
  const [bomRels, setBomRels] = useState<EquipBomRel[]>(seedEquipBomRels);
  const [loading, setLoading] = useState(false);
  
  // 선택 상태
  const [selectedEquipId, setSelectedEquipId] = useState<string>("");
  const [selectedItemType, setSelectedItemType] = useState<string>("");
  
  // 검색/필터
  const [itemSearch, setItemSearch] = useState("");
  const [equipSearch, setEquipSearch] = useState("");
  
  // 모달 상태
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [relModalOpen, setRelModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipBomItem | null>(null);
  const [editingRel, setEditingRel] = useState<EquipBomRel | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [relForm, setRelForm] = useState<RelFormState>(EMPTY_REL_FORM);

  // 삭제 확인 상태
  const [deleteItemTarget, setDeleteItemTarget] = useState<EquipBomItem | null>(null);
  const [deleteRelTarget, setDeleteRelTarget] = useState<EquipBomRel | null>(null);

  // 알림 모달 상태
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });

  // ========================================
  // 데이터 로드
  // ========================================

  const fetchEquipments = useCallback(async () => {
    try {
      const res = await api.get("/equipment/equips", { params: { limit: "100", useYn: "Y", company: "40" } });
      if (res.data.success) {
        setEquipments(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch equipments:", e);
    }
  }, []);

  const fetchBomItems = useCallback(async () => {
    try {
      const res = await api.get("/master/equip-bom/items", { params: { limit: "100", company: "40" } });
      if (res.data.success) {
        setBomItems(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch BOM items:", e);
    }
  }, []);

  const fetchBomRels = useCallback(async () => {
    if (!selectedEquipId) return;
    setLoading(true);
    try {
      const res = await api.get(`/master/equip-bom/equip/${selectedEquipId}`);
      if (res.data.success) {
        setBomRels(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch BOM relations:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedEquipId]);

  useEffect(() => {
    fetchEquipments();
    fetchBomItems();
  }, [fetchEquipments, fetchBomItems]);

  useEffect(() => {
    if (selectedEquipId) {
      fetchBomRels();
    }
  }, [selectedEquipId, fetchBomRels]);

  // ========================================
  // 계산된 값
  // ========================================

  const filteredEquipments = useMemo(() => {
    if (!equipSearch) return equipments;
    const s = equipSearch.toLowerCase();
    return equipments.filter(e => 
      e.equipCode.toLowerCase().includes(s) || 
      e.equipName.toLowerCase().includes(s)
    );
  }, [equipments, equipSearch]);

  const filteredBomItems = useMemo(() => {
    let items = bomItems;
    if (selectedItemType) {
      items = items.filter(i => i.itemType === selectedItemType);
    }
    if (itemSearch) {
      const s = itemSearch.toLowerCase();
      items = items.filter(i => 
        i.itemCode.toLowerCase().includes(s) || 
        i.itemName.toLowerCase().includes(s)
      );
    }
    return items;
  }, [bomItems, selectedItemType, itemSearch]);

  const selectedEquip = useMemo(() => 
    equipments.find(e => e.id === selectedEquipId),
    [equipments, selectedEquipId]
  );

  const selectedEquipBomRels = useMemo(() => {
    if (!selectedEquipId) return [];
    return bomRels.filter(r => r.equipId === selectedEquipId && r.useYn === "Y");
  }, [bomRels, selectedEquipId]);

  const itemTypeOptions = useMemo(() => [
    { value: "", label: t("master.equip.itemType", "품목유형") },
    { value: "PART", label: BOM_ITEM_TYPE_LABELS.PART },
    { value: "CONSUMABLE", label: BOM_ITEM_TYPE_LABELS.CONSUMABLE },
  ], [t]);

  // ========================================
  // 핸들러 - BOM 품목
  // ========================================

  const openItemCreate = () => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setItemModalOpen(true);
  };

  const openItemEdit = (item: EquipBomItem) => {
    setEditingItem(item);
    setItemForm({
      id: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
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
    setItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    try {
      const body = {
        itemCode: itemForm.itemCode,
        itemName: itemForm.itemName,
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
        await api.put(`/master/equip-bom/items/${editingItem.id}`, body);
      } else {
        await api.post("/master/equip-bom/items", body);
      }
      setItemModalOpen(false);
      fetchBomItems();
    } catch (e: any) {
      console.error("Save item failed:", e);
      setAlertModal({ open: true, title: t("common.error"), message: e.response?.data?.message || t("common.saveFailed", "저장에 실패했습니다.") });
    }
  };

  const handleDeleteItemConfirm = async () => {
    if (!deleteItemTarget) return;
    try {
      await api.delete(`/master/equip-bom/items/${deleteItemTarget.id}`);
      fetchBomItems();
    } catch (e: any) {
      console.error("Delete item failed:", e);
    } finally {
      setDeleteItemTarget(null);
    }
  };

  // ========================================
  // 핸들러 - 설비-BOM 연결
  // ========================================

  const openRelCreate = () => {
    if (!selectedEquipId) {
      setAlertModal({ open: true, title: t("common.confirm"), message: t("master.equip.selectEquipFirst", "설비를 먼저 선택해주세요.") });
      return;
    }
    setEditingRel(null);
    setRelForm({
      ...EMPTY_REL_FORM,
      equipId: selectedEquipId,
    });
    setRelModalOpen(true);
  };

  const openRelEdit = (rel: EquipBomRel) => {
    setEditingRel(rel);
    setRelForm({
      id: rel.id,
      equipId: rel.equipId,
      bomItemId: rel.bomItemId,
      quantity: rel.quantity.toString(),
      installDate: rel.installDate?.split("T")[0] || "",
      expireDate: rel.expireDate?.split("T")[0] || "",
      remark: rel.remark || "",
    });
    setRelModalOpen(true);
  };

  const handleSaveRel = async () => {
    try {
      const body = {
        equipId: relForm.equipId,
        bomItemId: relForm.bomItemId,
        quantity: parseFloat(relForm.quantity) || 1,
        installDate: relForm.installDate || undefined,
        expireDate: relForm.expireDate || undefined,
        remark: relForm.remark || undefined,
      };

      if (editingRel) {
        await api.put(`/master/equip-bom/rels/${editingRel.id}`, body);
      } else {
        await api.post("/master/equip-bom/rels", body);
      }
      setRelModalOpen(false);
      fetchBomRels();
    } catch (e: any) {
      console.error("Save relation failed:", e);
      setAlertModal({ open: true, title: t("common.error"), message: e.response?.data?.message || t("common.saveFailed", "저장에 실패했습니다.") });
    }
  };

  const handleDeleteRelConfirm = async () => {
    if (!deleteRelTarget) return;
    try {
      await api.delete(`/master/equip-bom/rels/${deleteRelTarget.id}`);
      fetchBomRels();
    } catch (e: any) {
      console.error("Delete relation failed:", e);
    } finally {
      setDeleteRelTarget(null);
    }
  };

  // ========================================
  // 컬럼 정의
  // ========================================

  const bomItemColumns = useMemo<ColumnDef<EquipBomItem>[]>(() => [
    {
      id: "actions", header: t("common.actions", "작업"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openItemEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteItemTarget(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "itemType", header: t("master.equip.itemType", "유형"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as BomItemType;
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${BOM_ITEM_TYPE_COLORS[v]}`}>
            {BOM_ITEM_TYPE_LABELS[v]}
          </span>
        );
      },
    },
    { accessorKey: "itemCode", header: t("master.equip.itemCode", "품목코드"), size: 100 },
    { accessorKey: "itemName", header: t("master.equip.itemName", "품목명"), size: 150 },
    { accessorKey: "spec", header: t("master.equip.spec", "규격"), size: 120 },
    { accessorKey: "maker", header: t("master.equip.maker", "제조사"), size: 100 },
    { accessorKey: "unit", header: t("common.unit", "단위"), size: 60 },
    {
      accessorKey: "unitPrice", header: t("master.equip.unitPrice", "단가"), size: 100,
      cell: ({ getValue }) => getValue() ? `₩${(getValue() as number).toLocaleString()}` : "-",
    },
    {
      accessorKey: "stockQty", header: t("master.equip.stockQty", "재고"), size: 80,
      cell: ({ row }) => {
        const item = row.original;
        const isLow = item.stockQty <= item.safetyStock;
        return (
          <span className={`font-mono text-xs ${isLow ? "text-red-500 font-bold" : ""}`}>
            {item.stockQty}
          </span>
        );
      },
    },
  ], [t]);

  const bomRelColumns = useMemo<ColumnDef<EquipBomRel>[]>(() => [
    {
      id: "actions", header: t("common.actions", "작업"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openRelEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteRelTarget(row.original)} className="p-1 hover:bg-surface rounded">
            <Unlink className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "bomItem.itemType", header: t("master.equip.itemType", "유형"), size: 80,
      cell: ({ row }) => {
        const v = row.original.bomItem?.itemType as BomItemType;
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${BOM_ITEM_TYPE_COLORS[v]}`}>
            {BOM_ITEM_TYPE_LABELS[v]}
          </span>
        );
      },
    },
    { accessorKey: "bomItem.itemCode", header: t("master.equip.itemCode", "품목코드"), size: 100 },
    { accessorKey: "bomItem.itemName", header: t("master.equip.itemName", "품목명"), size: 150 },
    { accessorKey: "bomItem.spec", header: t("master.equip.spec", "규격"), size: 100 },
    {
      accessorKey: "quantity", header: t("master.equip.quantity", "수량"), size: 60,
      cell: ({ getValue }) => <span className="font-mono">{getValue() as number}</span>,
    },
    {
      accessorKey: "installDate", header: t("master.equip.installDate", "설치일"), size: 100,
      cell: ({ getValue }) => getValue() ? (getValue() as string).split("T")[0] : "-",
    },
    {
      accessorKey: "expireDate", header: t("master.equip.expireDate", "유효기한"), size: 100,
      cell: ({ getValue }) => {
        const date = getValue() as string;
        if (!date) return "-";
        const isExpired = new Date(date) < new Date();
        return <span className={isExpired ? "text-red-500" : ""}>{date.split("T")[0]}</span>;
      },
    },
    { accessorKey: "remark", header: t("common.remark", "비고"), size: 120 },
  ], [t]);

  // ========================================
  // 렌더링
  // ========================================

  return (
    <div className="space-y-4">
      {/* 뷰 모드 선택 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setViewMode("by-equip")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === "by-equip"
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}
          >
            <Link2 className="w-4 h-4" />
            {t("master.equip.viewByEquip", "설비별 조회")}
          </button>
          <button
            onClick={() => setViewMode("by-item")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === "by-item"
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}
          >
            <Package className="w-4 h-4" />
            {t("master.equip.viewByItem", "품목별 조회")}
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchBomItems}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t("common.refresh", "새로고침")}
          </Button>
          <Button size="sm" onClick={openItemCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t("master.equip.addBomItem", "BOM 품목 등록")}
          </Button>
        </div>
      </div>

      {viewMode === "by-equip" ? (
        <div className="grid grid-cols-12 gap-4">
          {/* 설비 목록 */}
          <div className="col-span-4">
            <Card className="h-[600px] flex flex-col">
              <CardContent className="flex-1 flex flex-col p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  {t("master.equip.equipList", "설비 목록")}
                </h3>
                <Input
                  placeholder={t("master.equip.searchEquip", "설비 검색...")}
                  value={equipSearch}
                  onChange={(e) => setEquipSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="mb-3"
                  fullWidth
                />
                <div className="flex-1 overflow-auto space-y-1">
                  {filteredEquipments.map((equip) => (
                    <button
                      key={equip.id}
                      onClick={() => setSelectedEquipId(equip.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedEquipId === equip.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{equip.equipName}</div>
                          <div className="text-xs text-text-muted">{equip.equipCode}</div>
                        </div>
                        <ChevronRight className={`w-4 h-4 ${selectedEquipId === equip.id ? "text-primary" : "text-text-muted"}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* BOM 목록 */}
          <div className="col-span-8">
            <Card className="h-[600px] flex flex-col">
              <CardContent className="flex-1 flex flex-col p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    {selectedEquip
                      ? `${selectedEquip.equipName} ${t("master.equip.bomList", "BOM 목록")}`
                      : t("master.equip.selectEquip", "설비를 선택하세요")
                    }
                  </h3>
                  {selectedEquipId && (
                    <Button size="sm" onClick={openRelCreate}>
                      <Link2 className="w-4 h-4 mr-1" />
                      {t("master.equip.linkBomItem", "품목 연결")}
                    </Button>
                  )}
                </div>
                {selectedEquipId ? (
                  <div className="flex-1 overflow-auto">
                    <DataGrid
                      data={selectedEquipBomRels}
                      columns={bomRelColumns}
                      pageSize={10}
                      isLoading={loading}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-text-muted">
                    {t("master.equip.selectEquipHint", "왼쪽에서 설비를 선택하여 BOM을 조회하세요.")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* 품목별 조회 */
        <Card>
          <CardContent className="p-4">
            <DataGrid
              data={filteredBomItems}
              columns={bomItemColumns}
              enableExport
              exportFileName={t("master.equip.bomItems", "설비BOM품목")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("master.equip.searchBomItem", "품목코드/품목명 검색...")}
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select
                      options={itemTypeOptions}
                      value={selectedItemType}
                      onChange={setSelectedItemType}
                      fullWidth
                    />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* BOM 품목 모달 */}
      <Modal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingItem ? t("master.equip.editBomItem", "BOM 품목 수정") : t("master.equip.addBomItem", "BOM 품목 등록")}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("master.equip.itemCode", "품목코드")}
              value={itemForm.itemCode}
              onChange={(e) => setItemForm({ ...itemForm, itemCode: e.target.value })}
              placeholder="PART-001"
              fullWidth
              disabled={!!editingItem}
            />
            <Input
              label={t("master.equip.itemName", "품목명")}
              value={itemForm.itemName}
              onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
              placeholder={t("master.equip.itemName", "품목명")}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label={t("master.equip.itemType", "유형")}
              options={[
                { value: "PART", label: BOM_ITEM_TYPE_LABELS.PART },
                { value: "CONSUMABLE", label: BOM_ITEM_TYPE_LABELS.CONSUMABLE },
              ]}
              value={itemForm.itemType}
              onChange={(v) => setItemForm({ ...itemForm, itemType: v as BomItemType })}
              fullWidth
            />
            <Input
              label={t("master.equip.unit", "단위")}
              value={itemForm.unit}
              onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
              placeholder="EA"
              fullWidth
            />
            <Input
              label={t("master.equip.maker", "제조사")}
              value={itemForm.maker}
              onChange={(e) => setItemForm({ ...itemForm, maker: e.target.value })}
              placeholder={t("master.equip.maker", "제조사")}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("master.equip.spec", "규격")}
              value={itemForm.spec}
              onChange={(e) => setItemForm({ ...itemForm, spec: e.target.value })}
              placeholder={t("master.equip.spec", "규격")}
              fullWidth
            />
            <Input
              label={t("master.equip.unitPrice", "단가")}
              type="number"
              value={itemForm.unitPrice}
              onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
              placeholder="150000"
              fullWidth
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label={t("master.equip.replacementCycle", "교체주기(일)")}
              type="number"
              value={itemForm.replacementCycle}
              onChange={(e) => setItemForm({ ...itemForm, replacementCycle: e.target.value })}
              placeholder="90"
              fullWidth
            />
            <Input
              label={t("master.equip.stockQty", "현재재고")}
              type="number"
              value={itemForm.stockQty}
              onChange={(e) => setItemForm({ ...itemForm, stockQty: e.target.value })}
              placeholder="0"
              fullWidth
            />
            <Input
              label={t("master.equip.safetyStock", "안전재고")}
              type="number"
              value={itemForm.safetyStock}
              onChange={(e) => setItemForm({ ...itemForm, safetyStock: e.target.value })}
              placeholder="0"
              fullWidth
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setItemModalOpen(false)}>
              {t("common.cancel", "취소")}
            </Button>
            <Button onClick={handleSaveItem}>
              {editingItem ? t("common.edit", "수정") : t("common.add", "등록")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 연결 모달 */}
      <Modal
        isOpen={relModalOpen}
        onClose={() => setRelModalOpen(false)}
        title={editingRel ? t("master.equip.editBomLink", "BOM 연결 수정") : t("master.equip.addBomLink", "BOM 연결 추가")}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("master.equip.bomItem", "BOM 품목")}
              options={bomItems
                .filter(i => i.useYn === "Y")
                .map(i => ({ value: i.id, label: `${i.itemCode} - ${i.itemName}` }))}
              value={relForm.bomItemId}
              onChange={(v) => setRelForm({ ...relForm, bomItemId: v })}
              fullWidth
              disabled={!!editingRel}
            />
            <Input
              label={t("master.equip.quantity", "수량")}
              type="number"
              value={relForm.quantity}
              onChange={(e) => setRelForm({ ...relForm, quantity: e.target.value })}
              placeholder="1"
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("master.equip.installDate", "설치일")}
              type="date"
              value={relForm.installDate}
              onChange={(e) => setRelForm({ ...relForm, installDate: e.target.value })}
              fullWidth
            />
            <Input
              label={t("master.equip.expireDate", "유효기한")}
              type="date"
              value={relForm.expireDate}
              onChange={(e) => setRelForm({ ...relForm, expireDate: e.target.value })}
              fullWidth
            />
          </div>
          <Input
            label={t("common.remark", "비고")}
            value={relForm.remark}
            onChange={(e) => setRelForm({ ...relForm, remark: e.target.value })}
            placeholder={t("common.remark", "비고")}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setRelModalOpen(false)}>
              {t("common.cancel", "취소")}
            </Button>
            <Button onClick={handleSaveRel}>
              {editingRel ? t("common.edit", "수정") : t("common.add", "등록")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 - BOM 품목 */}
      <ConfirmModal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleDeleteItemConfirm}
        variant="danger"
        message={`'${deleteItemTarget?.itemName || ""}'을(를) 삭제하시겠습니까?`}
      />

      {/* 삭제 확인 모달 - 설비-BOM 연결 */}
      <ConfirmModal
        isOpen={!!deleteRelTarget}
        onClose={() => setDeleteRelTarget(null)}
        onConfirm={handleDeleteRelConfirm}
        variant="danger"
        message={`'${deleteRelTarget?.bomItem?.itemName || ""}' 연결을 삭제하시겠습니까?`}
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
