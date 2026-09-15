'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
import { ComCodeSelect } from '@/components/shared';
import { controlPlanApi, type QualityPlanPackage, type QualityRevision } from '../controlPlanApi';
import { controlPlanItemColumns } from '../editors/controlPlanItemColumns';
import DocumentTable from './DocumentTable';
import RowDeleteButton from './RowDeleteButton';

export default function ControlPlanTab({
  pkg,
  revision,
  readOnly,
  focusRowId,
}: {
  pkg: QualityPlanPackage;
  revision: QualityRevision;
  readOnly: boolean;
  focusRowId: number | null;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pfdRows, setPfdRows] = useState<Record<string, unknown>[]>([]);
  const [pfmeaRows, setPfmeaRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    processFlowRowId: 0,
    pfmeaRowId: 0,
    characteristicNo: '',
    productCharacteristic: '',
    processCharacteristic: '',
    specialCharacteristicCode: '',
    specification: '',
    evaluationMethod: '',
    sampleSize: '',
    sampleFrequency: '',
    controlMethod: '',
    responsibleRole: '',
    reactionPlan: '',
    recordForm: '',
  });
  const pfdRevision = pkg.documents.find((document) => document.documentType === 'PFD')
    ?.revisions.find((item) => item.revisionId === revision.refPfdRevisionId);
  const pfmeaRevision = pkg.documents.find((document) => document.documentType === 'PFMEA')
    ?.revisions.find((item) => item.revisionId === revision.refPfmeaRevisionId);
  const load = useCallback(async () => {
    setRows(await controlPlanApi.getRows(revision.revisionId, 'CONTROL_PLAN'));
    if (pfdRevision) setPfdRows(await controlPlanApi.getRows(pfdRevision.revisionId, 'PFD'));
    if (pfmeaRevision)
      setPfmeaRows(await controlPlanApi.getRows(pfmeaRevision.revisionId, 'PFMEA'));
  }, [revision, pfdRevision, pfmeaRevision]);
  useEffect(() => {
    void load();
  }, [load]);
  const create = async () => {
    setBusy(true);
    try {
      const input = { ...form, pfmeaRowId: form.pfmeaRowId || null };
      if (editId) await controlPlanApi.updateRow(editId, 'CONTROL_PLAN', input);
      else await controlPlanApi.createRow(revision.revisionId, 'CONTROL_PLAN', input);
      await load();
      setEditId(null);
    } catch {
      toast.error('Control Plan 행을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const edit = (row: Record<string, unknown>) => {
    setEditId(Number(row.ROW_ID));
    setForm({
      processFlowRowId: Number(row.PROCESS_FLOW_ROW_ID),
      pfmeaRowId: Number(row.PFMEA_ROW_ID ?? 0),
      characteristicNo: String(row.CHARACTERISTIC_NO ?? ''),
      productCharacteristic: String(row.PRODUCT_CHARACTERISTIC ?? ''),
      processCharacteristic: String(row.PROCESS_CHARACTERISTIC ?? ''),
      specialCharacteristicCode: String(row.SPECIAL_CHAR_CODE ?? ''),
      specification: String(row.SPECIFICATION ?? ''),
      evaluationMethod: String(row.EVALUATION_METHOD ?? ''),
      sampleSize: String(row.SAMPLE_SIZE ?? ''),
      sampleFrequency: String(row.SAMPLE_FREQUENCY ?? ''),
      controlMethod: String(row.CONTROL_METHOD ?? ''),
      responsibleRole: String(row.RESPONSIBLE_ROLE ?? ''),
      reactionPlan: String(row.REACTION_PLAN ?? ''),
      recordForm: String(row.RECORD_FORM ?? ''),
    });
  };
  const remove = async (rowId: number) => {
    try {
      await controlPlanApi.deleteRow(rowId, 'CONTROL_PLAN');
      await load();
    } catch {
      toast.error('관리계획 행을 삭제하지 못했습니다.');
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!readOnly && (
        <div className="shrink-0 rounded-lg border border-border bg-background p-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <label className="text-xs text-text-muted">
              PFD 공정
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
                value={form.processFlowRowId}
                onChange={(e) =>
                  setForm({ ...form, processFlowRowId: Number(e.target.value), pfmeaRowId: 0 })
                }
              >
                <option value={0}>선택</option>
                {pfdRows.map((row) => (
                  <option key={String(row.ROW_ID)} value={Number(row.ROW_ID)}>
                    {String(row.PROCESS_NO)} · {String(row.PROCESS_NAME)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-muted">
              PFMEA 연결
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
                value={form.pfmeaRowId}
                onChange={(e) => setForm({ ...form, pfmeaRowId: Number(e.target.value) })}
              >
                <option value={0}>선택 안 함</option>
                {pfmeaRows
                  .filter((row) => Number(row.PROCESS_FLOW_ROW_ID) === form.processFlowRowId)
                  .map((row) => (
                    <option key={String(row.ROW_ID)} value={Number(row.ROW_ID)}>
                      {String(row.FAILURE_MODE)}
                    </option>
                  ))}
              </select>
            </label>
            <Input
              placeholder="특성번호"
              value={form.characteristicNo}
              onChange={(e) => setForm({ ...form, characteristicNo: e.target.value })}
            />
            <Input
              placeholder="제품특성"
              value={form.productCharacteristic}
              onChange={(e) => setForm({ ...form, productCharacteristic: e.target.value })}
            />
            <Input
              placeholder="공정특성"
              value={form.processCharacteristic}
              onChange={(e) => setForm({ ...form, processCharacteristic: e.target.value })}
            />
            <ComCodeSelect
              groupCode="QC_SPECIAL_CHAR"
              includeAll
              value={form.specialCharacteristicCode}
              onChange={(specialCharacteristicCode) =>
                setForm({ ...form, specialCharacteristicCode })
              }
            />
            <Input
              placeholder="시료수"
              value={form.sampleSize}
              onChange={(e) => setForm({ ...form, sampleSize: e.target.value })}
            />
            <Input
              placeholder="검사주기"
              value={form.sampleFrequency}
              onChange={(e) => setForm({ ...form, sampleFrequency: e.target.value })}
            />
            <Input
              placeholder="담당 역할"
              value={form.responsibleRole}
              onChange={(e) => setForm({ ...form, responsibleRole: e.target.value })}
            />
            <Input
              placeholder="기록 양식"
              value={form.recordForm}
              onChange={(e) => setForm({ ...form, recordForm: e.target.value })}
            />
            <Input
              placeholder="평가방법"
              value={form.evaluationMethod}
              onChange={(e) => setForm({ ...form, evaluationMethod: e.target.value })}
            />
            <Button
              size="sm"
              disabled={
                !form.processFlowRowId ||
                !pfdRows.some((row) => Number(row.ROW_ID) === form.processFlowRowId) ||
                (form.pfmeaRowId > 0 && !pfmeaRows.some((row) => Number(row.ROW_ID) === form.pfmeaRowId)) ||
                !form.specification ||
                !form.evaluationMethod ||
                !form.sampleSize ||
                !form.controlMethod ||
                !form.reactionPlan ||
                busy
              }
              onClick={() => void create()}
            >
              <Plus className="mr-1 h-4 w-4" />
              {editId ? '행 수정' : '행 추가'}
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            <label className="text-xs text-text-muted">
              규격·공차
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                value={form.specification}
                onChange={(e) => setForm({ ...form, specification: e.target.value })}
              />
            </label>
            <label className="text-xs text-text-muted">
              관리방법
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                value={form.controlMethod}
                onChange={(e) => setForm({ ...form, controlMethod: e.target.value })}
              />
            </label>
            <label className="text-xs text-text-muted">
              이상 발생 반응계획
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                value={form.reactionPlan}
                onChange={(e) => setForm({ ...form, reactionPlan: e.target.value })}
              />
            </label>
          </div>
        </div>
      )}
      <DocumentTable
        columns={controlPlanItemColumns}
        rows={rows}
        focusRowId={focusRowId}
        empty="관리계획 항목이 없습니다."
        actions={
          !readOnly
            ? (row) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => edit(row)}>
                    수정
                  </Button>
                  <RowDeleteButton onConfirm={() => remove(Number(row.ROW_ID))} />
                </div>
              )
            : undefined
        }
      />
    </div>
  );
}
