"use client";

/**
 * @file src/app/(authenticated)/production/input-inspect/page.tsx
 * @description 실적입력(단순검사) 페이지 - 작업지시 선택 + 작업자 선택 + 검사 결과 입력
 * 
 * 상태 관리: Zustand persist로 localStorage에 저장 (페이지 이동 후에도 유지)
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, ClipboardCheck, CheckCircle, XCircle, AlertTriangle, UserPlus, X, ClipboardList, Trash2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useInputInspectStore } from '@/stores/inputInspectStore';

interface InspectInput {
  id: string;
  orderNo: string;
  partName: string;
  lotNo: string;
  inspectQty: number;
  passQty: number;
  failQty: number;
  passYn: string;
  inspectDate: string;
  inspector: string;
  remark: string;
}

const mockData: InspectInput[] = [
  { id: '1', orderNo: 'JO-20250126-001', partName: '메인 하네스 A', lotNo: 'LOT-20250126-001', inspectQty: 100, passQty: 97, failQty: 3, passYn: 'Y', inspectDate: '2025-01-26', inspector: '검사원A', remark: '' },
  { id: '2', orderNo: 'JO-20250126-002', partName: '서브 하네스 B', lotNo: 'LOT-20250126-002', inspectQty: 80, passQty: 78, failQty: 2, passYn: 'Y', inspectDate: '2025-01-26', inspector: '검사원B', remark: '' },
  { id: '3', orderNo: 'JO-20250125-001', partName: '도어 하네스 C', lotNo: 'LOT-20250125-001', inspectQty: 50, passQty: 40, failQty: 10, passYn: 'N', inspectDate: '2025-01-25', inspector: '검사원A', remark: '불량률 초과' },
];

function InputInspectPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isJobOrderModalOpen, setIsJobOrderModalOpen] = useState(false);
  
  // Zustand store에서 상태 가져오기
  const { 
    selectedJobOrder, 
    selectedWorker, 
    setSelectedJobOrder, 
    setSelectedWorker, 
    clearSelection 
  } = useInputInspectStore();
  
  const [form, setForm] = useState({ orderNo: '', lotNo: '', inspectQty: '', passQty: '', failQty: '', passYn: 'Y', remark: '' });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || 
           item.lotNo.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => ({
    total: mockData.length,
    pass: mockData.filter(d => d.passYn === 'Y').length,
    fail: mockData.filter(d => d.passYn === 'N').length,
    passRate: mockData.length > 0 ? Math.round((mockData.filter(d => d.passYn === 'Y').length / mockData.length) * 100) : 0,
  }), []);

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

  /** 검사 결과 저장 */
  const handleSubmit = () => {
    if (!selectedJobOrder) {
      alert(t('production.inputInspect.pleaseSelectJobOrder'));
      return;
    }
    if (!selectedWorker) {
      alert(t('production.inputInspect.pleaseSelectWorker'));
      return;
    }
    console.log('검사 결과 저장:', { 
      jobOrder: selectedJobOrder, 
      worker: selectedWorker, 
      form 
    });
    setIsModalOpen(false);
    setForm({ orderNo: '', lotNo: '', inspectQty: '', passQty: '', failQty: '', passYn: 'Y', remark: '' });
  };

  /** 검사 입력 모달 열기 */
  const handleOpenInputModal = () => {
    if (!selectedJobOrder) {
      alert(t('production.inputInspect.pleaseSelectJobOrderFirst'));
      setIsJobOrderModalOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  const columns = useMemo<ColumnDef<InspectInput>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.inputInspect.orderNo'), size: 160 },
    { accessorKey: 'partName', header: t('production.inputInspect.partName'), size: 140 },
    { accessorKey: 'lotNo', header: t('production.inputInspect.lotNo'), size: 160 },
    { accessorKey: 'inspectQty', header: t('production.inputInspect.inspectQty'), size: 90, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'passQty', header: t('production.inputInspect.pass'), size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'failQty', header: t('production.inputInspect.fail'), size: 80, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    {
      accessorKey: 'passYn', header: t('production.inputInspect.judgment'), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('production.inputInspect.pass')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('production.inputInspect.fail')}</span>;
      },
    },
    { accessorKey: 'inspector', header: t('production.inputInspect.inspector'), size: 80 },
    { accessorKey: 'inspectDate', header: t('production.inputInspect.inspectDate'), size: 100 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-primary" />{t('production.inputInspect.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.inputInspect.description')}</p>
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
            {selectedJobOrder ? selectedJobOrder.orderNo : t('production.inputInspect.selectJobOrder')}
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsWorkerModalOpen(true)}
            className={selectedWorker ? 'border-primary text-primary' : ''}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            {selectedWorker ? selectedWorker.workerName : t('production.inputInspect.selectWorker')}
          </Button>
          <Button size="sm" onClick={handleOpenInputModal}>
            <Save className="w-4 h-4 mr-1" />{t('production.inputInspect.inputInspect')}
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
                <span className="font-semibold text-text text-sm">{t('production.inputInspect.selectedJobOrderInfo')}</span>
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
                <span className="text-sm text-text-muted">{t('production.inputInspect.clickToSelectJobOrder')}</span>
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
                <span className="font-semibold text-text text-sm">{t('production.inputInspect.currentWorker')}</span>
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
                    <CheckCircle className="w-3 h-3" />{t('production.inputInspect.workerActive')}
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsWorkerModalOpen(true)}
                className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm text-text-muted">{t('production.inputInspect.clickToSelectWorker')}</span>
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.inputInspect.inspectCount')} value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label={t('production.inputInspect.pass')} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t('production.inputInspect.fail')} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t('production.inputInspect.passRate')} value={`${stats.passRate}%`} icon={AlertTriangle} color="purple" />
      </div>

      {/* 실적 목록 */}
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('production.inputInspect.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      {/* 검사 입력 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputInspect.modalTitle')} size="md">
        <div className="space-y-4">
          {/* 선택된 작업지시 표시 */}
          {selectedJobOrder && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-text-muted mb-1">{t('production.inputInspect.selectedJobOrder')}</p>
              <p className="font-mono font-medium text-primary">{selectedJobOrder.orderNo}</p>
              <p className="text-sm text-text">{selectedJobOrder.partName}</p>
            </div>
          )}
          
          <Input 
            label={t('production.inputInspect.inspector')} 
            value={selectedWorker?.workerName ?? ''} 
            fullWidth 
            disabled 
          />
          <Input label={t('production.inputInspect.lotNo')} value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('production.inputInspect.inspectQty')} type="number" value={form.inspectQty} onChange={e => setForm(p => ({ ...p, inspectQty: e.target.value }))} fullWidth />
            <Input label={t('production.inputInspect.passQty')} type="number" value={form.passQty} onChange={e => setForm(p => ({ ...p, passQty: e.target.value }))} fullWidth />
            <Input label={t('production.inputInspect.failQty')} type="number" value={form.failQty} onChange={e => setForm(p => ({ ...p, failQty: e.target.value }))} fullWidth />
          </div>
          <Select label={t('production.inputInspect.judgment')} options={[{ value: 'Y', label: t('production.inputInspect.pass') }, { value: 'N', label: t('production.inputInspect.fail') }]} value={form.passYn} onChange={v => setForm(p => ({ ...p, passYn: v }))} fullWidth />
          <Input label={t('production.inputInspect.remark')} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
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

export default InputInspectPage;
