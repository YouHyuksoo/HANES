"use client";

/**
 * @file components/IqcGroupModal.tsx
 * @description IQC 검사그룹 추가/수정 모달 — 그룹 정보 입력 + 검사항목 선택 (API 연동)
 *
 * 초보자 가이드:
 * 1. 좌측: 그룹코드, 그룹명, 검사형태(전수/샘플/무검사), 샘플수량
 * 2. 우측: /master/iqc-item-pool API에서 조회한 항목 체크박스 목록
 * 3. 선택된 항목은 순서(SEQ) 번호가 자동 부여됨
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import { JUDGE_METHOD_COLORS } from "../types";
import api from "@/services/api";

interface PoolItem {
  id: string;
  itemCode: string;
  itemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  criteria: string | null;
  lsl: number | null;
  usl: number | null;
  unit: string | null;
}

interface GroupFormData {
  groupCode: string;
  groupName: string;
  inspectMethod: string;
  sampleQty: string;
  selectedItemIds: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: GroupFormData) => void;
  editing?: {
    id: string;
    groupCode: string;
    groupName: string;
    inspectMethod: string;
    sampleQty?: number | null;
    items?: { itemId: string; seq: number }[];
  } | null;
}

const EMPTY_FORM: GroupFormData = {
  groupCode: "", groupName: "", inspectMethod: "SAMPLE", sampleQty: "", selectedItemIds: [],
};

export default function IqcGroupModal({ isOpen, onClose, onSave, editing }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<GroupFormData>(EMPTY_FORM);
  const [itemSearch, setItemSearch] = useState("");
  const [allItems, setAllItems] = useState<PoolItem[]>([]);

  const fetchPoolItems = useCallback(async () => {
    try {
      const res = await api.get("/master/iqc-item-pool", { params: { limit: "5000", useYn: "Y" } });
      setAllItems(res.data?.data ?? []);
    } catch {
      setAllItems([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPoolItems();
      if (editing) {
        setForm({
          groupCode: editing.groupCode,
          groupName: editing.groupName,
          inspectMethod: editing.inspectMethod,
          sampleQty: editing.sampleQty?.toString() ?? "",
          selectedItemIds: editing.items?.sort((a, b) => a.seq - b.seq).map(i => i.itemId) ?? [],
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setItemSearch("");
    }
  }, [isOpen, editing, fetchPoolItems]);

  const inspectMethodOptions = useMemo(() => [
    { value: "FULL", label: t("master.iqcGroup.methodFull", "전수검사") },
    { value: "SAMPLE", label: t("master.iqcGroup.methodSample", "샘플검사") },
    { value: "SKIP", label: t("master.iqcGroup.methodSkip", "무검사") },
  ], [t]);

  const judgeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.iqcItem.visual", "육안"),
    MEASURE: t("master.iqcItem.measureMethod", "계측"),
  }), [t]);

  const filteredItems = useMemo(() => {
    if (!itemSearch) return allItems;
    const s = itemSearch.toLowerCase();
    return allItems.filter(i =>
      i.itemCode.toLowerCase().includes(s) || i.itemName.toLowerCase().includes(s)
    );
  }, [allItems, itemSearch]);

  const toggleItem = (itemId: string) => {
    setForm(prev => {
      const selected = prev.selectedItemIds.includes(itemId)
        ? prev.selectedItemIds.filter(id => id !== itemId)
        : [...prev.selectedItemIds, itemId];
      return { ...prev, selectedItemIds: selected };
    });
  };

  const selectedItems = useMemo(() => {
    return form.selectedItemIds
      .map(id => allItems.find(i => i.id === id))
      .filter(Boolean) as PoolItem[];
  }, [form.selectedItemIds, allItems]);

  const handleSubmit = () => {
    if (!form.groupCode || !form.groupName) return;
    onSave(form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={editing ? t("master.iqcGroup.editGroup", "검사그룹 수정") : t("master.iqcGroup.addGroup", "검사그룹 추가")}
      size="xl">

      <div className="grid grid-cols-2 gap-6">
        {/* 좌측: 그룹 정보 */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-muted border-b border-border pb-2">
            {t("master.iqcGroup.groupInfo", "그룹 정보")}
          </h3>
          <Input label={t("master.iqcGroup.groupCode", "그룹코드")} value={form.groupCode}
            onChange={e => setForm(p => ({ ...p, groupCode: e.target.value }))}
            placeholder="IGR-001" fullWidth disabled={!!editing} />
          <Input label={t("master.iqcGroup.groupName", "그룹명")} value={form.groupName}
            onChange={e => setForm(p => ({ ...p, groupName: e.target.value }))}
            placeholder="전선류 검사" fullWidth />
          <Select label={t("master.iqcGroup.inspectMethod", "검사형태")} options={inspectMethodOptions}
            value={form.inspectMethod}
            onChange={v => setForm(p => ({ ...p, inspectMethod: v }))} fullWidth />
          {form.inspectMethod === "SAMPLE" && (
            <Input label={t("master.iqcGroup.sampleQty", "샘플 수량")} type="number" value={form.sampleQty}
              onChange={e => setForm(p => ({ ...p, sampleQty: e.target.value }))}
              placeholder="5" fullWidth />
          )}

          {/* 선택된 항목 미리보기 */}
          {selectedItems.length > 0 && (
            <div className="mt-2">
              <h4 className="text-xs font-semibold text-text-muted mb-2">
                {t("master.iqcGroup.selectedItems", "선택된 항목")} ({selectedItems.length})
              </h4>
              <div className="space-y-1 max-h-[180px] overflow-y-auto">
                {selectedItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-primary/5 rounded">
                    <span className="text-text-muted w-5">{idx + 1}</span>
                    <span className="font-mono text-text-muted">{item.itemCode}</span>
                    <span className="flex-1 truncate">{item.itemName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 우측: 검사항목 선택 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-muted border-b border-border pb-2">
            {t("master.iqcGroup.selectItems", "검사항목 선택")}
          </h3>
          <Input placeholder={t("master.iqcGroup.itemSearchPlaceholder", "항목코드/항목명 검색...")}
            value={itemSearch} onChange={e => setItemSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />} fullWidth />

          <div className="space-y-1 max-h-[340px] overflow-y-auto">
            {filteredItems.map(item => {
              const isSelected = form.selectedItemIds.includes(item.id);
              return (
                <label key={item.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-surface"
                  }`}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-muted">{item.itemCode}</span>
                      <span className="text-sm text-text">{item.itemName}</span>
                    </div>
                    {item.judgeMethod === "MEASURE" && item.lsl != null && (
                      <span className="text-[11px] font-mono text-text-muted">
                        {item.lsl}~{item.usl} {item.unit}
                      </span>
                    )}
                  </div>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded shrink-0 ${JUDGE_METHOD_COLORS[item.judgeMethod]}`}>
                    {judgeLabels[item.judgeMethod]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6 border-t border-border mt-4">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={!form.groupCode || !form.groupName}>
          {editing ? t("common.edit") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
