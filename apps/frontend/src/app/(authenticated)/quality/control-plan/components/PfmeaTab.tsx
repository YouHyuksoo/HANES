'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
import { ComCodeSelect } from '@/components/shared';
import { formatDateOnly } from '@/utils/date';
import { controlPlanApi, type QualityPlanPackage, type QualityRevision } from '../controlPlanApi';
import { pfmeaColumns } from '../editors/pfmeaColumns';
import DocumentTable from './DocumentTable';
import RowDeleteButton from './RowDeleteButton';

export default function PfmeaTab({
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
  const [participants, setParticipants] = useState<Record<string, unknown>[]>([]);
  const [participantForm, setParticipantForm] = useState({ userName: '', organization: '' });
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    processFlowRowId: 0,
    processFunction: '',
    requirement: '',
    potentialFailureMode: '',
    potentialFailureEffect: '',
    severity: 1,
    specialCharacteristicCode: '',
    potentialCause: '',
    preventionControl: '',
    occurrence: 1,
    detectionControl: '',
    detection: 1,
    recommendedAction: '',
    responsibleOrganization: '',
    responsiblePerson: '',
    targetDate: '',
    completedAction: '',
    completionDate: '',
    actionSeverity: 0,
    actionOccurrence: 0,
    actionDetection: 0,
  });
  const pfdRevision = pkg.documents
    .find((document) => document.documentType === 'PFD')
    ?.revisions.find((item) => item.revisionId === revision.refPfdRevisionId);
  const load = useCallback(async () => {
    const [nextRows, nextParticipants, nextPfdRows] = await Promise.all([
      controlPlanApi.getRows(revision.revisionId, 'PFMEA'),
      controlPlanApi.listParticipants(revision.revisionId),
      pfdRevision ? controlPlanApi.getRows(pfdRevision.revisionId, 'PFD') : Promise.resolve([]),
    ]);
    setRows(nextRows); setParticipants(nextParticipants); setPfdRows(nextPfdRows);
  }, [revision, pfdRevision]);
  useEffect(() => {
    void load();
  }, [load]);
  const rpn = useMemo(
    () => form.severity * form.occurrence * form.detection,
    [form.severity, form.occurrence, form.detection]
  );
  const actionRpn = form.actionSeverity && form.actionOccurrence && form.actionDetection
    ? form.actionSeverity * form.actionOccurrence * form.actionDetection
    : 0;
  const create = async () => {
    setBusy(true);
    try {
      const input = {
        ...form,
        actionSeverity: form.actionSeverity || undefined,
        actionOccurrence: form.actionOccurrence || undefined,
        actionDetection: form.actionDetection || undefined,
      };
      if (editId) await controlPlanApi.updateRow(editId, 'PFMEA', input);
      else await controlPlanApi.createRow(revision.revisionId, 'PFMEA', input);
      await load();
      setEditId(null);
    } catch {
      toast.error('PFMEA 행을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const edit = (row: Record<string, unknown>) => {
    setEditId(Number(row.ROW_ID));
    setForm({
      ...form,
      processFlowRowId: Number(row.PROCESS_FLOW_ROW_ID),
      processFunction: String(row.PROCESS_FUNCTION ?? ''),
      requirement: String(row.REQUIREMENT ?? ''),
      potentialFailureMode: String(row.FAILURE_MODE ?? ''),
      potentialFailureEffect: String(row.FAILURE_EFFECT ?? ''),
      severity: Number(row.SEVERITY ?? 1),
      specialCharacteristicCode: String(row.SPECIAL_CHAR_CODE ?? ''),
      potentialCause: String(row.FAILURE_CAUSE ?? ''),
      preventionControl: String(row.PREVENTION_CONTROL ?? ''),
      occurrence: Number(row.OCCURRENCE ?? 1),
      detectionControl: String(row.DETECTION_CONTROL ?? ''),
      detection: Number(row.DETECTION ?? 1),
      recommendedAction: String(row.RECOMMENDED_ACTION ?? ''),
      responsibleOrganization: String(row.RESPONSIBLE_ORG ?? ''),
      responsiblePerson: String(row.RESPONSIBLE_PERSON ?? ''),
      targetDate: formatDateOnly(row.TARGET_DATE as string | Date | null),
      completedAction: String(row.COMPLETED_ACTION ?? ''),
      completionDate: formatDateOnly(row.COMPLETION_DATE as string | Date | null),
      actionSeverity: Number(row.ACTION_SEVERITY ?? 0),
      actionOccurrence: Number(row.ACTION_OCCURRENCE ?? 0),
      actionDetection: Number(row.ACTION_DETECTION ?? 0),
    });
  };
  const remove = async (rowId: number) => {
    try {
      await controlPlanApi.deleteRow(rowId, 'PFMEA');
      await load();
    } catch {
      toast.error('참조 중인 PFMEA 행은 삭제할 수 없습니다.');
    }
  };
  const addParticipant = async () => {
    if (!participantForm.userName.trim()) return;
    setBusy(true);
    try {
      await controlPlanApi.createParticipant(revision.revisionId, participantForm);
      setParticipantForm({ userName: '', organization: '' });
      await load();
    } catch { toast.error('CFT 참여자를 추가하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const removeParticipant = async (participantId: number) => {
    try { await controlPlanApi.deleteParticipant(participantId); await load(); }
    catch { toast.error('CFT 참여자를 삭제하지 못했습니다.'); }
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="shrink-0 rounded-lg border border-border bg-background p-3" aria-label="PFMEA CFT 참여자">
        <div className="flex flex-wrap items-end gap-2">
          <div className="mr-auto"><h3 className="text-sm font-bold text-text">Core Team / CFT</h3><p className="text-xs text-text-muted">PFMEA 작성에 참여한 부서와 담당자를 Revision별로 기록합니다.</p></div>
          {!readOnly && <><Input label="조직" value={participantForm.organization} onChange={(e) => setParticipantForm({ ...participantForm, organization: e.target.value })} /><Input label="참여자명" value={participantForm.userName} onChange={(e) => setParticipantForm({ ...participantForm, userName: e.target.value })} /><Button size="sm" disabled={busy || !participantForm.userName.trim()} onClick={() => void addParticipant()}>참여자 추가</Button></>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">{participants.map((participant) => <span key={String(participant.PARTICIPANT_ID)} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text"><b>{String(participant.ORGANIZATION ?? '-')}</b>{String(participant.USER_NAME)}{!readOnly && <RowDeleteButton label="참여자 삭제" title="CFT 참여자 삭제" message="이 Revision에서 선택한 CFT 참여자를 삭제하시겠습니까?" onConfirm={() => removeParticipant(Number(participant.PARTICIPANT_ID))} />}</span>)}{participants.length === 0 && <span className="text-xs text-text-muted">등록된 CFT 참여자가 없습니다.</span>}</div>
      </section>
      {!readOnly && (
        <div className="grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3 lg:grid-cols-6">
          <label className="text-xs text-text-muted">
            PFD 공정
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
              value={form.processFlowRowId}
              onChange={(e) => setForm({ ...form, processFlowRowId: Number(e.target.value) })}
            >
              <option value={0}>선택</option>
              {pfdRows.map((row) => (
                <option key={String(row.ROW_ID)} value={Number(row.ROW_ID)}>
                  {String(row.PROCESS_NO)} · {String(row.PROCESS_NAME)}
                </option>
              ))}
            </select>
          </label>
          <Input
            placeholder="공정 기능"
            value={form.processFunction}
            onChange={(e) => setForm({ ...form, processFunction: e.target.value })}
          />
          <Input
            placeholder="요구사항"
            value={form.requirement}
            onChange={(e) => setForm({ ...form, requirement: e.target.value })}
          />
          <Input
            placeholder="잠재 고장형태"
            value={form.potentialFailureMode}
            onChange={(e) => setForm({ ...form, potentialFailureMode: e.target.value })}
          />
          <Input
            placeholder="잠재 영향"
            value={form.potentialFailureEffect}
            onChange={(e) => setForm({ ...form, potentialFailureEffect: e.target.value })}
          />
          <Input
            placeholder="잠재 원인"
            value={form.potentialCause}
            onChange={(e) => setForm({ ...form, potentialCause: e.target.value })}
          />
          <Input placeholder="예방 관리" value={form.preventionControl} onChange={(e) => setForm({ ...form, preventionControl: e.target.value })} />
          <Input placeholder="검출 관리" value={form.detectionControl} onChange={(e) => setForm({ ...form, detectionControl: e.target.value })} />
          <Input
            type="number"
            min={1}
            max={10}
            label="심각도 S"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
          />
          <Input
            type="number"
            min={1}
            max={10}
            label="발생도 O"
            value={form.occurrence}
            onChange={(e) => setForm({ ...form, occurrence: Number(e.target.value) })}
          />
          <Input
            type="number"
            min={1}
            max={10}
            label="검출도 D"
            value={form.detection}
            onChange={(e) => setForm({ ...form, detection: Number(e.target.value) })}
          />
          <ComCodeSelect
            groupCode="QC_SPECIAL_CHAR"
            includeAll
            value={form.specialCharacteristicCode}
            onChange={(specialCharacteristicCode) =>
              setForm({ ...form, specialCharacteristicCode })
            }
          />
          <div className="flex items-end rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <span className="text-text-muted">RPN</span>
            <strong className={`ml-auto text-lg ${rpn >= 100 ? 'text-red-500' : 'text-primary'}`}>
              {rpn}
            </strong>
          </div>
          <Input placeholder="권고 조치" value={form.recommendedAction} onChange={(e) => setForm({ ...form, recommendedAction: e.target.value })} />
          <Input placeholder="책임 조직" value={form.responsibleOrganization} onChange={(e) => setForm({ ...form, responsibleOrganization: e.target.value })} />
          <Input placeholder="책임자" value={form.responsiblePerson} onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })} />
          <Input type="date" label="목표일" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          <Input placeholder="완료 조치" value={form.completedAction} onChange={(e) => setForm({ ...form, completedAction: e.target.value })} />
          <Input type="date" label="완료일" value={form.completionDate} onChange={(e) => setForm({ ...form, completionDate: e.target.value })} />
          <Input type="number" min={0} max={10} label="조치 후 S" value={form.actionSeverity} onChange={(e) => setForm({ ...form, actionSeverity: Number(e.target.value) })} />
          <Input type="number" min={0} max={10} label="조치 후 O" value={form.actionOccurrence} onChange={(e) => setForm({ ...form, actionOccurrence: Number(e.target.value) })} />
          <Input type="number" min={0} max={10} label="조치 후 D" value={form.actionDetection} onChange={(e) => setForm({ ...form, actionDetection: Number(e.target.value) })} />
          <div className="flex items-end rounded-md border border-border bg-surface px-3 py-2 text-sm"><span className="text-text-muted">조치 후 RPN</span><strong className="ml-auto text-lg text-primary">{actionRpn || '-'}</strong></div>
          <Button
            size="sm"
            disabled={
              !form.processFlowRowId ||
              !pfdRows.some((row) => Number(row.ROW_ID) === form.processFlowRowId) ||
              !form.processFunction ||
              !form.requirement ||
              !form.potentialFailureMode ||
              !form.potentialFailureEffect ||
              !form.potentialCause ||
              busy
            }
            onClick={() => void create()}
          >
            <Plus className="mr-1 h-4 w-4" />
            {editId ? '행 수정' : '행 추가'}
          </Button>
        </div>
      )}
      <DocumentTable
        columns={pfmeaColumns}
        rows={rows}
        focusRowId={focusRowId}
        empty="PFMEA 행이 없습니다."
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
