"use client";

/**
 * @file quality/msa/components/CalibrationList.tsx
 * @description 선택된 계측기의 교정 이력 목록 + 교정 등록 폼
 *
 * 초보자 가이드:
 * 1. gaugeId를 받아 해당 계측기의 교정 로그를 DataGrid로 표시
 * 2. "교정추가" 버튼으로 간단한 인라인 폼을 토글
 * 3. 교정결과(ComCodeBadge)로 PASS/FAIL 등 표시
 * 4. API: GET /quality/calibrations?gaugeId=, POST /quality/calibrations
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X } from "lucide-react";
import { Button, Input, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

/** 교정 로그 타입 */
interface CalibrationLog {
  id: number;
  calibrationNo: string;
  calibrationDate: string;
  calibrationType: string;
  calibrator: string;
  calibrationOrg: string;
  result: string;
  measuredValue: string;
  referenceValue: string;
  deviation: string;
  uncertainty: string;
  certificateNo: string;
}

/** 교정 등록 폼 */
interface CalibrationForm {
  calibrationDate: string;
  calibrationType: string;
  calibrator: string;
  calibrationOrg: string;
  result: string;
  measuredValue: string;
  referenceValue: string;
  deviation: string;
  uncertainty: string;
  certificateNo: string;
}

const INIT_FORM: CalibrationForm = {
  calibrationDate: "", calibrationType: "", calibrator: "", calibrationOrg: "",
  result: "", measuredValue: "", referenceValue: "", deviation: "",
  uncertainty: "", certificateNo: "",
};

interface Props {
  gaugeId: number;
  onCalibrationAdded?: () => void;
}

export default function CalibrationList({ gaugeId, onCalibrationAdded }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<CalibrationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CalibrationForm>(INIT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/calibrations", { params: { gaugeId } });
      setData(res.data?.data ?? []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [gaugeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key: keyof CalibrationForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleAdd = useCallback(async () => {
    if (!form.calibrationDate || !form.result) return;
    setSaving(true);
    try {
      await api.post("/quality/calibrations", { gaugeId, ...form });
      setForm(INIT_FORM);
      setShowForm(false);
      fetchData();
      onCalibrationAdded?.();
    } catch { /* api 인터셉터 처리 */ } finally { setSaving(false); }
  }, [form, gaugeId, fetchData, onCalibrationAdded]);

  const columns = useMemo<ColumnDef<CalibrationLog>[]>(() => [
    { accessorKey: "calibrationNo", header: t("quality.msa.calibrationNo"), size: 140 },
    { accessorKey: "calibrationDate", header: t("quality.msa.calibrationDate"), size: 110,
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
    { accessorKey: "calibrationType", header: t("quality.msa.calibrationType"), size: 100,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAL_TYPE" code={getValue() as string} /> },
    { accessorKey: "calibrator", header: t("quality.msa.calibrator"), size: 100 },
    { accessorKey: "calibrationOrg", header: t("quality.msa.calibrationOrg"), size: 120 },
    { accessorKey: "result", header: t("quality.msa.result"), size: 90,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAL_RESULT" code={getValue() as string} /> },
    { accessorKey: "measuredValue", header: t("quality.msa.measuredValue"), size: 100 },
    { accessorKey: "referenceValue", header: t("quality.msa.referenceValue"), size: 100 },
    { accessorKey: "deviation", header: t("quality.msa.deviation"), size: 80 },
    { accessorKey: "uncertainty", header: t("quality.msa.uncertainty"), size: 90 },
    { accessorKey: "certificateNo", header: t("quality.msa.certificateNo"), size: 130 },
  ], [t]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 헤더 + 추가 버튼 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-bold text-text">{t("quality.msa.calibrationHistory")}</h3>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? t("common.cancel") : t("quality.msa.addCalibration")}
        </Button>
      </div>

      {/* 인라인 등록 폼 */}
      {showForm && (
        <div className="border border-border rounded-lg p-3 bg-white dark:bg-slate-900 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <Input label={t("quality.msa.calibrationDate")} type="date" value={form.calibrationDate}
              onChange={e => setField("calibrationDate", e.target.value)} fullWidth />
            <ComCodeSelect groupCode="CAL_TYPE" includeAll={false}
              label={t("quality.msa.calibrationType")} value={form.calibrationType}
              onChange={v => setField("calibrationType", v)} fullWidth />
            <ComCodeSelect groupCode="CAL_RESULT" includeAll={false}
              label={t("quality.msa.result")} value={form.result}
              onChange={v => setField("result", v)} fullWidth />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input label={t("quality.msa.calibrator")} value={form.calibrator}
              onChange={e => setField("calibrator", e.target.value)} fullWidth />
            <Input label={t("quality.msa.calibrationOrg")} value={form.calibrationOrg}
              onChange={e => setField("calibrationOrg", e.target.value)} fullWidth />
            <Input label={t("quality.msa.certificateNo")} value={form.certificateNo}
              onChange={e => setField("certificateNo", e.target.value)} fullWidth />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input label={t("quality.msa.measuredValue")} value={form.measuredValue}
              onChange={e => setField("measuredValue", e.target.value)} fullWidth />
            <Input label={t("quality.msa.referenceValue")} value={form.referenceValue}
              onChange={e => setField("referenceValue", e.target.value)} fullWidth />
            <Input label={t("quality.msa.deviation")} value={form.deviation}
              onChange={e => setField("deviation", e.target.value)} fullWidth />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input label={t("quality.msa.uncertainty")} value={form.uncertainty}
              onChange={e => setField("uncertainty", e.target.value)} fullWidth />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={saving || !form.calibrationDate || !form.result}>
              {saving ? t("common.saving") : t("common.add")}
            </Button>
          </div>
        </div>
      )}

      {/* 교정 이력 DataGrid */}
      <div className="flex-1 min-h-0">
        <DataGrid data={data} columns={columns} isLoading={loading}
          getRowId={row => String((row as CalibrationLog).id)} />
      </div>
    </div>
  );
}
