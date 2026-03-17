"use client";

/**
 * @file components/IqcDetailPanel.tsx
 * @description IQC 품목별 검사 — 우측 상세 패널 (연결된 검사그룹 + 검사항목 표시)
 *
 * 초보자 가이드:
 * 1. 선택된 품목에 연결된 검사그룹 정보 표시
 * 2. 그룹 내 검사항목을 측정형/판정형으로 분리하여 표 형태로 렌더링
 * 3. 그룹 연결/변경/해제 기능 제공 (Modal + Select)
 * 4. 연결 없으면 "연결된 검사그룹이 없습니다" 안내 표시
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Unlink, RefreshCw, ClipboardCheck, Ruler, Eye } from "lucide-react";
import { Card, CardContent, Button, Modal, Select, ConfirmModal } from "@/components/ui";
import { INSPECT_METHOD_COLORS } from "../types";

/** IQC 그룹 내 검사항목 */
interface GroupItem {
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
}

/** 연결된 그룹 정보 (IQC_PART_LINKS → group join) */
export interface LinkedGroupInfo {
  groupId: string;
  groupCode: string;
  groupName: string;
  inspectMethod: string;
  sampleQty?: number | null;
  items: GroupItem[];
}

/** 모든 그룹 옵션 (Select용) */
export interface GroupOption {
  id: string;
  groupCode: string;
  groupName: string;
}

interface IqcDetailPanelProps {
  selectedItemCode: string | null;
  selectedItemName: string;
  linkedGroups: LinkedGroupInfo[];
  allGroups: GroupOption[];
  /** 그룹 연결 모달 */
  linkModalOpen: boolean;
  onLinkModalOpen: () => void;
  onLinkModalClose: () => void;
  linkGroupId: string;
  onLinkGroupIdChange: (v: string) => void;
  onLinkSave: () => void;
  /** 연결 해제 확인 */
  unlinkTarget: LinkedGroupInfo | null;
  onUnlinkRequest: (g: LinkedGroupInfo) => void;
  onUnlinkClose: () => void;
  onUnlinkConfirm: () => void;
  saving: boolean;
}

