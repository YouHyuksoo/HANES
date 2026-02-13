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
    { accessorKey: 'orderNo', header: '작업지시번호', size: 160 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 160 },
    { accessorKey: 'inspectQty', header: '검사수량', size: 90, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'passQty', header: '합격', size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'failQty', header: '불합격', size: 80, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    {
      accessorKey: 'passYn', header: '판정', size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">합격</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">불합격</span>;
      },
    },
    { accessorKey: 'inspector', header: '검사원', size: 80 },
    { accessorKey: 'inspectDate', header: '검사일', size: 100 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-primary" />실적입력 (단순검사)</h1>
          <p className="text-text-muted mt-1">단순 검사 공정의 검사 결과를 입력합니다</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Save className="w-4 h-4 mr-1" />검사 입력</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="검사 건수" value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label="합격" value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label="불합격" value={stats.fail} icon={XCircle} color="red" />
        <StatCard label="합격률" value={`${stats.passRate}%`} icon={AlertTriangle} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="지시번호, LOT번호 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="단순검사 결과 입력" size="md">
        <div className="space-y-4">
          <Select label="작업지시" options={[{ value: 'JO-001', label: 'JO-20250126-001 (메인 하네스 A)' }, { value: 'JO-002', label: 'JO-20250126-002 (서브 하네스 B)' }]} value={form.orderNo} onChange={v => setForm(p => ({ ...p, orderNo: v }))} fullWidth />
          <Input label="LOT번호" value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
          <div className="grid grid-cols-3 gap-4">
            <Input label="검사수량" type="number" value={form.inspectQty} onChange={e => setForm(p => ({ ...p, inspectQty: e.target.value }))} fullWidth />
            <Input label="합격수량" type="number" value={form.passQty} onChange={e => setForm(p => ({ ...p, passQty: e.target.value }))} fullWidth />
            <Input label="불합격수량" type="number" value={form.failQty} onChange={e => setForm(p => ({ ...p, failQty: e.target.value }))} fullWidth />
          </div>
          <Select label="판정" options={[{ value: 'Y', label: '합격' }, { value: 'N', label: '불합격' }]} value={form.passYn} onChange={v => setForm(p => ({ ...p, passYn: v }))} fullWidth />
          <Input label="비고" value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button onClick={() => { console.log('검사 결과:', form); setIsModalOpen(false); }}><Save className="w-4 h-4 mr-1" />저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InputInspectPage;
