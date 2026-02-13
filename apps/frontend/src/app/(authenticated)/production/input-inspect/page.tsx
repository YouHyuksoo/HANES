"use client";

/**
 * @file src/app/(authenticated)/production/input-inspect/page.tsx
 * @description 실적입력(단순검사) 페이지 - ProdResult + InspectResult 판정 결과 저장
 *
 * 초보자 가이드:
 * 1. **목적**: 단순 검사 공정에서 검사 결과(합격/불합격)를 입력
 * 2. **판정**: 양품/불량 수량과 함께 검사 판정 결과 저장
 * 3. **검사 기준**: 품목별 검사 기준을 확인하고 판정
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, ClipboardCheck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

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
  const [form, setForm] = useState({ orderNo: '', lotNo: '', inspectQty: '', passQty: '', failQty: '', passYn: 'Y', remark: '' });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.lotNo.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => ({
    total: mockData.length,
    pass: mockData.filter(d => d.passYn === 'Y').length,
    fail: mockData.filter(d => d.passYn === 'N').length,
    passRate: mockData.length > 0 ? Math.round((mockData.filter(d => d.passYn === 'Y').length / mockData.length) * 100) : 0,
  }), []);

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
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Save className="w-4 h-4 mr-1" />{t('production.inputInspect.inputInspect')}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.inputInspect.inspectCount')} value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label={t('production.inputInspect.pass')} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t('production.inputInspect.fail')} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t('production.inputInspect.passRate')} value={`${stats.passRate}%`} icon={AlertTriangle} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('production.inputInspect.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputInspect.modalTitle')} size="md">
        <div className="space-y-4">
          <Select label={t('production.inputInspect.workOrder')} options={[{ value: 'JO-001', label: 'JO-20250126-001 (메인 하네스 A)' }, { value: 'JO-002', label: 'JO-20250126-002 (서브 하네스 B)' }]} value={form.orderNo} onChange={v => setForm(p => ({ ...p, orderNo: v }))} fullWidth />
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
            <Button onClick={() => { console.log('검사 결과:', form); setIsModalOpen(false); }}><Save className="w-4 h-4 mr-1" />{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InputInspectPage;
