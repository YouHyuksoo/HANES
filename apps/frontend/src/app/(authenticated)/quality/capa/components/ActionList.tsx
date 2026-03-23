"use client";

/**
 * @file quality/capa/components/ActionList.tsx
 * @description CAPA 조치항목 목록 — 테이블 형태로 추가/수정 인라인 기능
 *
 * 초보자 가이드:
 * 1. capaId를 받아 조치항목 목록을 조회
 * 2. 인라인 추가/수정 가능 (상태별 DONE 처리)
 * 3. ComCodeBadge로 상태 표시
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, X } from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge } from "@/components/ui";
import api from "@/services/api";

interface ActionItem {
  seq: number;
  actionDesc: string;
  responsibleCode: string;
  dueDate: string;
  status: string;
  result: string;
  completedAt: string;
}

interface Props {
  capaId: string;
  capaStatus: string;
  onUpdate: () => void;
}

export default function ActionList({ capaId, capaStatus, onUpdate }: Props) {
  const { t } = useTranslation();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ actionDesc: "", responsibleCode: "", dueDate: "", result: "", status: "" });

  const fetchActions = useCallback(async () => {
    try {
      const res = await api.get(`/quality/capas/${capaId}`);
      setActions(res.data?.data?.actions ?? []);
    } catch {
      setActions([]);
    }
  }, [capaId]);

  useEffect(() => { fetchActions(); }, [fetchActions]);

  const canEdit = !["CLOSED"].includes(capaStatus);

  const handleAdd = async () => {
    if (!form.actionDesc) return;
    try {
      await api.post(`/quality/capas/${capaId}/actions`, {
        seq: actions.length + 1,
        actionDesc: form.actionDesc,
        responsibleCode: form.responsibleCode || undefined,
        dueDate: form.dueDate || undefined,
      });
      setForm({ actionDesc: "", responsibleCode: "", dueDate: "", result: "", status: "" });
      setIsAdding(false);
      fetchActions();
      onUpdate();
    } catch { /* api 인터셉터 */ }
  };

  const handleUpdate = async (actionId: number) => {
    try {
      await api.patch(`/quality/capas/${capaId}/actions/${actionId}`, {
        actionDesc: form.actionDesc || undefined,
        responsibleCode: form.responsibleCode || undefined,
        dueDate: form.dueDate || undefined,
        result: form.result || undefined,
        status: form.status || undefined,
      });
      setEditingId(null);
      setForm({ actionDesc: "", responsibleCode: "", dueDate: "", result: "", status: "" });
      fetchActions();
      onUpdate();
    } catch { /* api 인터셉터 */ }
  };

  const startEdit = (item: ActionItem) => {
    setEditingId(item.seq);
    setForm({
      actionDesc: item.actionDesc ?? "",
      responsibleCode: item.responsibleCode ?? "",
      dueDate: item.dueDate?.slice(0, 10) ?? "",
      result: item.result ?? "",
      status: item.status ?? "",
    });
  };

  return (
    <Card className="flex-shrink-0">
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text">{t("quality.capa.actionItems")}</h3>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => { setIsAdding(true); setForm({ actionDesc: "", responsibleCode: "", dueDate: "", result: "", status: "" }); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />{t("quality.capa.addAction")}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface dark:bg-slate-800">
                <th className="px-3 py-2 text-left font-medium text-text-muted w-12">#</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.capa.actionDesc")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted w-24">{t("quality.capa.responsible")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted w-28">{t("quality.capa.dueDate")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted w-20">{t("common.status")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.capa.actionResult")}</th>
                {canEdit && <th className="px-3 py-2 text-center font-medium text-text-muted w-20">{t("common.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {actions.map(item => (
                <tr key={item.seq} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                  {editingId === item.seq ? (
                    <>
                      <td className="px-3 py-2 text-text-muted">{item.seq}</td>
                      <td className="px-3 py-2"><Input value={form.actionDesc} onChange={e => setForm(p => ({ ...p, actionDesc: e.target.value }))} fullWidth className="text-xs" /></td>
                      <td className="px-3 py-2"><Input value={form.responsibleCode} onChange={e => setForm(p => ({ ...p, responsibleCode: e.target.value }))} fullWidth className="text-xs" /></td>
                      <td className="px-3 py-2"><Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} fullWidth className="text-xs" /></td>
                      <td className="px-3 py-2">
                        <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
                          <option value="PENDING">PENDING</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="DONE">DONE</option>
                        </select>
                      </td>
                      <td className="px-3 py-2"><Input value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))} fullWidth className="text-xs" /></td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="primary" onClick={() => handleUpdate(item.seq)} className="px-1.5 py-0.5 h-6"><Save className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="px-1.5 py-0.5 h-6"><X className="w-3 h-3" /></Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-text-muted">{item.seq}</td>
                      <td className="px-3 py-2 text-text">{item.actionDesc}</td>
                      <td className="px-3 py-2 text-text-muted">{item.responsibleCode || "-"}</td>
                      <td className="px-3 py-2 text-text-muted">{item.dueDate?.slice(0, 10) || "-"}</td>
                      <td className="px-3 py-2"><ComCodeBadge groupCode="CAPA_ACTION_STATUS" code={item.status} /></td>
                      <td className="px-3 py-2 text-text-muted">{item.result || "-"}</td>
                      {canEdit && (
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(item)} className="text-[10px] px-1.5 py-0.5 h-6">
                            {t("common.edit")}
                          </Button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}

              {/* 인라인 추가 행 */}
              {isAdding && (
                <tr className="border-b border-border/50 bg-primary/5 dark:bg-primary/10">
                  <td className="px-3 py-2 text-text-muted">{actions.length + 1}</td>
                  <td className="px-3 py-2"><Input value={form.actionDesc} onChange={e => setForm(p => ({ ...p, actionDesc: e.target.value }))} placeholder={t("quality.capa.actionDesc")} fullWidth className="text-xs" /></td>
                  <td className="px-3 py-2"><Input value={form.responsibleCode} onChange={e => setForm(p => ({ ...p, responsibleCode: e.target.value }))} fullWidth className="text-xs" /></td>
                  <td className="px-3 py-2"><Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} fullWidth className="text-xs" /></td>
                  <td className="px-3 py-2 text-text-muted">PENDING</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="primary" onClick={handleAdd} className="px-1.5 py-0.5 h-6"><Save className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="px-1.5 py-0.5 h-6"><X className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              )}

              {actions.length === 0 && !isAdding && (
                <tr><td colSpan={7} className="text-center text-text-muted py-6">{t("common.noData")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
