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
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardContent, Input } from "@/components/ui";
import InspectItemPanel from "./InspectItemPanel";
import InspectItemSelectPanel from "./InspectItemSelectPanel";
import api from "@/services/api";
import { EquipSummary, InspectItemRow } from "../types";

export default function EquipAssignTab() {
  const { t } = useTranslation();
  const [equips, setEquips] = useState<EquipSummary[]>([]);
  const [selectedEquip, setSelectedEquip] = useState<EquipSummary | null>(null);
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<InspectItemRow[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"DAILY" | "PERIODIC" | "PM" | "WORKER">("DAILY");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const INSPECT_TABS = useMemo(() => [
    { key: "DAILY" as const,    label: t("master.equipInspect.typeDaily") },
    { key: "PERIODIC" as const, label: t("master.equipInspect.typePeriodic") },
    { key: "PM" as const,       label: t("master.equipInspect.typePM", "예방보전") },
    { key: "WORKER" as const,   label: t("master.equipInspect.typeWorker", "작업자점검") },
  ], [t]);

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
  const handleDelete = useCallback(async (equipCode: string, itemCode: string, inspectType: string) => {
    try {
      await api.delete(`/master/equip-inspect-items/${equipCode}/${itemCode}/${inspectType}`);
      fetchItems();
    } catch { /* 에러 처리 */ }
  }, [fetchItems]);

  /* ── 항목 추가 완료 ── */
  const handleAdded = useCallback(() => {
    setAddModalOpen(false);
    fetchItems();
  }, [fetchItems]);

  /* ── 설비유형별 그룹화 ── */
  const groupedEquips = useMemo(() => {
    const filtered = searchText
      ? equips.filter(e => {
          const s = searchText.toLowerCase();
          return e.equipCode.toLowerCase().includes(s) || e.equipName.toLowerCase().includes(s);
        })
      : equips;

    const groups: Record<string, EquipSummary[]> = {};
    for (const equip of filtered) {
      const key = equip.equipType || t("master.equipInspect.equipTypeEtc", "기타");
      if (!groups[key]) groups[key] = [];
      groups[key].push(equip);
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [equips, searchText, t]);

  /* ── 검색 시 모든 그룹 확장 ── */
  useEffect(() => {
    if (searchText) {
      setExpandedGroups(new Set(groupedEquips.map(([key]) => key)));
    }
  }, [searchText, groupedEquips]);

  /* ── 그룹 토글 ── */
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  /* ── 초기 전체 확장 ── */
  useEffect(() => {
    if (groupedEquips.length > 0 && expandedGroups.size === 0 && !searchText) {
      setExpandedGroups(new Set(groupedEquips.map(([key]) => key)));
    }
  }, [groupedEquips]);

  const filteredItems = useMemo(
    () => items.filter(item => item.inspectType === activeTab),
    [items, activeTab],
  );

  const registeredItemCodes = useMemo(
    () => filteredItems.map(i => i.itemCode).filter((c): c is string => !!c),
    [filteredItems],
  );

  return (
    <div className="grid grid-cols-12 gap-6 h-full min-h-0">
      {/* 좌측: 설비 목록 */}
      <div className="col-span-4 flex flex-col min-h-0">
        <Card padding="none" className="flex-1 flex flex-col min-h-0">
          <CardHeader
            title={t("master.equipInspect.equipList", "설비 목록")}
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
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
              {groupedEquips.map(([groupKey, equipList]) => (
                <div key={groupKey}>
                  {/* 그룹 헤더 */}
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs font-semibold text-text-muted uppercase tracking-wide hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedGroups.has(groupKey) ? "rotate-90" : ""}`} />
                      <span>{groupKey}</span>
                    </div>
                    <span className="text-xs font-normal text-text-muted">{equipList.length}</span>
                  </button>

                  {/* 설비 그리드 */}
                  {expandedGroups.has(groupKey) && (
                    <div className="mt-1 grid grid-cols-2 gap-1.5">
                      {equipList.map(equip => {
                        const isSelected = selectedEquip?.equipCode === equip.equipCode;
                        return (
                          <button
                            key={equip.equipCode}
                            onClick={() => setSelectedEquip(equip)}
                            className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40 hover:bg-surface text-text"
                            }`}
                          >
                            <span className={`font-mono text-[11px] font-semibold leading-none ${isSelected ? "text-primary" : "text-text-muted"}`}>
                              {equip.equipCode}
                            </span>
                            <span className={`text-xs font-medium leading-snug line-clamp-2 ${isSelected ? "text-primary" : "text-text"}`}>
                              {equip.equipName}
                            </span>
                            {(equip.equipType || equip.lineCode) && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {equip.equipType && (
                                  <span className={`text-[10px] px-1 py-0.5 rounded ${isSelected ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                    {equip.equipType}
                                  </span>
                                )}
                                {equip.lineCode && (
                                  <span className={`text-[10px] px-1 py-0.5 rounded ${isSelected ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                    {equip.lineCode}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {groupedEquips.length === 0 && (
                <div className="py-8 text-center text-sm text-text-muted">{t("common.noData", "데이터 없음")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 탭 + 점검항목 */}
      <div className="col-span-8 flex flex-col min-h-0">
        {/* 탭 헤더 */}
        <div className="flex border-b border-border flex-shrink-0">
          {INSPECT_TABS.map(tab => {
            const count = items.filter(i => i.inspectType === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-surface text-text-muted"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 점검항목 패널 */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col pt-4">
          <InspectItemPanel
            equip={selectedEquip}
            items={filteredItems}
            loading={itemLoading}
            onDelete={handleDelete}
            onOpenAddModal={() => setAddModalOpen(true)}
            onRefresh={fetchItems}
          />
        </div>
      </div>

      {/* 점검항목 일괄선택 패널 */}
      {selectedEquip && (
        <InspectItemSelectPanel
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          equipCode={selectedEquip.equipCode}
          equipName={selectedEquip.equipName}
          inspectType={activeTab}
          registeredItemCodes={registeredItemCodes}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
