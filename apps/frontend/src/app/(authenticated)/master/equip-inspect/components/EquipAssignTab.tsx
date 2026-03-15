"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx
 * @description 설비별 점검항목 할당 탭 - 좌측 설비 + 우측 점검항목 (DB 연동)
 *
 * 초보자 가이드:
 * 1. 좌측: 설비 목록 (GET /equipment/equips)
 * 2. 우측: 선택 설비의 점검항목 (GET /master/equip-inspect-items?equipCode=XXX)
 * 3. 항목 추가/삭제는 API를 통해 DB에 직접 반영
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Wrench, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardContent, Input } from "@/components/ui";
import InspectItemPanel from "./InspectItemPanel";
import AddInspectItemModal from "./AddInspectItemModal";
import api from "@/services/api";
import { EquipSummary, InspectItemRow, EQUIP_TYPE_COLORS } from "../types";

export default function EquipAssignTab() {
  const { t } = useTranslation();
  const [equips, setEquips] = useState<EquipSummary[]>([]);
  const [selectedEquip, setSelectedEquip] = useState<EquipSummary | null>(null);
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<InspectItemRow[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  /* ── 설비 목록 로드 ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/equipment/equips", { params: { limit: "500" } });
        const list: EquipSummary[] = (res.data?.data ?? []).map((e: Record<string, unknown>) => ({
          equipCode: e.equipCode, equipName: e.equipName,
          equipType: e.equipType || "", lineCode: e.lineCode || null,
        }));
        setEquips(list);
        if (list.length > 0 && !selectedEquip) setSelectedEquip(list[0]);
      } catch { setEquips([]); }
    })();
  }, []);

  /* ── 선택 설비의 점검항목 로드 ── */
  const fetchItems = useCallback(async () => {
    if (!selectedEquip) { setItems([]); return; }
    setItemLoading(true);
    try {
      const res = await api.get("/master/equip-inspect-items", {
        params: { equipCode: selectedEquip.equipCode, limit: "500" },
      });
      setItems(res.data?.data ?? []);
    } catch { setItems([]); }
    finally { setItemLoading(false); }
  }, [selectedEquip]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* ── 항목 삭제 ── */
  const handleDelete = useCallback(async (equipCode: string, inspectType: string, seq: number) => {
    try {
      await api.delete(`/master/equip-inspect-items/${equipCode}/${inspectType}/${seq}`);
      fetchItems();
    } catch { /* 에러 처리 */ }
  }, [fetchItems]);

  /* ── 항목 추가 완료 ── */
  const handleAdded = useCallback(() => {
    setAddModalOpen(false);
    fetchItems();
  }, [fetchItems]);

  /* ── 설비별 항목 수 (간단 카운트) ── */
  const filteredEquips = equips.filter(e => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return e.equipCode.toLowerCase().includes(s) || e.equipName.toLowerCase().includes(s);
  });

  return (
    <div className="grid grid-cols-12 gap-6 h-full min-h-0">
      {/* 좌측: 설비 목록 */}
      <div className="col-span-4 flex flex-col min-h-0">
        <Card padding="none" className="flex-1 flex flex-col min-h-0">
          <CardHeader
            title={t("master.equipInspect.equipList", "설비 목록")}
            subtitle={t("master.equipInspect.selectEquip", "점검 설비 선택")}
            className="px-4 pt-4"
          />
          <CardContent className="flex-1 flex flex-col min-h-0 px-4 pb-4">
            <Input
              placeholder={t("master.equipInspect.searchPlaceholder")}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
              className="mb-3 shrink-0"
            />
            <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
              {filteredEquips.map(equip => (
                <button
                  key={equip.equipCode}
                  onClick={() => setSelectedEquip(equip)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                    selectedEquip?.equipCode === equip.equipCode ? "bg-primary text-white" : "hover:bg-surface text-text"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="w-4 h-4 shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="font-medium">{equip.equipCode}</div>
                      <div className={`text-xs truncate ${selectedEquip?.equipCode === equip.equipCode ? "text-white/70" : "text-text-muted"}`}>
                        {equip.equipName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {equip.equipType && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded ${
                        selectedEquip?.equipCode === equip.equipCode ? "bg-white/20 text-white" : EQUIP_TYPE_COLORS[equip.equipType] || "bg-surface text-text-muted"
                      }`}>
                        {equip.equipType}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
              {filteredEquips.length === 0 && (
                <div className="py-8 text-center text-sm text-text-muted">{t("common.noData", "데이터 없음")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 선택된 설비의 점검항목 */}
      <div className="col-span-8">
        <InspectItemPanel
          equip={selectedEquip}
          items={items}
          loading={itemLoading}
          onDelete={handleDelete}
          onOpenAddModal={() => setAddModalOpen(true)}
          onRefresh={fetchItems}
        />
      </div>

      {/* 점검항목 추가 모달 */}
      {selectedEquip && (
        <AddInspectItemModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          equipCode={selectedEquip.equipCode}
          equipName={selectedEquip.equipName}
          currentMaxSeq={items.reduce((max, i) => Math.max(max, i.seq), 0)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
