"use client";

/**
 * @file system/training/components/TrainingResultList.tsx
 * @description 교육 결과(참석자) 목록 — 선택된 교육 계획의 참석자 관리
 *
 * 초보자 가이드:
 * 1. planId를 받아 해당 교육의 결과(참석자) 목록을 조회/표시
 * 2. 참석자 추가: workerCode 입력 후 추가 버튼
 * 3. 합격 여부는 체크박스로 토글
 * 4. COMPLETED 상태에서는 수정 불가
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { WorkerAvatar } from "@/components/worker/WorkerSelector";
import api from "@/services/api";

/** 교육 결과 행 데이터 */
interface TrainingResult {
  id?: number;
  workerCode: string;
  workerName: string;
  photoUrl?: string | null;
  dept?: string;
  attendDate: string;
  score: number | null;
  passed: boolean;
  certificateNo: string;
  validUntil: string;
}

interface Props {
  planId: number;
  planNo: string;
  status: string;
  onRefresh: () => void;
}

export default function TrainingResultList({ planId, planNo, status, onRefresh }: Props) {
  const { t } = useTranslation();
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWorkerCode, setNewWorkerCode] = useState("");
  const isReadonly = status === "COMPLETED";

  /** 결과 목록 조회 */
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/system/trainings/${planId}/results`);
      setResults(res.data?.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const handleAdd = useCallback(async () => {
    if (!newWorkerCode.trim()) return;
    try {
      await api.post(`/system/trainings/${planId}/results`, { workerCode: newWorkerCode.trim(), attendDate: new Date().toISOString().slice(0, 10), passed: false });
      setNewWorkerCode(""); fetchResults(); onRefresh();
    } catch { /* api 인터셉터 */ }
  }, [planId, newWorkerCode, fetchResults, onRefresh]);

  const handleRemove = useCallback(async (resultId: number) => {
    try { await api.delete(`/system/trainings/results/${resultId}`); fetchResults(); onRefresh(); } catch { /* api 인터셉터 */ }
  }, [fetchResults, onRefresh]);

  const handleFieldChange = useCallback(async (resultId: number, field: string, value: string | number | boolean) => {
    try { await api.patch(`/system/trainings/results/${resultId}`, { [field]: value }); fetchResults(); } catch { /* api 인터셉터 */ }
  }, [fetchResults]);

  return (
    <Card className="flex-shrink-0">
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {t("system.training.resultTitle")} - {planNo}
            <span className="text-xs text-text-muted font-normal">
              ({results.length}{t("common.count")})
            </span>
          </h3>
          {!isReadonly && (
            <div className="flex items-center gap-2">
              <Input placeholder={t("system.training.workerCode")}
                value={newWorkerCode}
                onChange={e => setNewWorkerCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                className="w-32 text-xs" />
              <Button size="sm" variant="secondary" onClick={handleAdd}
                disabled={!newWorkerCode.trim()}>
                <Plus className="w-3.5 h-3.5 mr-1" />{t("common.add")}
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-text-muted py-4 text-center">
            {t("common.loading")}
          </p>
        ) : results.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">
            {t("common.noData")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface dark:bg-slate-800">
                  {[
                    { label: `${t("system.training.workerCode")}`, cls: "text-left min-w-[160px]" },
                    { label: t("system.training.attendDate"), cls: "text-left" },
                    { label: t("system.training.score"), cls: "text-center" },
                    { label: t("system.training.passed"), cls: "text-center" },
                    { label: t("system.training.certificateNo"), cls: "text-left" },
                    { label: t("system.training.validUntil"), cls: "text-left" },
                  ].map(h => <th key={h.label} className={`px-3 py-2 font-medium text-text-muted ${h.cls}`}>{h.label}</th>)}
                  {!isReadonly && <th className="px-3 py-2 text-center font-medium text-text-muted">{t("common.manage")}</th>}
                </tr>
              </thead>
              <tbody>
                {results.map(row => {
                  const edt = (f: string, v: string | number | boolean) => row.id && handleFieldChange(row.id, f, v);
                  const inCls = "bg-transparent border-b border-border text-xs px-1 py-0.5 focus:outline-none focus:border-primary text-text";
                  return (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <WorkerAvatar name={row.workerName || row.workerCode} dept={row.dept ?? ""} photoUrl={row.photoUrl} size="md" />
                          <div>
                            <div className="font-medium text-text">{row.workerCode}</div>
                            <div className="text-[10px] text-text-muted">{row.workerName || "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        {isReadonly ? (row.attendDate?.slice(0, 10) || "-") : (
                          <input type="date" value={row.attendDate?.slice(0, 10) ?? ""} onChange={e => edt("attendDate", e.target.value)} className={inCls} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isReadonly ? <span className="font-mono">{row.score ?? "-"}</span> : (
                          <input type="number" value={row.score ?? ""} onChange={e => edt("score", Number(e.target.value))} className={`w-16 text-center font-mono ${inCls}`} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.passed} disabled={isReadonly} onChange={e => edt("passed", e.target.checked)} className="w-4 h-4 rounded text-primary cursor-pointer" />
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        {isReadonly ? (row.certificateNo || "-") : (
                          <input type="text" value={row.certificateNo ?? ""} onChange={e => edt("certificateNo", e.target.value)} className={`w-24 ${inCls}`} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        {isReadonly ? (row.validUntil?.slice(0, 10) || "-") : (
                          <input type="date" value={row.validUntil?.slice(0, 10) ?? ""} onChange={e => edt("validUntil", e.target.value)} className={inCls} />
                        )}
                      </td>
                      {!isReadonly && (
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => row.id && handleRemove(row.id)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 h-6">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
