'use client';

import { useCallback, useEffect, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '@/components/ui';
import { ComCodeSelect, EquipSelect, ProcessSelect } from '@/components/shared';
import { useProcessOptions } from '@/hooks/useMasterOptions';
import { controlPlanApi, type QualityRevision } from '../controlPlanApi';
import { processFlowColumns } from '../editors/processFlowColumns';
import DocumentTable from './DocumentTable';
import RowDeleteButton from './RowDeleteButton';

export default function ProcessFlowTab({
  revision,
  readOnly,
  focusRowId,
}: {
  revision: QualityRevision;
  readOnly: boolean;
  focusRowId: number | null;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const { rawData: processes } = useProcessOptions();
  const [form, setForm] = useState({
    processNo: '',
    processCode: '',
    processName: '',
    equipmentCode: '',
    equipmentName: '',
    lane: 'MAIN',
    symbol: 'OPERATION',
    description: '',
  });
  const load = useCallback(
    async () => setRows(await controlPlanApi.getRows(revision.revisionId, 'PFD')),
    [revision]
  );
  useEffect(() => {
    void load();
  }, [load]);
  const create = async () => {
    setBusy(true);
    try {
      if (editId) await controlPlanApi.updateRow(editId, 'PFD', form);
      else await controlPlanApi.createRow(revision.revisionId, 'PFD', form);
      await load();
      setEditId(null);
      setForm({
        ...form,
        processNo: '',
        processCode: '',
        processName: '',
        equipmentCode: '',
        equipmentName: '',
        description: '',
      });
    } catch {
      toast.error('PFD 행을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const edit = (row: Record<string, unknown>) => {
    setEditId(Number(row.ROW_ID));
    setForm({
      processNo: String(row.PROCESS_NO ?? ''),
      processCode: String(row.PROCESS_CODE ?? ''),
      processName: String(row.PROCESS_NAME ?? ''),
      equipmentCode: String(row.EQUIPMENT_CODE ?? ''),
      equipmentName: String(row.EQUIPMENT_NAME ?? ''),
      lane: String(row.FLOW_LANE ?? 'MAIN'),
      symbol: String(row.FLOW_SYMBOL ?? 'OPERATION'),
      description: String(row.DESCRIPTION ?? ''),
    });
  };
  const remove = async (rowId: number) => {
    try {
      await controlPlanApi.deleteRow(rowId, 'PFD');
      await load();
    } catch {
      toast.error('참조 중인 PFD 행은 삭제할 수 없습니다.');
    }
  };
  const move = async (index: number, offset: number) => {
    const next = [...rows];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await controlPlanApi.reorderPfdRows(
      revision.revisionId,
      next.map((row) => Number(row.ROW_ID ?? row.row_id))
    );
    await load();
  };
  const reorder = async (sourceId: number, targetId: number) => {
    const next = [...rows]; const source = next.findIndex((row) => Number(row.ROW_ID) === sourceId); const target = next.findIndex((row) => Number(row.ROW_ID) === targetId);
    if (source < 0 || target < 0) return;
    const [moved] = next.splice(source, 1); next.splice(target, 0, moved);
    await controlPlanApi.reorderPfdRows(revision.revisionId, next.map((row) => Number(row.ROW_ID ?? row.row_id))); await load();
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!readOnly && (
        <div className="grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3 lg:grid-cols-8">
          <Input
            placeholder="공정번호"
            value={form.processNo}
            onChange={(e) => setForm({ ...form, processNo: e.target.value })}
          />
          <ProcessSelect
            value={form.processCode}
            onChange={(processCode) => {
              const process = processes.find((item) => item.processCode === processCode);
              setForm({ ...form, processCode, processName: process?.processName ?? '' });
            }}
          />
          <Input placeholder="공정명" value={form.processName} disabled />
          <EquipSelect
            processCode={form.processCode}
            value={form.equipmentCode}
            onChange={(equipmentCode) => setForm({ ...form, equipmentCode })}
          />
          <ComCodeSelect
            groupCode="QC_PFD_LANE"
            includeAll={false}
            value={form.lane}
            onChange={(lane) => setForm({ ...form, lane })}
          />
          <ComCodeSelect
            groupCode="QC_PFD_SYMBOL"
            includeAll={false}
            value={form.symbol}
            onChange={(symbol) => setForm({ ...form, symbol })}
          />
          <Input
            placeholder="설명"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Button
            size="sm"
            disabled={!form.processNo || !form.processCode || !form.processName || busy}
            onClick={() => void create()}
          >
            <Plus className="mr-1 h-4 w-4" />
            {editId ? '행 수정' : '행 추가'}
          </Button>
        </div>
      )}
      <DocumentTable
        columns={processFlowColumns}
        rows={rows}
        focusRowId={focusRowId}
        empty="공정흐름 행이 없습니다. 자동 초안 또는 행 추가를 사용하세요."
        onReorder={readOnly ? undefined : (sourceId,targetId)=>void reorder(sourceId,targetId)}
        actions={
          !readOnly
            ? (row) => (
                <div className="flex items-center gap-1">
                  <GripVertical className="h-4 w-4 text-text-muted" />
                  <Button size="sm" variant="secondary" onClick={() => edit(row)}>
                    수정
                  </Button>
                  <RowDeleteButton onConfirm={() => remove(Number(row.ROW_ID))} />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void move(rows.indexOf(row), -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void move(rows.indexOf(row), 1)}
                  >
                    ↓
                  </Button>
                </div>
              )
            : undefined
        }
      />
    </div>
  );
}
