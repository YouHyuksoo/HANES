"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC 검사 관리 통합 페이지 (3-Tab 구조)
 *
 * 초보자 가이드:
 * 1. **품목별 IQC 탭**: 좌우 분할 — 좌측 자재 목록, 우측 연결된 검사그룹 상세
 * 2. **검사항목 풀 탭**: 개별 검사항목(IQC-xxx) CRUD — 검사 라이브러리
 * 3. **검사그룹 탭**: 항목을 묶어 검사그룹(IGR-xxx) 관리 — 검사 템플릿
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";
import IqcItemTab from "./components/IqcItemTab";
import IqcGroupTab from "./components/IqcGroupTab";
import ItemListPanel from "./components/ItemListPanel";
import IqcDetailPanel from "./components/IqcDetailPanel";
import type { LinkedGroupInfo, GroupOption } from "./components/IqcDetailPanel";
import api from "@/services/api";

type TabValue = "perItem" | "items" | "groups";

interface PartItem {
  itemCode: string;
  itemName: string;
}

interface LinkRow {
  itemCode: string;
  partnerId: string;
  groupId: number;
  group?: {
    id: number;
    groupCode: string;
    groupName: string;
    inspectMethod: string;
    sampleQty?: number | null;
    items?: {
      seq: number;
      inspItem?: {
        inspItemCode: string;
        inspItemName: string;
        judgeMethod: "VISUAL" | "MEASURE";
        criteria: string | null;
        lsl: number | null;
        usl: number | null;
        unit: string | null;
      };
    }[];
  };
}

export default function IqcItemPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("perItem");

  /* ─── 품목별 IQC 탭 상태 ─── */
  const [parts, setParts] = useState<PartItem[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [allGroups, setAllGroups] = useState<GroupOption[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkGroupId, setLinkGroupId] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedGroupInfo | null>(null);
  const [saving, setSaving] = useState(false);

  /* 데이터 로드 */
  const fetchAll = useCallback(async () => {
    setPartsLoading(true);
    try {
      const [partsRes, linksRes, groupsRes] = await Promise.all([
        api.get("/master/parts", { params: { itemType: "RAW_MATERIAL", limit: "5000" } }),
        api.get("/master/iqc-part-links", { params: { limit: "5000" } }),
        api.get("/master/iqc-groups", { params: { limit: "5000" } }),
      ]);
      setParts(partsRes.data?.data ?? []);
      setLinks(linksRes.data?.data ?? []);
      setAllGroups(
        (groupsRes.data?.data ?? []).map((g: any) => ({
          id: String(g.id ?? g.groupCode),
          groupCode: g.groupCode,
          groupName: g.groupName,
        }))
      );
    } catch {
      setParts([]);
      setLinks([]);
    } finally {
      setPartsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "perItem") fetchAll();
  }, [activeTab, fetchAll]);

  /* 품목별 연결그룹수 맵 */
  const linkCountMap = useMemo(() => {
    const m = new Map<string, number>();
    links.forEach((l) => m.set(l.itemCode, (m.get(l.itemCode) ?? 0) + 1));
    return m;
  }, [links]);

  /* 선택된 품목의 연결 그룹 상세 */
  const linkedGroups = useMemo<LinkedGroupInfo[]>(() => {
    if (!selectedItemCode) return [];
    return links
      .filter((l) => l.itemCode === selectedItemCode && l.group)
      .map((l) => ({
        groupId: String(l.groupId),
        groupCode: l.group!.groupCode,
        groupName: l.group!.groupName,
        inspectMethod: l.group!.inspectMethod,
        sampleQty: l.group!.sampleQty,
        items: l.group!.items ?? [],
      }));
  }, [selectedItemCode, links]);

  const selectedItemName = useMemo(
    () => parts.find((p) => p.itemCode === selectedItemCode)?.itemName ?? "",
    [parts, selectedItemCode]
  );

  /* 그룹 연결/변경 저장 */
  const handleLinkSave = useCallback(async () => {
    if (!selectedItemCode || !linkGroupId) return;
    setSaving(true);
    try {
      const existing = links.find((l) => l.itemCode === selectedItemCode);
      if (existing) {
        const pid = existing.partnerId === "*" ? "_default_" : existing.partnerId;
        await api.put(`/master/iqc-part-links/${encodeURIComponent(selectedItemCode)}/${pid}`, {
          groupId: linkGroupId,
        });
      } else {
        await api.post("/master/iqc-part-links", {
          itemCode: selectedItemCode,
          partnerId: "*",
          groupId: linkGroupId,
        });
      }
      setLinkModalOpen(false);
      setLinkGroupId("");
      fetchAll();
    } catch (e) {
      console.error("Link save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedItemCode, linkGroupId, links, fetchAll]);

  /* 연결 해제 */
  const handleUnlinkConfirm = useCallback(async () => {
    if (!selectedItemCode || !unlinkTarget) return;
    try {
      const link = links.find(
        (l) => l.itemCode === selectedItemCode && String(l.groupId) === unlinkTarget.groupId
      );
      if (link) {
        const pid = link.partnerId === "*" ? "_default_" : link.partnerId;
        await api.delete(`/master/iqc-part-links/${encodeURIComponent(link.itemCode)}/${pid}`);
      }
      setUnlinkTarget(null);
      fetchAll();
    } catch (e) {
      console.error("Unlink failed:", e);
    }
  }, [selectedItemCode, unlinkTarget, links, fetchAll]);

  const tabs: { key: TabValue; label: string }[] = [
    { key: "perItem", label: t("master.iqcItem.perItemIqc", "품목별 IQC") },
    { key: "items", label: t("master.iqcItem.itemPool", "검사항목 풀") },
    { key: "groups", label: t("master.iqcGroup.tabGroups", "검사그룹") },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" />
          {t("master.iqcItem.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.iqcItem.subtitle")}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "perItem" && (
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-4 min-h-0">
              <ItemListPanel
                parts={parts}
                linkCountMap={linkCountMap}
                selectedItemCode={selectedItemCode}
                onSelect={setSelectedItemCode}
                searchText={searchText}
                onSearchChange={setSearchText}
                loading={partsLoading}
              />
            </div>
            <div className="col-span-8 min-h-0">
              <IqcDetailPanel
                selectedItemCode={selectedItemCode}
                selectedItemName={selectedItemName}
                linkedGroups={linkedGroups}
                allGroups={allGroups}
                linkModalOpen={linkModalOpen}
                onLinkModalOpen={() => {
                  setLinkGroupId(linkedGroups[0]?.groupId ?? "");
                  setLinkModalOpen(true);
                }}
                onLinkModalClose={() => setLinkModalOpen(false)}
                linkGroupId={linkGroupId}
                onLinkGroupIdChange={setLinkGroupId}
                onLinkSave={handleLinkSave}
                unlinkTarget={unlinkTarget}
                onUnlinkRequest={setUnlinkTarget}
                onUnlinkClose={() => setUnlinkTarget(null)}
                onUnlinkConfirm={handleUnlinkConfirm}
                saving={saving}
              />
            </div>
          </div>
        )}
        {activeTab === "items" && <IqcItemTab />}
        {activeTab === "groups" && <IqcGroupTab />}
      </div>
    </div>
  );
}
