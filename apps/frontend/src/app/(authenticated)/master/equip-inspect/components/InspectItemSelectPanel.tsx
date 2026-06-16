"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect, InspectItemImage } from "@/components/shared";
import api from "@/services/api";
import { InspectItemMasterRow, ITEM_TYPE_COLORS } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER";
  registeredItemCodes: string[];
  onAdded: () => void;
}

export default function InspectItemSelectPanel({
  isOpen, onClose, equipCode, equipName, inspectType, registeredItemCodes, onAdded,
}: Props) {
  const { t } = useTranslation();
  const [masterItems, setMasterItems] = useState<InspectItemMasterRow[]>([]);
  const [selectedEquipType, setSelectedEquipType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const inspectTypeLabel = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"),
    PERIODIC: t("master.equipInspect.typePeriodic"),
    PM: t("master.equipInspect.typePM", "예방보전"),
    WORKER: t("master.equipInspect.typeWorker", "작업자점검"),
  }), [t]);

  const itemTypeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.equipInspect.itemTypeVisual", "판정형"),
    MEASURE: t("master.equipInspect.itemTypeMeasure", "측정형"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
    QUARTERLY: t("master.equipInspect.cycleQuarterly", "분기"),
    SEMI_ANNUAL: t("master.equipInspect.cycleSemiAnnual", "반기"),
    ANNUAL: t("master.equipInspect.cycleAnnual", "연간"),
  }), [t]);

  useEffect(() => {
    if (!isOpen) {
      setCheckedCodes(new Set());
      setSearchText("");
      setSelectedEquipType("");
      return;
    }
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setCheckedCodes(new Set());
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

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return masterItems;
    const s = searchText.toLowerCase();
    return masterItems.filter(
      item => item.itemCode.toLowerCase().includes(s) || item.itemName.toLowerCase().includes(s),
    );
  }, [masterItems, searchText]);

  const registeredSet = useMemo(() => new Set(registeredItemCodes), [registeredItemCodes]);

  const toggleCheck = useCallback((itemCode: string) => {
    setCheckedCodes(prev => {
      const next = new Set(prev);
      if (next.has(itemCode)) next.delete(itemCode);
      else next.add(itemCode);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const selectables = filteredItems.filter(i => !registeredSet.has(i.itemCode)).map(i => i.itemCode);
    setCheckedCodes(prev => {
      const allChecked = selectables.every(c => prev.has(c));
      const next = new Set(prev);
      if (allChecked) selectables.forEach(c => next.delete(c));
      else selectables.forEach(c => next.add(c));
      return next;
    });
  }, [filteredItems, registeredSet]);

  const handleSave = async () => {
    if (checkedCodes.size === 0) return;
    setSaving(true);
    try {
      for (const itemCode of checkedCodes) {
        await api.post("/master/equip-inspect-items", {
          equipCode,
          itemCode,
          inspectType,
          useYn: "Y",
        });
      }
      onAdded();
    } catch { /* 에러는 API 레이어에서 처리 */ }
    finally { setSaving(false); }
  };

  const selectableCount = filteredItems.filter(i => !registeredSet.has(i.itemCode)).length;
  const allChecked = selectableCount > 0 && filteredItems
    .filter(i => !registeredSet.has(i.itemCode))
    .every(i => checkedCodes.has(i.itemCode));

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">
              {t("master.equipInspect.linkItem", "점검항목 추가")}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
              <span className="font-mono">{equipCode}</span>
              <span>{equipName}</span>
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {inspectTypeLabel[inspectType] ?? inspectType}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-shrink-0 px-5 py-3 border-b border-border flex gap-2">
          <div className="w-44 flex-shrink-0">
            <ComCodeSelect
              groupCode="EQUIP_TYPE"
              value={selectedEquipType}
              onChange={setSelectedEquipType}
              placeholder={t("common.all", "전체")}
              fullWidth
            />
          </div>
          <div className="flex-1">
            <Input
              ref={searchRef}
              placeholder={t("master.equipInspect.searchPlaceholder", "항목 검색...")}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
        </div>

        {selectableCount > 0 && (
          <div className="flex-shrink-0 px-5 py-2 border-b border-border flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span>{t("common.selectAll", "전체 선택")} ({selectableCount})</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-muted">
              {t("master.equipInspect.noPoolForType", "등록된 점검항목 마스터가 없습니다")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map(item => {
                const isRegistered = registeredSet.has(item.itemCode);
                const isChecked = checkedCodes.has(item.itemCode);
                return (
                  <li
                    key={item.itemCode}
                    onClick={() => !isRegistered && toggleCheck(item.itemCode)}
                    className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                      isRegistered
                        ? "opacity-50 cursor-not-allowed"
                        : isChecked
                        ? "bg-primary/5 cursor-pointer"
                        : "hover:bg-surface cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isRegistered}
                      onChange={() => toggleCheck(item.itemCode)}
                      onClick={e => e.stopPropagation()}
                      className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                    />
                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <InspectItemImage imageUrl={item.imageUrl} alt={item.itemName} size={40} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-muted">{item.itemCode}</span>
                        <span className="text-sm font-medium text-text truncate">{item.itemName}</span>
                        {isRegistered && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border">
                            {t("master.equipInspect.alreadyRegistered", "등록됨")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ITEM_TYPE_COLORS[item.itemType] ?? ""}`}>
                          {itemTypeLabels[item.itemType] ?? item.itemType}
                        </span>
                        {item.cycle && (
                          <span className="text-xs text-text-muted">{cycleLabels[item.cycle] ?? item.cycle}</span>
                        )}
                        {item.equipType && (
                          <ComCodeBadge groupCode="EQUIP_TYPE" code={item.equipType} />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-sm text-text-muted">
            {checkedCodes.size > 0
              ? t("master.equipInspect.selectedCount", "{{count}}개 선택됨", { count: checkedCodes.size })
              : t("master.equipInspect.selectItemsGuide", "항목을 선택하세요")}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={checkedCodes.size === 0 || saving}>
              {saving
                ? t("common.saving", "저장 중...")
                : t("master.equipInspect.bulkRegister", "{{count}}개 일괄등록", { count: checkedCodes.size })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
