"use client";

/**
 * @file src/app/(authenticated)/production/input-manual/page.tsx
 * @description 실적입력(수작업) 페이지 - 설비 불필요, 작업지도서 표시 영역 포함
 *
 * 초보자 가이드:
 * 1. **목적**: 수작업 공정에서 실적을 입력하는 페이지
 * 2. **작업지도서**: 상단에 현재 작업지시의 작업지도서 요약 표시
 * 3. **실적 입력**: 양품/불량 수량 입력 후 저장
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, HandMetal, FileText, Package, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ManualResult {
  id: string;
  orderNo: string;
  partName: string;
  workerName: string;
  lotNo: string;
  goodQty: number;
  defectQty: number;
  workDate: string;
  startTime: string;
  endTime: string;
  remark: string;
}

const mockData: ManualResult[] = [
  { id: '1', orderNo: 'JO-20250126-001', partName: '메인 하네스 A', workerName: '김작업', lotNo: 'LOT-20250126-001', goodQty: 100, defectQty: 3, workDate: '2025-01-26', startTime: '09:00', endTime: '12:00', remark: '' },
  { id: '2', orderNo: 'JO-20250126-002', partName: '서브 하네스 B', workerName: '이작업', lotNo: 'LOT-20250126-002', goodQty: 80, defectQty: 1, workDate: '2025-01-26', startTime: '13:00', endTime: '17:00', remark: '정상' },
  { id: '3', orderNo: 'JO-20250125-001', partName: '도어 하네스 C', workerName: '박작업', lotNo: 'LOT-20250125-001', goodQty: 200, defectQty: 5, workDate: '2025-01-25', startTime: '08:00', endTime: '17:00', remark: '' },
];

function InputManualPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ orderNo: '', workerName: '', lotNo: '', goodQty: '', defectQty: '', startTime: '', endTime: '', remark: '' });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => {
    const totalGood = mockData.reduce((s, r) => s + r.goodQty, 0);
    const totalDefect = mockData.reduce((s, r) => s + r.defectQty, 0);
    return { count: mockData.length, totalGood, totalDefect };
  }, []);

  const handleSubmit = () => {
    console.log('수작업 실적 저장:', form);
    setIsModalOpen(false);
  };

  const columns = useMemo<ColumnDef<ManualResult>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.inputManual.orderNo'), size: 160 },
    { accessorKey: 'partName', header: t('production.inputManual.partName'), size: 150 },
    { accessorKey: 'workerName', header: t('production.inputManual.worker'), size: 80 },
    { accessorKey: 'lotNo', header: t('production.inputManual.lotNo'), size: 160 },
    { accessorKey: 'goodQty', header: t('production.inputManual.good'), size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: t('production.inputManual.defect'), size: 80, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'workDate', header: t('production.inputManual.workDate'), size: 100 },
    { id: 'time', header: t('production.inputManual.workTime'), size: 130, cell: ({ row }) => <span className="text-text-muted">{row.original.startTime} ~ {row.original.endTime}</span> },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><HandMetal className="w-7 h-7 text-primary" />{t('production.inputManual.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.inputManual.description')}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Save className="w-4 h-4 mr-1" />{t('production.inputManual.inputResult')}</Button>
      </div>

      {/* 작업지도서 영역 */}
      <Card><CardContent>
        <div className="flex items-center gap-2 mb-2"><FileText className="w-5 h-5 text-primary" /><span className="font-semibold text-text">{t('production.inputManual.workInstruction')}</span></div>
        <div className="p-3 bg-background rounded-lg text-sm text-text-muted">{t('production.inputManual.workInstructionDesc')}</div>
      </CardContent></Card>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('production.inputManual.inputCount')} value={stats.count} icon={Package} color="blue" />
        <StatCard label={t('production.inputManual.goodTotal')} value={stats.totalGood} icon={CheckCircle} color="green" />
        <StatCard label={t('production.inputManual.defectTotal')} value={stats.totalDefect} icon={XCircle} color="red" />
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('production.inputManual.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputManual.modalTitle')} size="md">
        <div className="space-y-4">
          <Select label={t('production.inputManual.workOrder')} options={[{ value: 'JO-20250126-001', label: 'JO-20250126-001 (메인 하네스 A)' }, { value: 'JO-20250126-002', label: 'JO-20250126-002 (서브 하네스 B)' }]} value={form.orderNo} onChange={v => setForm(p => ({ ...p, orderNo: v }))} fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.inputManual.worker')} value={form.workerName} onChange={e => setForm(p => ({ ...p, workerName: e.target.value }))} fullWidth />
            <Input label={t('production.inputManual.lotNo')} value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
            <Input label={t('production.inputManual.goodQty')} type="number" value={form.goodQty} onChange={e => setForm(p => ({ ...p, goodQty: e.target.value }))} fullWidth />
            <Input label={t('production.inputManual.defectQty')} type="number" value={form.defectQty} onChange={e => setForm(p => ({ ...p, defectQty: e.target.value }))} fullWidth />
            <Input label={t('production.inputManual.startTime')} type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} fullWidth />
            <Input label={t('production.inputManual.endTime')} type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} fullWidth />
          </div>
          <Input label={t('production.inputManual.remark')} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}><Save className="w-4 h-4 mr-1" />{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InputManualPage;
