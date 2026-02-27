"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/LinkItemModal.tsx
 * @description 점검항목 마스터에서 설비에 항목을 선택/연결하는 모달
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Check } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import { InspectItemMaster, INSPECT_TYPE_COLORS } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  equipName: string;
  allItems: InspectItemMaster[];
  linkedItemCodes: Set<string>;
  onLink: (itemCodes: string[]) => void;
}

export default function LinkItemModal({ isOpen, onClose, equipCode, equipName, allItems, linkedItemCodes, onLink }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const typeOptions = useMemo(() => [
    { value: "", label: t("master.equipInspect.inspectType") },
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
  ], [t]);

  const available = useMemo(() => {
    return allItems.filter(item => {
      if (linkedItemCodes.has(item.itemCode)) return false;
      if (typeFilter && item.inspectType !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!item.itemCode.toLowerCase().includes(s) && !item.itemName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [allItems, linkedItemCodes, typeFilter, search]);

  const toggle = (code: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleConfirm = () => {
    onLink(Array.from(selected));
    setSelected(new Set());
    setSearch("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.equipInspect.linkItem", "점검항목 추가")} size="lg">
      <div className="mb-4 p-3 rounded-lg bg-surface border border-border">
        <span className="text-sm text-text-muted">{t("master.equipInspect.targetEquip", "대상 설비")}: </span>
        <span className="font-mono font-medium text-text">{equipCode}</span>
        <span className="text-sm text-text-muted ml-2">{equipName}</span>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <Input placeholder={t("master.equipInspect.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
        </div>
        <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
      </div>

      <div className="max-h-[350px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
        {available.map(item => {
          const checked = selected.has(item.itemCode);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.itemCode)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${checked ? "bg-primary/5" : "hover:bg-surface/50"}`}
            >
              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-primary bg-primary" : "border-border"}`}>
                {checked && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="font-mono text-xs text-text-muted w-16 shrink-0">{item.itemCode}</span>
              <span className={`px-2 py-0.5 text-[10px] rounded-full shrink-0 ${INSPECT_TYPE_COLORS[item.inspectType]}`}>
                {item.inspectType === "DAILY" ? t("master.equipInspect.typeDaily") : t("master.equipInspect.typePeriodic")}
              </span>
              <span className="text-sm text-text truncate">{item.itemName}</span>
              <span className="text-xs text-text-muted ml-auto shrink-0">{item.criteria}</span>
            </button>
          );
        })}
        {available.length === 0 && (
          <div className="py-8 text-center text-sm text-text-muted">{t("master.equipInspect.noAvailableItems", "추가 가능한 항목이 없습니다")}</div>
        )}
      </div>

      <div className="flex justify-between items-center pt-6">
        <span className="text-sm text-text-muted">{selected.size}{t("master.equipInspect.selectedCount", "개 선택")}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>{t("common.add")}</Button>
        </div>
      </div>
    </Modal>
  );
}
