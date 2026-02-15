"use client";

/**
 * @file src/app/(authenticated)/master/part/components/IqcSettingModal.tsx
 * @description 품목별 IQC 검사그룹 선택 모달
 *
 * 초보자 가이드:
 * 1. IQC 검사항목관리에서 만든 검사그룹 목록을 표시
 * 2. 그룹 선택 시 포함된 검사항목 미리보기 표시
 * 3. 선택 확인하면 품목에 검사그룹 코드 연결
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { Part, PartIqcLink } from "../types";
import { seedIqcGroups, seedIqcItems, IqcGroup, INSPECT_METHOD_COLORS, JUDGE_METHOD_COLORS } from "../../iqc-item/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  part: Part;
  currentLink: PartIqcLink | undefined;
  onSave: (link: PartIqcLink) => void;
  onUnlink: (partCode: string) => void;
}

export default function IqcSettingModal({ isOpen, onClose, part, currentLink, onSave, onUnlink }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>(currentLink?.groupCode ?? "");

  const groups = seedIqcGroups;
  const allItems = seedIqcItems;

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: t("master.part.iqc.methodFull", "전수검사"),
    SAMPLE: t("master.part.iqc.methodSample", "샘플검사"),
    SKIP: t("master.part.iqc.methodSkip", "무검사"),
  }), [t]);

  const judgeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.part.iqc.visual", "육안"),
    MEASURE: t("master.part.iqc.measure", "계측"),
  }), [t]);

  const selectedGroup = groups.find(g => g.groupCode === selected);
  const selectedItems = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.itemCodes
      .map(code => allItems.find(i => i.itemCode === code))
      .filter(Boolean);
  }, [selectedGroup, allItems]);

  const handleSave = () => {
    if (!selected) return;
    onSave({ partCode: part.partCode, groupCode: selected });
    onClose();
  };

  const handleUnlink = () => {
    onUnlink(part.partCode);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`${part.partCode} ${part.partName} - ${t("master.part.iqc.selectGroup", "검사그룹 선택")}`} size="lg">

      {/* 검사그룹 목록 */}
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
                {group.itemCodes.length}개 항목
              </span>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${INSPECT_METHOD_COLORS[group.inspectMethod]}`}>
              {methodLabels[group.inspectMethod]}{group.sampleQty ? `(${group.sampleQty})` : ""}
            </span>
          </label>
        ))}
      </div>

      {/* 선택된 그룹의 항목 미리보기 */}
      {selectedGroup && selectedItems.length > 0 && (
        <div className="mt-4 p-4 bg-background rounded-lg border border-border">
          <h4 className="text-xs font-semibold text-text-muted mb-2">
            {selectedGroup.groupName} - {t("master.part.iqc.inspectItems", "검사항목")}
          </h4>
          <div className="space-y-1">
            {selectedItems.map(item => item && (
              <div key={item.itemCode} className="flex items-center gap-2 text-sm">
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
