"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/RoutingLinkModal.tsx
 * @description BOM 아이템에 라우팅 그룹을 연결하는 모달
 *
 * 초보자 가이드:
 * 1. 라우팅 그룹 마스터 목록에서 하나를 선택
 * 2. 선택한 그룹의 공정순서를 미리보기로 확인
 * 3. "연결" 버튼으로 BOM 아이템과 라우팅 그룹을 연결
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Check, ArrowRight } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { BomTreeItem, RoutingGroup } from "../types";
import { mockRoutingGroups } from "../mockData";

/** 공정유형 컬러맵 */
const processColor: Record<string, string> = {
  CUT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CRM: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ASM: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INS: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  HSK: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  STP: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  PKG: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface RoutingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BomTreeItem | null;
  onLink: (partCode: string, routingCode: string) => void;
}

export default function RoutingLinkModal({ isOpen, onClose, item, onLink }: RoutingLinkModalProps) {
  const { t } = useTranslation();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  if (!item) return null;

  const selectedGroup = mockRoutingGroups.find((g) => g.routingCode === selectedCode);

  const handleLink = () => {
    if (selectedCode) {
      onLink(item.partCode, selectedCode);
      setSelectedCode(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.bom.linkRouting", "라우팅 그룹 연결")} size="lg">
      {/* 대상 품목 */}
      <div className="mb-4 p-3 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">{t("master.bom.targetItem", "대상 품목")}:</span>
          <span className="font-mono font-medium text-text">{item.partCode}</span>
          <span className="text-text-muted">{item.partName}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">{item.partType}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 좌: 라우팅 그룹 목록 */}
        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t("master.bom.routingGroupList", "라우팅 그룹 목록")}</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {mockRoutingGroups.filter((g) => g.useYn === "Y").map((g) => (
              <button
                key={g.routingCode}
                onClick={() => setSelectedCode(g.routingCode)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-sm text-left transition-colors ${
                  selectedCode === g.routingCode ? "border-primary bg-primary/5" : "border-border hover:bg-surface"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-mono font-medium text-text text-xs">{g.routingCode}</div>
                  <div className="text-xs text-text-muted mt-0.5 truncate">{g.routingName}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span className="text-[10px] text-text-muted">{g.steps.length}{t("master.bom.processUnit", "공정")}</span>
                  {selectedCode === g.routingCode && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우: 선택한 그룹의 공정 미리보기 */}
        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t("master.bom.processPreview", "공정순서 미리보기")}</p>
          {selectedGroup ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-primary/5 border-b border-border">
                <span className="font-mono text-xs font-medium text-primary">{selectedGroup.routingCode}</span>
                <span className="text-xs text-text-muted ml-2">{selectedGroup.routingName}</span>
              </div>
              <div className="divide-y divide-border">
                {selectedGroup.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-text-muted font-medium">{step.seq}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${processColor[step.processType] || "bg-gray-100 text-gray-700"}`}>
                      {step.processType}
                    </span>
                    <span className="text-text">{step.processName}</span>
                    <span className="text-text-muted ml-auto">{step.equipType}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border text-sm text-text-muted">
              <div className="text-center">
                <ArrowRight className="w-6 h-6 mx-auto mb-2 text-text-muted/40" />
                <p>{t("master.bom.selectRoutingGroup", "좌측에서 라우팅 그룹을 선택하세요")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleLink} disabled={!selectedCode}>
          <Link2 className="w-4 h-4 mr-1" />
          {t("master.bom.linkAction", "연결")}
        </Button>
      </div>
    </Modal>
  );
}
