"use client";

/**
 * @file src/app/(authenticated)/master/part/components/IqcSettingModal.tsx
 * @description 품목별 IQC 검사그룹 선택 모달 — API 연동
 *
 * 초보자 가이드:
 * 1. /master/iqc-groups API에서 검사그룹 목록 조회
 * 2. /master/iqc-item-pool API에서 검사항목 풀 조회
 * 3. 그룹 선택 시 포함된 검사항목 미리보기 표시
 * 4. 선택 확인하면 품목에 검사그룹 코드 연결
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { Part, PartIqcLink } from "../types";
import { INSPECT_METHOD_COLORS, JUDGE_METHOD_COLORS } from "../../iqc-item/types";
import api from "@/services/api";

interface PoolItem {
  id: string;
  itemCode: string;
  itemName: string;
  judgeMethod: string;
  lsl: number | null;
  usl: number | null;
  unit: string | null;
}

interface GroupRow {
  id: string;
  groupCode: string;
  groupName: string;
  inspectMethod: string;
  sampleQty?: number | null;
  items?: { itemId: string; seq: number }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  part: Part;
  currentLink: PartIqcLink | undefined;
  onSave: (link: PartIqcLink) => void;
  onUnlink: (itemCode: string) => void;
}

export default function IqcSettingModal({ isOpen, onClose, part, currentLink, onSave, onUnlink }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>(currentLink?.groupCode ?? "");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [poolItems, setPoolItems] = useState<PoolItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [grpRes, itemRes] = await Promise.all([
        api.get("/master/iqc-groups", { params: { limit: "5000" } }),
        api.get("/master/iqc-item-pool", { params: { limit: "5000", useYn: "Y" } }),
      ]);
      setGroups(grpRes.data?.data ?? []);
      setPoolItems(itemRes.data?.data ?? []);
    } catch {
      setGroups([]);
      setPoolItems([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setSelected(currentLink?.groupCode ?? "");
    }
  }, [isOpen, currentLink, fetchData]);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: t("master.part.iqc.methodFull", "전수검사"),
    SAMPLE: t("master.part.iqc.methodSample", "샘플검사"),
    SKIP: t("master.part.iqc.methodSkip", "무검사"),
  }), [t]);

  const judgeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.part.iqc.visual", "육안"),
    MEASURE: t("master.part.iqc.measure", "계측"),
  }), [t]);

  const itemMap = useMemo(() => new Map(poolItems.map(i => [i.id, i])), [poolItems]);

  const selectedGroup = groups.find(g => g.groupCode === selected);
  const selectedItems = useMemo(() => {
    if (!selectedGroup?.items) return [];
    return selectedGroup.items
      .sort((a, b) => a.seq - b.seq)
      .map(gi => itemMap.get(gi.itemId))
      .filter(Boolean) as PoolItem[];
  }, [selectedGroup, itemMap]);

  const handleSave = () => {
    if (!selected) return;
    onSave({ itemCode: part.itemCode, groupCode: selected });
    onClose();
  };

  const handleUnlink = () => {
    onUnlink(part.itemCode);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`${part.itemCode} ${part.itemName} - ${t("master.part.iqc.selectGroup", "검사그룹 선택")}`} size="lg">

      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {groups.map(group => (
          <label key={group.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selected === group.groupCode ? "border-primary bg-primary/5" : "border-border hover:bg-surface"
          }`} onClick={() => setSelected(group.groupCode)}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              selected === group.groupCode ? "border-primary bg-primary" : "border-border"
            }`}>
              {selected === group.groupCode && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-muted">{group.groupCode}</span>
                <span className="text-sm font-medium text-text">{group.groupName}</span>
              </div>
              <span className="text-xs text-text-muted">
                {group.items?.length ?? 0}개 항목
              </span>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${INSPECT_METHOD_COLORS[group.inspectMethod]}`}>
              {methodLabels[group.inspectMethod]}{group.sampleQty ? `(${group.sampleQty})` : ""}
            </span>
          </label>
        ))}
      </div>

      {selectedGroup && selectedItems.length > 0 && (
        <div className="mt-4 p-4 bg-background rounded-lg border border-border">
          <h4 className="text-xs font-semibold text-text-muted mb-2">
            {selectedGroup.groupName} - {t("master.part.iqc.inspectItems", "검사항목")}
          </h4>
          <div className="space-y-1">
            {selectedItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-text-muted w-16">{item.itemCode}</span>
                <span className="flex-1">{item.itemName}</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${JUDGE_METHOD_COLORS[item.judgeMethod]}`}>
                  {judgeLabels[item.judgeMethod]}
                </span>
                {item.judgeMethod === "MEASURE" && (
                  <span className="font-mono text-xs text-text-muted">
                    {[item.lsl, item.usl].filter(v => v != null).join("~")}{item.unit ? ` ${item.unit}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-6">
        <div>
          {currentLink && (
            <Button variant="secondary" size="sm" onClick={handleUnlink}>
              {t("master.part.iqc.unlink", "연결 해제")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!selected}>{t("common.save", "저장")}</Button>
        </div>
      </div>
    </Modal>
  );
}
