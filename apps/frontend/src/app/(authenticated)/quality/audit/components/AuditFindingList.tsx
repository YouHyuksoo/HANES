"use client";

/**
 * @file quality/audit/components/AuditFindingList.tsx
 * @description 선택된 심사의 발견사항(Finding) 목록 카드
 *
 * 초보자 가이드:
 * 1. 심사 선택 시 해당 심사의 발견사항 목록을 표시
 * 2. 추가/삭제 기능, CAPA 연결 버튼 제공
 * 3. category는 ComCodeBadge(FINDING_CATEGORY) 사용
 * 4. API: GET/POST /quality/audits/findings, PATCH /quality/audits/findings/link-capa/:id
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Link } from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

/** 발견사항 데이터 타입 */
interface Finding {
  auditId: string;
  findingNo: number;
  clauseRef: string;
  category: string;
  description: string;
  evidence: string;
  dueDate: string;
  status: string;
  capaId: string | null;
  remark: string;
}

/** 신규 발견사항 입력 데이터 */
interface NewFinding {
  clauseRef: string;
  category: string;
  description: string;
  evidence: string;
  dueDate: string;
  remark: string;
}

const INIT_NEW: NewFinding = {
  clauseRef: "", category: "", description: "",
  evidence: "", dueDate: "", remark: "",
};

interface Props {
  auditId: string;
  auditNo: string;
}

export default function AuditFindingList({ auditId, auditNo }: Props) {
  const { t } = useTranslation();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFinding, setNewFinding] = useState<NewFinding>(INIT_NEW);
  const [saving, setSaving] = useState(false);

  /** 발견사항 조회 */
  const fetchFindings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/quality/audits/${auditId}/findings`);
      setFindings(res.data?.data ?? []);
    } catch {
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  /** 발견사항 추가 */
  const handleAdd = useCallback(async () => {
    if (!newFinding.category || !newFinding.description) return;
    setSaving(true);
    try {
      await api.post("/quality/audit-findings", {
        auditId,
        clauseRef: newFinding.clauseRef || undefined,
        category: newFinding.category,
        description: newFinding.description,
        evidence: newFinding.evidence || undefined,
        dueDate: newFinding.dueDate || undefined,
        remark: newFinding.remark || undefined,
      });
      setNewFinding(INIT_NEW);
      setShowAddForm(false);
      fetchFindings();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [auditId, newFinding, fetchFindings]);

  /** 발견사항 삭제 */
  const handleDelete = useCallback(
    async (findingAuditId: string, findingNo: number) => {
      try {
        await api.delete(`/quality/audit-findings/${findingAuditId}/${findingNo}`);
        fetchFindings();
      } catch {
        // api 인터셉터에서 처리
      }
    },
    [fetchFindings],
  );

  /** CAPA 연결 */
  const handleLinkCapa = useCallback(
    async (findingAuditId: string, findingNo: number) => {
      try {
        await api.patch(`/quality/audit-findings/${findingAuditId}/${findingNo}/link-capa`);
        fetchFindings();
      } catch {
        // api 인터셉터에서 처리
      }
    },
    [fetchFindings],
  );

  const setNewField = (key: keyof NewFinding, value: string) => {
    setNewFinding((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="flex-shrink-0">
      <CardContent>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            {t("quality.audit.finding")} - {auditNo}
          </h3>
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-1" />
            {t("common.add")}
          </Button>
        </div>

        {/* 추가 폼 */}
        {showAddForm && (
          <div className="mb-3 p-3 rounded-lg border border-border bg-surface dark:bg-slate-800 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder={t("quality.audit.clauseRef")}
                value={newFinding.clauseRef}
                onChange={(e) => setNewField("clauseRef", e.target.value)}
                fullWidth
              />
              <ComCodeSelect
                groupCode="FINDING_CATEGORY"
                includeAll={false}
                value={newFinding.category}
                onChange={(v) => setNewField("category", v)}
                fullWidth
              />
              <Input
                type="date"
                placeholder={t("quality.audit.dueDate")}
                value={newFinding.dueDate}
                onChange={(e) => setNewField("dueDate", e.target.value)}
                fullWidth
              />
            </div>
            <Input
              placeholder={t("quality.audit.description")}
              value={newFinding.description}
              onChange={(e) => setNewField("description", e.target.value)}
              fullWidth
            />
            <Input
              placeholder={t("quality.audit.evidence")}
              value={newFinding.evidence}
              onChange={(e) => setNewField("evidence", e.target.value)}
              fullWidth
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={saving || !newFinding.category || !newFinding.description}
              >
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        )}

        {/* 발견사항 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface dark:bg-slate-800">
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.audit.findingNo")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.audit.clauseRef")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.audit.category")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.audit.description")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.audit.dueDate")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("common.status")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">CAPA</th>
                <th className="px-3 py-2 text-center font-medium text-text-muted">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-text-muted">
                    {t("common.loading")}
                  </td>
                </tr>
              )}
              {!loading && findings.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-text-muted">
                    {t("common.noData")}
                  </td>
                </tr>
              )}
              {findings.map((f) => (
                <tr key={`${f.auditId}-${f.findingNo}`} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-primary">{f.findingNo}</td>
                  <td className="px-3 py-2 text-text">{f.clauseRef || "-"}</td>
                  <td className="px-3 py-2">
                    <ComCodeBadge groupCode="FINDING_CATEGORY" code={f.category} />
                  </td>
                  <td className="px-3 py-2 text-text max-w-[200px] truncate">{f.description}</td>
                  <td className="px-3 py-2 text-text-muted">{f.dueDate?.slice(0, 10) || "-"}</td>
                  <td className="px-3 py-2">
                    <ComCodeBadge groupCode="FINDING_STATUS" code={f.status} />
                  </td>
                  <td className="px-3 py-2 text-text-muted">{f.capaId ?? "-"}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {!f.capaId && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleLinkCapa(f.auditId, f.findingNo)}
                          className="text-[10px] px-1.5 py-0.5 h-6"
                        >
                          <Link className="w-3 h-3 mr-0.5" />
                          {t("quality.audit.linkCapa")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(f.auditId, f.findingNo)}
                        className="text-[10px] px-1.5 py-0.5 h-6 text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
