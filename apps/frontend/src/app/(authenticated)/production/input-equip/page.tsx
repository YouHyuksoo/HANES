"use client";

/**
 * @file src/app/(authenticated)/production/input-equip/page.tsx
 * @description 실적입력(검사장비) 페이지 - 라인/공정/설비/작업지시/작업자 5단계 선택 + 측정값 입력
 *
 * 초보자 가이드:
 * 1. 선택 흐름: 라인 -> 공정 -> 설비 -> 작업지시 -> 작업자 (5단계 필수)
 * 2. 검사범위: 설비별 검사 기준 범위(상한/하한) 표시
 * 3. 측정값: 실제 측정값을 입력하여 자동 합격/불합격 판정
 * 4. 상태 관리: Zustand persist로 localStorage에 저장 (페이지 이동 후에도 유지)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw, Save, Microscope, CheckCircle, XCircle, Target,
  UserPlus, X, ClipboardList, Trash2, Layers, Cpu, Wrench,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import api from '@/services/api';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useInputEquipStore } from '@/stores/inputEquipStore';

interface EquipInspect {
  id: string;
  orderNo: string;
  partName: string;
  equipName: string;
  lotNo: string;
  measuredValue: number;
  lowerLimit: number;
  upperLimit: number;
  passYn: string;
  inspectDate: string;
  inspector: string;
}

interface LineOption { lineCode: string; lineName: string; }
interface ProcessOption { processCode: string; processName: string; }
interface EquipOption { id: string; equipCode: string; equipName: string; }

export default function InputEquipPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<EquipInspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isJobOrderModalOpen, setIsJobOrderModalOpen] = useState(false);

  const [lines, setLines] = useState<LineOption[]>([]);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [equips, setEquips] = useState<EquipOption[]>([]);

  const {
    selectedLine, selectedProcess, selectedEquip,
    selectedJobOrder, selectedWorker,
    setSelectedLine, setSelectedProcess, setSelectedEquip,
    setSelectedJobOrder, setSelectedWorker,
    clearSelection,
  } = useInputEquipStore();

  const [form, setForm] = useState({ lotNo: '', measuredValue: '', remark: '' });

  /** 라인 목록 로드 */
  useEffect(() => {
    api.get('/equipment/equips/metadata/lines')
      .then(res => setLines(res.data?.data ?? []))
      .catch(() => setLines([]));
  }, []);

  /** 공정 목록 로드 */
  useEffect(() => {
    api.get('/equipment/equips/metadata/processes')
      .then(res => setProcesses(res.data?.data ?? []))
      .catch(() => setProcesses([]));
  }, []);

  /** 설비 목록 로드 (라인 + 공정 필터) */
  useEffect(() => {
    if (!selectedLine || !selectedProcess) {
      setEquips([]);
      return;
    }
    const params: Record<string, string> = {
      lineCode: selectedLine.lineCode,
      limit: '200',
    };
    api.get('/equipment/equips', { params })
      .then(res => {
        const all = res.data?.data ?? [];
        const filtered = all.filter((e: any) =>
          e.processCode === selectedProcess!.processCode
        );
        setEquips(filtered.length > 0 ? filtered : all);
      })
      .catch(() => setEquips([]));
  }, [selectedLine, selectedProcess]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (selectedJobOrder) params.jobOrderId = selectedJobOrder.id;
      if (selectedEquip) params.equipId = selectedEquip.id;
      const res = await api.get('/production/prod-results', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, selectedJobOrder, selectedEquip]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    pass: data.filter(d => d.passYn === 'Y').length,
    fail: data.filter(d => d.passYn === 'N').length,
  }), [data]);

  const lineOptions = useMemo(() =>
    lines.map(l => ({ value: l.lineCode, label: `${l.lineName} (${l.lineCode})` })),
  [lines]);

  const processOptions = useMemo(() =>
    processes.map(p => ({ value: p.processCode, label: `${p.processName} (${p.processCode})` })),
  [processes]);

  const equipOptions = useMemo(() =>
    equips.map(e => ({ value: e.id, label: `${e.equipName} (${e.equipCode})` })),
  [equips]);

  /** 라인 선택 */
  const handleLineChange = (value: string) => {
    if (!value) { setSelectedLine(null); return; }
    const line = lines.find(l => l.lineCode === value);
    if (line) setSelectedLine({ lineCode: line.lineCode, lineName: line.lineName });
  };

  /** 공정 선택 */
  const handleProcessChange = (value: string) => {
    if (!value) { setSelectedProcess(null); return; }
    const proc = processes.find(p => p.processCode === value);
    if (proc) setSelectedProcess({ processCode: proc.processCode, processName: proc.processName });
  };

  /** 설비 선택 */
  const handleEquipChange = (value: string) => {
    if (!value) { setSelectedEquip(null); return; }
    const eq = equips.find(e => e.id === value);
    if (eq) setSelectedEquip({ id: eq.id, equipCode: eq.equipCode, equipName: eq.equipName });
  };

  /** 작업지시 선택 -> 설비에 할당 */
  const handleJobOrderConfirm = async (jobOrder: JobOrder) => {
    setSelectedJobOrder(jobOrder);
    setIsJobOrderModalOpen(false);
    if (selectedEquip) {
      try {
        await api.patch(`/equipment/equips/${selectedEquip.id}/job-order`, {
          jobOrderId: jobOrder.id,
        });
      } catch (e) {
        console.error('Failed to assign job order to equipment:', e);
      }
    }
  };

  /** 작업자 선택 확인 */
  const handleWorkerConfirm = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsWorkerModalOpen(false);
  };

  /** 검사 결과 저장 */
  const handleSubmit = useCallback(async () => {
    if (!selectedJobOrder || !selectedWorker || !selectedEquip) return;
    setSaving(true);
    try {
      await api.post('/production/prod-results', {
        jobOrderId: selectedJobOrder.id,
        workerId: selectedWorker.id,
        equipId: selectedEquip.id,
        processCode: selectedProcess?.processCode,
        lotNo: form.lotNo || undefined,
        measuredValue: Number(form.measuredValue) || undefined,
        remark: form.remark || undefined,
      });
      setIsModalOpen(false);
      setForm({ lotNo: '', measuredValue: '', remark: '' });
      fetchData();
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  }, [selectedJobOrder, selectedWorker, selectedEquip, selectedProcess, form, fetchData]);

  /** 검사 입력 모달 열기 */
  const handleOpenInputModal = useCallback(() => {
    if (!selectedEquip) return;
    if (!selectedJobOrder) { setIsJobOrderModalOpen(true); return; }
    if (!selectedWorker) { setIsWorkerModalOpen(true); return; }
    setIsModalOpen(true);
  }, [selectedEquip, selectedJobOrder, selectedWorker]);

  const allSelected = !!(selectedLine && selectedProcess && selectedEquip && selectedJobOrder && selectedWorker);
  const hasAnySelection = !!(selectedLine || selectedProcess || selectedEquip || selectedJobOrder || selectedWorker);

  const columns = useMemo<ColumnDef<EquipInspect>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.inputEquip.orderNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'partName', header: t('production.inputEquip.partName'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'equipName', header: t('production.inputEquip.inspectEquip'), size: 110 },
    { accessorKey: 'lotNo', header: t('production.inputEquip.lotNo'), size: 150, meta: { filterType: 'text' as const } },
    {
      id: 'range', header: t('production.inputEquip.inspectRange'), size: 120,
      cell: ({ row }) => <span className="text-text-muted text-xs">{row.original.lowerLimit} ~ {row.original.upperLimit}</span>,
    },
    {
      accessorKey: 'measuredValue', header: t('production.inputEquip.measuredValue'), size: 90,
      cell: ({ row }) => {
        const { measuredValue, lowerLimit, upperLimit } = row.original;
        const inRange = measuredValue >= lowerLimit && measuredValue <= upperLimit;
        return <span className={inRange ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{measuredValue}</span>;
      },
    },
    {
      accessorKey: 'passYn', header: t('production.inputEquip.judgment'), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('production.inputEquip.pass')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('production.inputEquip.fail')}</span>;
      },
    },
    { accessorKey: 'inspector', header: t('production.inputEquip.inspector'), size: 80 },
    { accessorKey: 'inspectDate', header: t('production.inputEquip.inspectDate'), size: 100 },
  ], [t]);

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2"><Microscope className="w-6 h-6 text-primary" />{t('production.inputEquip.title')}</h1>
          <p className="text-text-muted text-sm">{t('production.inputEquip.description')}</p>
        </div>
        <div className="flex gap-2 items-center">
          {hasAnySelection && (
            <Button variant="outline" size="sm" onClick={clearSelection}
              className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4 mr-1" />{t('common.clear')}
            </Button>
          )}
          <Button size="sm" onClick={handleOpenInputModal} disabled={!allSelected}>
            <Save className="w-4 h-4 mr-1" />{t('production.inputEquip.inputInspect')}
          </Button>
        </div>
      </div>

      {/* 라인/공정/설비 + 작업지시 + 작업자 + 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* 라인 / 공정 / 설비 선택 */}
        <Card padding="none">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="w-4 h-4 text-primary" />
              <span className="font-semibold text-text text-xs">{t('production.inputEquip.selectEquipInfo')}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <Select
                  options={lineOptions}
                  value={selectedLine?.lineCode ?? ''}
                  onChange={handleLineChange}
                  placeholder={t('production.inputEquip.clickToSelectLine')}
                  fullWidth
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <Select
                  options={processOptions}
                  value={selectedProcess?.processCode ?? ''}
                  onChange={handleProcessChange}
                  placeholder={t('production.inputEquip.clickToSelectProcess')}
                  fullWidth
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <Select
                  options={equipOptions}
                  value={selectedEquip?.id ?? ''}
                  onChange={handleEquipChange}
                  placeholder={t('production.inputEquip.clickToSelectEquip')}
                  disabled={!selectedLine || !selectedProcess}
                  fullWidth
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 선택된 작업지시 정보 */}
        <Card padding="none" className={selectedJobOrder ? 'border-primary/30' : ''}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-primary" />
                <span className="font-semibold text-text text-xs">{t('production.inputEquip.selectedJobOrderInfo')}</span>
              </div>
              {selectedJobOrder && (
                <button onClick={() => setSelectedJobOrder(null)} className="p-0.5 hover:bg-surface rounded text-text-muted" title={t('common.delete')}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {selectedJobOrder ? (
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-text">{selectedJobOrder.orderNo}</p>
                    <p className="text-xs text-text-muted">{selectedJobOrder.partName} ({selectedJobOrder.partCode})</p>
                  </div>
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                    {selectedJobOrder.processType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-muted">{t('production.order.planQty')}:</span>
                    <span className="ml-1 font-medium">{selectedJobOrder.planQty.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">{t('production.order.completedQty')}:</span>
                    <span className="ml-1 font-medium">{selectedJobOrder.completedQty.toLocaleString()}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border">
                  <div className="w-full bg-surface rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min((selectedJobOrder.completedQty / selectedJobOrder.planQty) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 text-right">
                    {Math.round((selectedJobOrder.completedQty / selectedJobOrder.planQty) * 100)}% {t('production.order.progress')}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => selectedEquip ? setIsJobOrderModalOpen(true) : undefined}
                disabled={!selectedEquip}
                className="w-full flex flex-col items-center justify-center py-4 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ClipboardList className="w-6 h-6 text-text-muted mb-1" />
                <span className="text-xs text-text-muted">
                  {selectedEquip ? t('production.inputEquip.clickToSelectJobOrder') : t('production.inputEquip.pleaseSelectEquipFirst')}
                </span>
              </button>
            )}
          </CardContent>
        </Card>

        {/* 선택된 작업자 정보 */}
        <Card padding="none" className={selectedWorker ? 'border-primary/30' : ''}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-primary" />
                <span className="font-semibold text-text text-xs">{t('production.inputEquip.currentWorker')}</span>
              </div>
              {selectedWorker && (
                <button onClick={() => setSelectedWorker(null)} className="p-0.5 hover:bg-surface rounded text-text-muted" title={t('common.delete')}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {selectedWorker ? (
              <div className="flex items-center gap-3">
                {selectedWorker.photoUrl ? (
                  <img src={selectedWorker.photoUrl} alt={selectedWorker.workerName} className="w-12 h-12 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{selectedWorker.workerName.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-text">{selectedWorker.workerName}</p>
                  <p className="text-xs text-text-muted">{selectedWorker.workerCode} | {selectedWorker.dept}</p>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium mt-0.5">
                    <CheckCircle className="w-3 h-3" />{t('production.inputEquip.workerActive')}
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsWorkerModalOpen(true)}
                className="w-full flex flex-col items-center justify-center py-4 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-6 h-6 text-text-muted mb-1" />
                <span className="text-xs text-text-muted">{t('production.inputEquip.clickToSelectWorker')}</span>
              </button>
            )}
          </CardContent>
        </Card>

        {/* 통계 카드 (세로 배치) */}
        <div className="flex flex-col gap-2">
          <StatCard label={t('production.inputEquip.inspectCount')} value={stats.total} icon={Target} color="blue" />
          <StatCard label={t('production.inputEquip.pass')} value={stats.pass} icon={CheckCircle} color="green" />
          <StatCard label={t('production.inputEquip.fail')} value={stats.fail} icon={XCircle} color="red" />
        </div>
      </div>

      {/* 실적 목록 */}
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.inputEquip.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.inputEquip.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      {/* 검사장비 결과 입력 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputEquip.modalTitle')} size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-text-muted">{t('production.inputEquip.line')}:</span> <span className="font-medium">{selectedLine?.lineName}</span></div>
            <div><span className="text-text-muted">{t('production.inputEquip.process')}:</span> <span className="font-medium">{selectedProcess?.processName}</span></div>
            <div><span className="text-text-muted">{t('production.inputEquip.equip')}:</span> <span className="font-medium">{selectedEquip?.equipName}</span></div>
            <div><span className="text-text-muted">{t('production.inputEquip.workOrder')}:</span> <span className="font-mono font-medium text-primary">{selectedJobOrder?.orderNo}</span></div>
            <div><span className="text-text-muted">{t('production.inputEquip.inspector')}:</span> <span className="font-medium">{selectedWorker?.workerName}</span></div>
            <div><span className="text-text-muted">{t('production.inputEquip.partName')}:</span> <span className="font-medium">{selectedJobOrder?.partName}</span></div>
          </div>

          <Input label={t('production.inputEquip.lotNo')} value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
          <Input label={t('production.inputEquip.measuredValue')} type="number" step="0.1" value={form.measuredValue} onChange={e => setForm(p => ({ ...p, measuredValue: e.target.value }))} fullWidth />
          <Input label={t('production.inputEquip.remark')} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={saving || !allSelected}>
              <Save className="w-4 h-4 mr-1" />{saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 작업지시 선택 모달 */}
      <JobOrderSelectModal
        isOpen={isJobOrderModalOpen}
        onClose={() => setIsJobOrderModalOpen(false)}
        onConfirm={handleJobOrderConfirm}
        filterStatus={['READY', 'IN_PROGRESS']}
      />

      {/* 작업자 선택 모달 */}
      <WorkerSelectModal
        isOpen={isWorkerModalOpen}
        onClose={() => setIsWorkerModalOpen(false)}
        onConfirm={handleWorkerConfirm}
      />
    </div>
  );
}
