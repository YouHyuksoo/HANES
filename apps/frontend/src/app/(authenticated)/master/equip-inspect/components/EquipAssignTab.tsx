"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/EquipAssignTab.tsx
 * @description 설비별 점검항목 할당 탭 - 좌측 설비 + 우측 점검항목
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Wrench, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardContent, Input } from "@/components/ui";
import InspectItemPanel from "./InspectItemPanel";
import LinkItemModal from "./LinkItemModal";
import {
  EquipSummary, EquipInspectLink,
  seedEquipments, seedInspectItems, seedLinks,
  EQUIP_TYPE_COLORS,
} from "../types";

export default function EquipAssignTab() {
  const { t } = useTranslation();
  const [selectedEquip, setSelectedEquip] = useState<EquipSummary | null>(seedEquipments[0]);
  const [searchText, setSearchText] = useState("");
  const [links, setLinks] = useState<EquipInspectLink[]>(seedLinks);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const filteredEquips = seedEquipments.filter(e => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return e.equipCode.toLowerCase().includes(s) || e.equipName.toLowerCase().includes(s);
  });

  /** 설비별 점검항목 수 */
  const countMap = new Map<string, number>();
  links.forEach(l => countMap.set(l.equipCode, (countMap.get(l.equipCode) || 0) + 1));

  /** 현재 설비에 연결된 itemCode set */
  const linkedItemCodes = new Set(
    links.filter(l => l.equipCode === selectedEquip?.equipCode).map(l => l.itemCode)
  );

  /* ── 설비-점검항목 연결/해제 ── */
  const handleLinkItems = useCallback((itemCodes: string[]) => {
    if (!selectedEquip) return;
    const existing = links.filter(l => l.equipCode === selectedEquip.equipCode);
    const maxSeq = existing.reduce((max, l) => Math.max(max, l.seq), 0);
    const newLinks: EquipInspectLink[] = itemCodes.map((code, i) => ({
      id: `l${Date.now()}-${i}`,
      equipCode: selectedEquip.equipCode,
      itemCode: code,
      seq: maxSeq + i + 1,
      useYn: "Y",
    }));
    setLinks(prev => [...prev, ...newLinks]);
  }, [selectedEquip, links]);

  const handleUnlink = useCallback((linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  }, []);

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* 좌측: 설비 목록 */}
      <div className="col-span-4">
        <Card>
          <CardHeader title={t("master.equipInspect.equipList", "설비 목록")} subtitle={t("master.equipInspect.selectEquip", "점검 설비 선택")} />
          <CardContent>
            <Input
              placeholder={t("master.equipInspect.searchPlaceholder")}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
              className="mb-3"
            />
            <div className="space-y-1 max-h-[calc(100vh-360px)] overflow-y-auto">
              {filteredEquips.map(equip => (
                <button
                  key={equip.id}
                  onClick={() => setSelectedEquip(equip)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                    selectedEquip?.id === equip.id ? "bg-primary text-white" : "hover:bg-surface text-text"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="w-4 h-4 shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="font-medium">{equip.equipCode}</div>
                      <div className={`text-xs truncate ${selectedEquip?.id === equip.id ? "text-white/70" : "text-text-muted"}`}>
                        {equip.equipName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded ${
                      selectedEquip?.id === equip.id ? "bg-white/20 text-white" : EQUIP_TYPE_COLORS[equip.equipType] || "bg-surface text-text-muted"
                    }`}>
                      {equip.equipType}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      selectedEquip?.id === equip.id ? "bg-white/20 text-white" : "bg-surface text-text-muted"
                    }`}>
                      {countMap.get(equip.equipCode) || 0}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 선택된 설비의 점검항목 */}
      <div className="col-span-8">
        <InspectItemPanel
          equip={selectedEquip}
          links={links}
          allItems={seedInspectItems}
          onUnlink={handleUnlink}
          onOpenLinkModal={() => setLinkModalOpen(true)}
        />
      </div>

      {/* 점검항목 연결 모달 */}
      {selectedEquip && (
        <LinkItemModal
          isOpen={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          equipCode={selectedEquip.equipCode}
          equipName={selectedEquip.equipName}
          allItems={seedInspectItems}
          linkedItemCodes={linkedItemCodes}
          onLink={handleLinkItems}
        />
      )}
    </div>
  );
}
