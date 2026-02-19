"use client";

/**
 * @file src/app/(authenticated)/production/input-manual/page.tsx
 * @description 실적입력(수작업) 페이지 - 작업지시 선택 + 작업자 선택 + 실적 입력
 * 
 * 상태 관리: Zustand persist로 localStorage에 저장 (페이지 이동 후에도 유지)
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, HandMetal, Package, CheckCircle, XCircle, UserPlus, X, ClipboardList, Trash2 } from 'lucide-react';
import { Card, CardContent, Button, Input, StatCard, Modal } from '@/components/ui';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useInputManualStore } from '@/stores/inputManualStore';

interface ManualResult {
  id: string;
  orderNo: string;
  partName: string;
  workerName: string;
  lotNo: string;
  goodQty: number;
  defectQty: number;
  workDate: string;
  startAt: string;
  endAt: string;
  remark: string;
}

const mockData: ManualResult[] = [
  { id: '1', orderNo: 'JO-20250126-001', partName: '메인 하네스 A', workerName: '김작업', lotNo: 'LOT-20250126-001', goodQty: 100, defectQty: 3, workDate: '2025-01-26', startAt: '09:00', endAt: '12:00', remark: '' },
  { id: '2', orderNo: 'JO-20250126-002', partName: '서브 하네스 B', workerName: '이작업', lotNo: 'LOT-20250126-002', goodQty: 80, defectQty: 1, workDate: '2025-01-26', startAt: '13:00', endAt: '17:00', remark: '정상' },
  { id: '3', orderNo: 'JO-20250125-001', partName: '도어 하네스 C', workerName: '박작업', lotNo: 'LOT-20250125-001', goodQty: 200, defectQty: 5, workDate: '2025-01-25', startAt: '08:00', endAt: '17:00', remark: '' },
];

function InputManualPage() {
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
  } = useInputManualStore();
  
  const [form, setForm] = useState({ 
    orderNo: '', 
    workerName: '', 
    lotNo: '', 
    goodQty: '', 
    defectQty: '', 
    startAt: '', 
    endAt: '', 
    remark: '' 
  });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || 
           item.partName.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => {
    const totalGood = mockData.reduce((s, r) => s + r.goodQty, 0);
    const totalDefect = mockData.reduce((s, r) => s + r.defectQty, 0);
    return { count: mockData.length, totalGood, totalDefect };
  }, []);

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

  /** 실적 저장 */
  const handleSubmit = () => {
    if (!selectedJobOrder) {
      alert(t('production.inputManual.pleaseSelectJobOrder'));
      return;
    }
    if (!selectedWorker) {
      alert(t('production.inputManual.pleaseSelectWorker'));
      return;
    }
    console.log('수작업 실적 저장:', { 
      jobOrder: selectedJobOrder, 
      worker: selectedWorker, 
      form 
    });
    setIsModalOpen(false);
    // Reset form
    setForm({ orderNo: '', workerName: '', lotNo: '', goodQty: '', defectQty: '', startAt: '', endAt: '', remark: '' });
  };

  /** 실적 입력 모달 열기 */
  const handleOpenInputModal = () => {
    if (!selectedJobOrder) {
      alert(t('production.inputManual.pleaseSelectJobOrderFirst'));
      setIsJobOrderModalOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  const columns = useMemo<ColumnDef<ManualResult>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.inputManual.orderNo'), size: 160 },
    { accessorKey: 'partName', header: t('production.inputManual.partName'), size: 150 },
    { accessorKey: 'workerName', header: t('production.inputManual.worker'), size: 80 },
    { accessorKey: 'lotNo', header: t('production.inputManual.lotNo'), size: 160 },
    { accessorKey: 'goodQty', header: t('production.inputManual.good'), size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: t('production.inputManual.defect'), size: 80, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'workDate', header: t('production.inputManual.workDate'), size: 100 },
    { id: 'time', header: t('production.inputManual.workTime'), size: 130, cell: ({ row }) => <span className="text-text-muted">{row.original.startAt} ~ {row.original.endAt}</span> },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><HandMetal className="w-7 h-7 text-primary" />{t('production.inputManual.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.inputManual.description')}</p>
        </div>
        <div className="flex gap-2">
          {/* 전체 초기화 버튼 (선택된 것이 있을 때만 표시) */}
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
            {selectedJobOrder ? selectedJobOrder.orderNo : t('production.inputManual.selectJobOrder')}
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsWorkerModalOpen(true)}
            className={selectedWorker ? 'border-primary text-primary' : ''}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            {selectedWorker ? selectedWorker.workerName : t('production.inputManual.selectWorker')}
          </Button>
          <Button size="sm" onClick={handleOpenInputModal}>
            <Save className="w-4 h-4 mr-1" />{t('production.inputManual.inputResult')}
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
                <span className="font-semibold text-text text-sm">{t('production.inputManual.selectedJobOrderInfo')}</span>
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
                <span className="text-sm text-text-muted">{t('production.inputManual.clickToSelectJobOrder')}</span>
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
                <span className="font-semibold text-text text-sm">{t('production.inputManual.currentWorker')}</span>
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
                    <CheckCircle className="w-3 h-3" />{t('production.inputManual.workerActive')}
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsWorkerModalOpen(true)}
                className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm text-text-muted">{t('production.inputManual.clickToSelectWorker')}</span>
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('production.inputManual.inputCount')} value={stats.count} icon={Package} color="blue" />
        <StatCard label={t('production.inputManual.goodTotal')} value={stats.totalGood} icon={CheckCircle} color="green" />
        <StatCard label={t('production.inputManual.defectTotal')} value={stats.totalDefect} icon={XCircle} color="red" />
      </div>

      {/* 실적 목록 */}
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('production.inputManual.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      {/* 실적 입력 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputManual.modalTitle')} size="md">
        <div className="space-y-4">
          {/* 선택된 작업지시 표시 */}
          {selectedJobOrder && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-text-muted mb-1">{t('production.inputManual.selectedJobOrder')}</p>
              <p className="font-mono font-medium text-primary">{selectedJobOrder.orderNo}</p>
              <p className="text-sm text-text">{selectedJobOrder.partName}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label={t('production.inputManual.worker')} 
              value={selectedWorker?.workerName ?? ''} 
              fullWidth 
              disabled 
            />
            <Input 
              label={t('production.inputManual.lotNo')} 
              value={form.lotNo} 
              onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} 
              fullWidth 
            />
            <Input 
              label={t('production.inputManual.goodQty')} 
              type="number" 
              value={form.goodQty} 
              onChange={e => setForm(p => ({ ...p, goodQty: e.target.value }))} 
              fullWidth 
            />
            <Input 
              label={t('production.inputManual.defectQty')} 
              type="number" 
              value={form.defectQty} 
              onChange={e => setForm(p => ({ ...p, defectQty: e.target.value }))} 
              fullWidth 
            />
            <Input 
              label={t('production.inputManual.startTime')} 
              type="time" 
              value={form.startAt} 
              onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))} 
              fullWidth 
            />
            <Input 
              label={t('production.inputManual.endTime')} 
              type="time" 
              value={form.endAt} 
              onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))} 
              fullWidth 
            />
          </div>
          <Input 
            label={t('production.inputManual.remark')} 
            value={form.remark} 
            onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} 
            fullWidth 
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>
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

export default InputManualPage;
