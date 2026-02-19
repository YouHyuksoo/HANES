"use client";

/**
 * @file src/app/(authenticated)/production/input-machine/page.tsx
 * @description 실적입력(가공) 페이지 - 작업지시 선택 + 작업자 선택 + 설비설정 + 실적 입력
 * 
 * 상태 관리: Zustand persist로 localStorage에 저장 (페이지 이동 후에도 유지)
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, Cog, Settings, Shield, Package, CheckCircle, XCircle, UserPlus, X, ClipboardList, Trash2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useInputMachineStore } from '@/stores/inputMachineStore';

interface MachineResult {
  id: string;
  orderNo: string;
  partName: string;
  equipName: string;
  workerName: string;
  lotNo: string;
  goodQty: number;
  defectQty: number;
  cycleTime: number;
  workDate: string;
  inspectChecked: boolean;
}

const mockData: MachineResult[] = [
  { id: '1', orderNo: 'JO-20250126-001', partName: '메인 하네스 A', equipName: 'CNC-001', workerName: '김작업', lotNo: 'LOT-M-001', goodQty: 250, defectQty: 3, cycleTime: 45, workDate: '2025-01-26', inspectChecked: true },
  { id: '2', orderNo: 'JO-20250126-002', partName: '서브 하네스 B', equipName: 'CNC-002', workerName: '이작업', lotNo: 'LOT-M-002', goodQty: 180, defectQty: 1, cycleTime: 38, workDate: '2025-01-26', inspectChecked: true },
  { id: '3', orderNo: 'JO-20250125-001', partName: '도어 하네스 C', equipName: 'PRESS-001', workerName: '박작업', lotNo: 'LOT-M-003', goodQty: 400, defectQty: 8, cycleTime: 22, workDate: '2025-01-25', inspectChecked: false },
];

const consumableParts = ['커팅블레이드 #A1', '프레스금형 #B2', '용접팁 #C3', '윤활유 (500ml)'];

function InputMachinePage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isJobOrderModalOpen, setIsJobOrderModalOpen] = useState(false);
  
  // Zustand store에서 상태 가져오기 (localStorage 자동 동기화)
  const { 
    selectedJobOrder, 
    selectedWorker, 
    setSelectedJobOrder, 
    setSelectedWorker, 
    clearSelection 
  } = useInputMachineStore();
  
  const [inspectConfirmed, setInspectConfirmed] = useState(false);
  const [checkedParts, setCheckedParts] = useState<string[]>([]);
  const [form, setForm] = useState({ orderNo: '', equipId: '', workerName: '', lotNo: '', goodQty: '', defectQty: '', cycleTime: '', remark: '' });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || 
           item.equipName.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => ({
    count: mockData.length,
    totalGood: mockData.reduce((s, r) => s + r.goodQty, 0),
    totalDefect: mockData.reduce((s, r) => s + r.defectQty, 0),
    avgCycle: Math.round(mockData.reduce((s, r) => s + r.cycleTime, 0) / mockData.length),
  }), []);

  const togglePart = (p: string) => setCheckedParts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  /** 작업지시 선택 확인 */
  const handleJobOrderConfirm = (jobOrder: JobOrder) => {
    setSelectedJobOrder(jobOrder);
    setForm(prev => ({ ...prev, orderNo: jobOrder.orderNo }));
    setIsJobOrderModalOpen(false);
  };

  /** 작업자 선택 확인 */
  const handleWorkerConfirm = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsWorkerModalOpen(false);
  };

  /** 실적 입력 모달 열기 */
  const handleOpenInputModal = () => {
    if (!selectedJobOrder) {
      alert(t('production.inputMachine.pleaseSelectJobOrderFirst'));
      setIsJobOrderModalOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  /** 실적 저장 */
  const handleSubmit = () => {
    if (!selectedJobOrder) {
      alert(t('production.inputMachine.pleaseSelectJobOrder'));
      return;
    }
    if (!selectedWorker) {
      alert(t('production.inputMachine.pleaseSelectWorker'));
      return;
    }
    console.log('가공 실적 저장:', { 
      jobOrder: selectedJobOrder, 
      worker: selectedWorker, 
      form, 
      inspectConfirmed, 
      checkedParts 
    });
    setIsModalOpen(false);
    // Reset
    setForm({ orderNo: '', equipId: '', workerName: '', lotNo: '', goodQty: '', defectQty: '', cycleTime: '', remark: '' });
    setInspectConfirmed(false);
    setCheckedParts([]);
  };

  const columns = useMemo<ColumnDef<MachineResult>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.inputMachine.orderNo'), size: 160 },
    { accessorKey: 'partName', header: t('production.inputMachine.partName'), size: 140 },
    { accessorKey: 'equipName', header: t('production.inputMachine.equip'), size: 100 },
    { accessorKey: 'workerName', header: t('production.inputMachine.worker'), size: 80 },
    { accessorKey: 'lotNo', header: t('production.inputMachine.lotNo'), size: 130 },
    { accessorKey: 'goodQty', header: t('production.inputMachine.good'), size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: t('production.inputMachine.defect'), size: 80, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'cycleTime', header: t('production.inputMachine.ctSec'), size: 70 },
    { accessorKey: 'inspectChecked', header: t('production.inputMachine.inspect'), size: 70, cell: ({ getValue }) => getValue() ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" /> },
    { accessorKey: 'workDate', header: t('production.inputMachine.workDate'), size: 100 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 + 버튼 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Cog className="w-7 h-7 text-primary" />{t('production.inputMachine.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.inputMachine.description')}</p>
        </div>
        <div className="flex gap-2">
          {/* 전체 초기화 버튼 */}
          {(selectedJobOrder || selectedWorker) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearSelection}
              className="text-red-500 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />{t('common.clear')}
            </Button>
          )}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsJobOrderModalOpen(true)}
            className={selectedJobOrder ? 'border-primary text-primary' : ''}
          >
            <ClipboardList className="w-4 h-4 mr-1" />
            {selectedJobOrder ? selectedJobOrder.orderNo : t('production.inputMachine.selectJobOrder')}
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsWorkerModalOpen(true)}
            className={selectedWorker ? 'border-primary text-primary' : ''}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            {selectedWorker ? selectedWorker.workerName : t('production.inputMachine.selectWorker')}
          </Button>
          <Button size="sm" onClick={handleOpenInputModal}>
            <Save className="w-4 h-4 mr-1" />{t('production.inputMachine.inputResult')}
          </Button>
        </div>
      </div>

      {/* 작업지시 + 작업자 정보 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 선택된 작업지시 정보 */}
        <Card className={selectedJobOrder ? 'border-primary/30' : ''}>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <span className="font-semibold text-text text-sm">{t('production.inputMachine.selectedJobOrderInfo')}</span>
              </div>
              {selectedJobOrder && (
                <button onClick={() => setSelectedJobOrder(null)} className="p-1 hover:bg-surface rounded text-text-muted" title={t('common.delete')}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {selectedJobOrder ? (
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-bold text-text">{selectedJobOrder.orderNo}</p>
                    <p className="text-sm text-text-muted">{selectedJobOrder.partName} ({selectedJobOrder.partCode})</p>
                  </div>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                    {selectedJobOrder.processType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">{t('production.order.planQty')}:</span>
                    <span className="ml-2 font-medium">{selectedJobOrder.planQty.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">{t('production.order.completedQty')}:</span>
                    <span className="ml-2 font-medium">{selectedJobOrder.completedQty.toLocaleString()}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="w-full bg-surface rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((selectedJobOrder.completedQty / selectedJobOrder.planQty) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1 text-right">
                    {Math.round((selectedJobOrder.completedQty / selectedJobOrder.planQty) * 100)}% {t('production.order.progress')}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsJobOrderModalOpen(true)}
                className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <ClipboardList className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm text-text-muted">{t('production.inputMachine.clickToSelectJobOrder')}</span>
              </button>
            )}
          </CardContent>
        </Card>

        {/* 선택된 작업자 정보 */}
        <Card className={selectedWorker ? 'border-primary/30' : ''}>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <span className="font-semibold text-text text-sm">{t('production.inputMachine.currentWorker')}</span>
              </div>
              {selectedWorker && (
                <button onClick={() => setSelectedWorker(null)} className="p-1 hover:bg-surface rounded text-text-muted" title={t('common.delete')}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {selectedWorker ? (
              <div className="flex items-center gap-4">
                {selectedWorker.photoUrl ? (
                  <img src={selectedWorker.photoUrl} alt={selectedWorker.workerName} className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">{selectedWorker.workerName.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="text-lg font-bold text-text">{selectedWorker.workerName}</p>
                  <p className="text-sm text-text-muted">{selectedWorker.workerCode} | {selectedWorker.dept}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium mt-1">
                    <CheckCircle className="w-3 h-3" />{t('production.inputMachine.workerActive')}
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsWorkerModalOpen(true)}
                className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm text-muted">{t('production.inputMachine.clickToSelectWorker')}</span>
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.inputMachine.inputCount')} value={stats.count} icon={Package} color="blue" />
        <StatCard label={t('production.inputMachine.goodTotal')} value={stats.totalGood} icon={CheckCircle} color="green" />
        <StatCard label={t('production.inputMachine.defectTotal')} value={stats.totalDefect} icon={XCircle} color="red" />
        <StatCard label={t('production.inputMachine.avgCT')} value={`${stats.avgCycle}${t('common.seconds')}`} icon={Settings} color="purple" />
      </div>

      {/* 실적 목록 */}
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('production.inputMachine.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      {/* 실적 입력 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputMachine.modalTitle')} size="lg">
        <div className="space-y-4">
          {/* 선택된 작업지시 표시 */}
          {selectedJobOrder && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-text-muted mb-1">{t('production.inputMachine.selectedJobOrder')}</p>
              <p className="font-mono font-medium text-primary">{selectedJobOrder.orderNo}</p>
              <p className="text-sm text-text">{selectedJobOrder.partName}</p>
            </div>
          )}

          <div className="p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-orange-500" /><span className="font-semibold text-text">{t('production.inputMachine.equipInspectConfirm')}</span></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={inspectConfirmed} onChange={e => setInspectConfirmed(e.target.checked)} className="rounded" />
              <span className="text-sm text-text">{t('production.inputMachine.equipInspectDone')}</span>
            </label>
          </div>
          <div className="p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2 mb-2"><Settings className="w-5 h-5 text-blue-500" /><span className="font-semibold text-text">{t('production.inputMachine.consumableCheck')}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {consumableParts.map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer text-sm text-text">
                  <input type="checkbox" checked={checkedParts.includes(p)} onChange={() => togglePart(p)} className="rounded" />{p}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('production.inputMachine.equip')} options={[{ value: 'CNC-001', label: 'CNC-001' }, { value: 'CNC-002', label: 'CNC-002' }, { value: 'PRESS-001', label: 'PRESS-001' }]} value={form.equipId} onChange={v => setForm(p => ({ ...p, equipId: v }))} fullWidth />
            <Input label={t('production.inputMachine.worker')} value={selectedWorker?.workerName ?? ''} fullWidth disabled />
            <Input label={t('production.inputMachine.lotNo')} value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
            <Input label={t('production.inputMachine.goodQty')} type="number" value={form.goodQty} onChange={e => setForm(p => ({ ...p, goodQty: e.target.value }))} fullWidth />
            <Input label={t('production.inputMachine.defectQty')} type="number" value={form.defectQty} onChange={e => setForm(p => ({ ...p, defectQty: e.target.value }))} fullWidth />
            <Input label={t('production.inputMachine.cycleTimeSec')} type="number" value={form.cycleTime} onChange={e => setForm(p => ({ ...p, cycleTime: e.target.value }))} fullWidth />
          </div>
          <Input label={t('production.inputMachine.remark')} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={!inspectConfirmed || !selectedJobOrder || !selectedWorker}>
              <Save className="w-4 h-4 mr-1" />{t('common.save')}
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

export default InputMachinePage;
