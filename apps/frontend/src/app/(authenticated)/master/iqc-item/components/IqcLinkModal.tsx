"use client";

/**
 * @file components/IqcLinkModal.tsx
 * @description IQC 연결 추가/수정 모달 — 품목 + 거래처(공급상) → 검사그룹 매핑
 *
 * 초보자 가이드:
 * 1. 품목 검색 (검색어 입력 후 조회 → 결과 중 선택)
 * 2. 거래처 선택 (SUPPLIER 유형만, "전체(기본)" 옵션 포함)
 * 3. 검사그룹 선택 + 포함 항목 미리보기
 * 4. 비고 입력
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import { INSPECT_METHOD_COLORS } from "../types";
import api from "@/services/api";

interface PartOption { id: string; partCode: string; partName: string; }
interface PartnerOption { id: string; partnerCode: string; partnerName: string; }
interface GroupOption {
  id: string; groupCode: string; groupName: string;
  inspectMethod: string; sampleQty?: number | null;
  items?: { itemId: string; seq: number }[];
}

interface LinkFormData {
  partId: string;
  partnerId: string;
  groupId: string;
  remark: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LinkFormData) => void;
  editing?: {
    id: string; partId: string; partnerId?: string | null;
    groupId: string; remark?: string | null;
    part?: { partCode: string; partName: string };
  } | null;
}

const EMPTY_FORM: LinkFormData = { partId: "", partnerId: "", groupId: "", remark: "" };

export default function IqcLinkModal({ isOpen, onClose, onSave, editing }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<LinkFormData>(EMPTY_FORM);
  const [partSearch, setPartSearch] = useState("");
  const [parts, setParts] = useState<PartOption[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [partnerRes, groupRes] = await Promise.all([
        api.get("/master/partners", { params: { limit: 100, partnerType: "SUPPLIER", useYn: "Y" } }),
        api.get("/master/iqc-groups", { params: { limit: 100, useYn: "Y" } }),
      ]);
      if (partnerRes.data.success) setPartners(partnerRes.data.data || []);
      if (groupRes.data.success) setGroups(groupRes.data.data || []);
    } catch (e) {
      console.error("IQC Link options fetch failed:", e);
    }
  }, []);

  const searchParts = useCallback(async (keyword: string) => {
    if (!keyword.trim()) { setParts([]); return; }
    setPartLoading(true);
    try {
      const res = await api.get("/master/parts", {
        params: { limit: 30, search: keyword.trim(), useYn: "Y" },
      });
      if (res.data.success) setParts(res.data.data || []);
    } catch {
      setParts([]);
    } finally {
      setPartLoading(false);
    }
  }, []);

  const handlePartSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") searchParts(partSearch);
  }, [partSearch, searchParts]);

  useEffect(() => {
    if (isOpen) {
      fetchDropdowns();
      setParts([]);
      setPartSearch("");
      if (editing) {
        setForm({
          partId: editing.partId,
          partnerId: editing.partnerId ?? "",
          groupId: editing.groupId,
          remark: editing.remark ?? "",
        });
        if (editing.part) {
          setParts([{ id: editing.partId, partCode: editing.part.partCode, partName: editing.part.partName }]);
        }
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, editing, fetchDropdowns]);

  const partOptions = useMemo(() =>
    parts.map(p => ({ value: p.id, label: `${p.partCode} - ${p.partName}` })),
  [parts]);

  const partnerOptions = useMemo(() => [
    { value: "", label: t("master.iqcLink.allVendors", "전체 (기본)") },
    ...partners.map(p => ({ value: p.id, label: `${p.partnerCode} - ${p.partnerName}` })),
  ], [partners, t]);

  const groupOptions = useMemo(() =>
    groups.map(g => ({ value: g.id, label: `${g.groupCode} - ${g.groupName}` })),
  [groups]);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: t("master.iqcGroup.methodFull", "전수검사"),
    SAMPLE: t("master.iqcGroup.methodSample", "샘플검사"),
    SKIP: t("master.iqcGroup.methodSkip", "무검사"),
  }), [t]);

  const selectedGroup = useMemo(() =>
    groups.find(g => g.id === form.groupId), [groups, form.groupId]);

  const handleSubmit = () => {
    if (!form.partId || !form.groupId) return;
    onSave(form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={editing ? t("master.iqcLink.editLink", "연결 수정") : t("master.iqcLink.addLink", "연결 추가")}
      size="lg">

      <div className="space-y-4">
        {/* 품목 검색 + 선택 */}
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            {t("master.iqcLink.selectPart", "품목 선택")}
          </label>
          {editing ? (
            <div className="h-10 px-3 bg-surface border border-border rounded-lg flex items-center text-sm text-text opacity-60">
              {parts[0] ? `${parts[0].partCode} - ${parts[0].partName}` : form.partId}
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder={t("master.iqcLink.partSearchPlaceholder", "품목코드 또는 품목명 입력 후 Enter")}
                  value={partSearch}
                  onChange={e => setPartSearch(e.target.value)}
                  onKeyDown={handlePartSearchKeyDown}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
                <Button variant="secondary" size="sm" onClick={() => searchParts(partSearch)}
                  disabled={!partSearch.trim() || partLoading}>
                  {t("common.search", "검색")}
                </Button>
              </div>
              {parts.length > 0 && (
                <Select options={partOptions} value={form.partId}
                  onChange={v => setForm(p => ({ ...p, partId: v }))}
                  placeholder={t("master.iqcLink.selectPartPlaceholder", "검색 결과에서 선택하세요")}
                  fullWidth />
              )}
              {partSearch && !partLoading && parts.length === 0 && (
                <p className="text-xs text-text-muted mt-1">
                  {t("master.iqcLink.noPartResult", "검색 결과가 없습니다. 다른 키워드로 검색해주세요.")}
                </p>
              )}
              {partLoading && (
                <p className="text-xs text-text-muted mt-1">{t("common.loading", "조회 중...")}</p>
              )}
            </>
          )}
        </div>

        <Select label={t("master.iqcLink.selectPartner", "거래처(공급상)")} options={partnerOptions}
          value={form.partnerId} onChange={v => setForm(p => ({ ...p, partnerId: v }))}
          fullWidth disabled={!!editing} />

        <Select label={t("master.iqcLink.selectGroup", "검사그룹")} options={groupOptions}
          value={form.groupId} onChange={v => setForm(p => ({ ...p, groupId: v }))}
          placeholder={t("master.iqcLink.selectGroupPlaceholder", "검사그룹을 선택하세요")} fullWidth />

        {/* 선택된 그룹 정보 미리보기 */}
        {selectedGroup && (
          <div className="p-3 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-text">{selectedGroup.groupName}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[selectedGroup.inspectMethod]}`}>
                {methodLabels[selectedGroup.inspectMethod]}
                {selectedGroup.inspectMethod === "SAMPLE" && selectedGroup.sampleQty ? ` (${selectedGroup.sampleQty})` : ""}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {t("master.iqcGroup.itemCount", "항목수")}: {selectedGroup.items?.length ?? 0}
            </p>
          </div>
        )}

        <Input label={t("common.remark")} value={form.remark}
          onChange={e => setForm(p => ({ ...p, remark: e.target.value }))}
          placeholder={t("master.iqcLink.remarkPlaceholder", "비고 (선택사항)")} fullWidth />
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={!form.partId || !form.groupId}>
          {editing ? t("common.edit") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