export default function IqcDetailPanel({
  selectedItemCode,
  selectedItemName,
  linkedGroups,
  allGroups,
  linkModalOpen,
  onLinkModalOpen,
  onLinkModalClose,
  linkGroupId,
  onLinkGroupIdChange,
  onLinkSave,
  unlinkTarget,
  onUnlinkRequest,
  onUnlinkClose,
  onUnlinkConfirm,
  saving,
}: IqcDetailPanelProps) {
  const { t } = useTranslation();

  const methodLabels = useMemo<Record<string, string>>(
    () => ({
      FULL: t("master.iqcGroup.methodFull", "전수검사"),
      SAMPLE: t("master.iqcGroup.methodSample", "샘플검사"),
      SKIP: t("master.iqcGroup.methodSkip", "무검사"),
    }),
    [t]
  );

  const groupSelectOptions = useMemo(
    () =>
      allGroups.map((g) => ({
        value: g.id,
        label: `${g.groupCode} - ${g.groupName}`,
      })),
    [allGroups]
  );

  /* 품목 미선택 */
  if (!selectedItemCode) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="text-center text-text-muted py-20">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("master.iqcItem.noItemSelected", "좌측에서 품목을 선택해주세요")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
        <div>
          <p className="text-xs text-text-muted font-mono">{selectedItemCode}</p>
          <h3 className="text-lg font-semibold text-text">{selectedItemName}</h3>
        </div>
        <Button size="sm" onClick={onLinkModalOpen}>
          <Link2 className="w-4 h-4 mr-1" />
          {linkedGroups.length > 0
            ? t("master.iqcItem.changeGroup", "그룹 변경")
            : t("master.iqcItem.linkGroup", "그룹 연결")}
        </Button>
      </div>

      {/* 본문 */}
      <CardContent className="flex-1 overflow-auto px-6 py-4">
        {linkedGroups.length === 0 ? (
          <div className="text-center text-text-muted py-16">
            <Unlink className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t("master.iqcItem.noGroupLinked", "연결된 검사그룹이 없습니다")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {linkedGroups.map((group) => (
              <GroupSection
                key={group.groupId}
                group={group}
                methodLabels={methodLabels}
                onUnlink={() => onUnlinkRequest(group)}
                t={t}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* 그룹 연결/변경 모달 */}
      <Modal
        isOpen={linkModalOpen}
        onClose={onLinkModalClose}
        title={
          linkedGroups.length > 0
            ? t("master.iqcItem.changeGroup", "그룹 변경")
            : t("master.iqcItem.linkGroup", "그룹 연결")
        }
        size="md"
      >
        <div className="space-y-4">
          <Select
            label={t("master.iqcLink.group", "검사그룹")}
            options={[
              { value: "", label: t("master.iqcItem.selectGroup", "검사그룹을 선택하세요") },
              ...groupSelectOptions,
            ]}
            value={linkGroupId}
            onChange={onLinkGroupIdChange}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onLinkModalClose}>
              {t("common.cancel", "취소")}
            </Button>
            <Button onClick={onLinkSave} disabled={!linkGroupId || saving}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
              {t("common.save", "저장")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 연결 해제 확인 */}
      <ConfirmModal
        isOpen={!!unlinkTarget}
        onClose={onUnlinkClose}
        onConfirm={onUnlinkConfirm}
        variant="danger"
        message={t("master.iqcItem.unlinkConfirm", "이 검사그룹 연결을 해제하시겠습니까?")}
      />
    </Card>
  );
}

/* ─── 그룹 섹션 서브 컴포넌트 ─── */
function GroupSection({
  group,
  methodLabels,
  onUnlink,
  t,
}: {
  group: LinkedGroupInfo;
  methodLabels: Record<string, string>;
  onUnlink: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const measureItems = (group.items ?? [])
    .filter((i) => i.inspItem?.judgeMethod === "MEASURE")
    .sort((a, b) => a.seq - b.seq);
  const visualItems = (group.items ?? [])
    .filter((i) => i.inspItem?.judgeMethod === "VISUAL")
    .sort((a, b) => a.seq - b.seq);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
      {/* 그룹 정보 바 */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface dark:bg-slate-800 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-text-muted">{group.groupCode}</span>
          <span className="font-semibold text-sm text-text">{group.groupName}</span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[group.inspectMethod]}`}>
            {methodLabels[group.inspectMethod]}
            {group.inspectMethod === "SAMPLE" && group.sampleQty ? ` (${group.sampleQty})` : ""}
          </span>
        </div>
        <button onClick={onUnlink} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors" title={t("master.iqcItem.unlinkGroup", "연결 해제")}>
          <Unlink className="w-4 h-4 text-red-500" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 측정형 */}
        {measureItems.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <span className="px-2 py-0.5 rounded text-xs bg-cyan-600 text-white">
                <Ruler className="w-3 h-3 inline mr-1" />
                {t("master.iqcItem.measureItems", "측정형 검사항목")}
              </span>
            </h4>
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-cyan-50 dark:bg-cyan-950 text-text-muted text-xs">
                  <th className="px-3 py-2 text-left w-12">{t("master.iqcItem.seq", "순번")}</th>
                  <th className="px-3 py-2 text-left">{t("master.iqcItem.inspectItem", "검사항목")}</th>
                  <th className="px-3 py-2 text-center w-20">MIN</th>
                  <th className="px-3 py-2 text-center w-20">MAX</th>
                  <th className="px-3 py-2 text-center w-16">{t("common.unit", "단위")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {measureItems.map((item) => (
                  <tr key={item.seq} className="hover:bg-surface dark:hover:bg-slate-800">
                    <td className="px-3 py-2 text-text-muted">{item.seq}</td>
                    <td className="px-3 py-2 font-medium text-text">{item.inspItem?.inspItemName ?? "-"}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{item.inspItem?.lsl ?? "-"}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{item.inspItem?.usl ?? "-"}</td>
                    <td className="px-3 py-2 text-center text-text-muted">{item.inspItem?.unit ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 판정형 */}
        {visualItems.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <span className="px-2 py-0.5 rounded text-xs bg-amber-600 text-white">
                <Eye className="w-3 h-3 inline mr-1" />
                {t("master.iqcItem.judgeItems", "판정형 검사항목")}
              </span>
            </h4>
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-amber-50 dark:bg-amber-950 text-text-muted text-xs">
                  <th className="px-3 py-2 text-left w-12">{t("master.iqcItem.seq", "순번")}</th>
                  <th className="px-3 py-2 text-left">{t("master.iqcItem.inspectItem", "검사항목")}</th>
                  <th className="px-3 py-2 text-left">{t("master.iqcItem.spec", "규격/기준")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visualItems.map((item) => (
                  <tr key={item.seq} className="hover:bg-surface dark:hover:bg-slate-800">
                    <td className="px-3 py-2 text-text-muted">{item.seq}</td>
                    <td className="px-3 py-2 font-medium text-text">{item.inspItem?.inspItemName ?? "-"}</td>
                    <td className="px-3 py-2 text-text-muted">{item.inspItem?.criteria ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {measureItems.length === 0 && visualItems.length === 0 && (
          <p className="text-center text-text-muted text-sm py-6">
            {t("common.noData", "데이터가 없습니다.")}
          </p>
        )}
      </div>
    </div>
  );
}
