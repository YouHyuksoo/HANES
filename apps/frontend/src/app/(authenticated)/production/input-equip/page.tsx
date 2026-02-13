"use client";

/**
 * @file src/app/(authenticated)/production/input-equip/page.tsx
 * @description 실적입력(검사장비) 페이지 - 설비설정 + 검사범위 표시 포함
 *
 * 초보자 가이드:
 * 1. **목적**: 검사장비를 이용한 검사 실적 입력
 * 2. **검사범위**: 설비별 검사 기준 범위(상한/하한) 표시
 * 3. **측정값**: 실제 측정값을 입력하여 자동 합격/불합격 판정
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, Microscope, Gauge, CheckCircle, XCircle, Target } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

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

const mockData: EquipInspect[] = [
  { id: '1', orderNo: 'JO-20250126-001', partName: '메인 하네스 A', equipName: 'TESTER-001', lotNo: 'LOT-20250126-001', measuredValue: 4.8, lowerLimit: 4.5, upperLimit: 5.5, passYn: 'Y', inspectDate: '2025-01-26', inspector: '검사원A' },
  { id: '2', orderNo: 'JO-20250126-002', partName: '서브 하네스 B', equipName: 'TESTER-002', lotNo: 'LOT-20250126-002', measuredValue: 3.2, lowerLimit: 3.0, upperLimit: 4.0, passYn: 'Y', inspectDate: '2025-01-26', inspector: '검사원B' },
  { id: '3', orderNo: 'JO-20250125-001', partName: '도어 하네스 C', equipName: 'TESTER-001', lotNo: 'LOT-20250125-001', measuredValue: 6.2, lowerLimit: 4.5, upperLimit: 5.5, passYn: 'N', inspectDate: '2025-01-25', inspector: '검사원A' },
  { id: '4', orderNo: 'JO-20250125-002', partName: '엔진룸 하네스 D', equipName: 'TESTER-003', lotNo: 'LOT-20250125-002', measuredValue: 2.1, lowerLimit: 2.0, upperLimit: 3.0, passYn: 'Y', inspectDate: '2025-01-25', inspector: '검사원C' },
];

function InputEquipPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ orderNo: '', equipId: '', lotNo: '', measuredValue: '', remark: '' });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.equipName.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => ({
    total: mockData.length,
    pass: mockData.filter(d => d.passYn === 'Y').length,
    fail: mockData.filter(d => d.passYn === 'N').length,
    passRate: mockData.length > 0 ? Math.round((mockData.filter(d => d.passYn === 'Y').length / mockData.length) * 100) : 0,
  }), []);

  const columns = useMemo<ColumnDef<EquipInspect>[]>(() => [
    { accessorKey: 'orderNo', header: '작업지시번호', size: 160 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'equipName', header: '검사장비', size: 110 },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 150 },
    {
      id: 'range', header: '검사범위', size: 120,
      cell: ({ row }) => <span className="text-text-muted text-xs">{row.original.lowerLimit} ~ {row.original.upperLimit}</span>,
    },
    {
      accessorKey: 'measuredValue', header: '측정값', size: 90,
      cell: ({ row }) => {
        const { measuredValue, lowerLimit, upperLimit } = row.original;
        const inRange = measuredValue >= lowerLimit && measuredValue <= upperLimit;
        return <span className={inRange ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{measuredValue}</span>;
      },
    },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Microscope className="w-7 h-7 text-primary" />실적입력 (검사장비)</h1>
          <p className="text-text-muted mt-1">검사장비를 이용한 검사 실적을 입력합니다</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Save className="w-4 h-4 mr-1" />검사 입력</Button>
      </div>

      {/* 검사범위 안내 */}
      <Card><CardContent>
        <div className="flex items-center gap-2 mb-2"><Gauge className="w-5 h-5 text-primary" /><span className="font-semibold text-text">검사장비 설정</span></div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-2 bg-background rounded"><span className="text-text-muted">TESTER-001</span><p className="text-text font-medium">범위: 4.5 ~ 5.5</p></div>
          <div className="p-2 bg-background rounded"><span className="text-text-muted">TESTER-002</span><p className="text-text font-medium">범위: 3.0 ~ 4.0</p></div>
          <div className="p-2 bg-background rounded"><span className="text-text-muted">TESTER-003</span><p className="text-text font-medium">범위: 2.0 ~ 3.0</p></div>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="검사 건수" value={stats.total} icon={Target} color="blue" />
        <StatCard label="합격" value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label="불합격" value={stats.fail} icon={XCircle} color="red" />
        <StatCard label="합격률" value={`${stats.passRate}%`} icon={Gauge} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="지시번호, 장비명 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="검사장비 결과 입력" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="작업지시" options={[{ value: 'JO-001', label: 'JO-20250126-001' }, { value: 'JO-002', label: 'JO-20250126-002' }]} value={form.orderNo} onChange={v => setForm(p => ({ ...p, orderNo: v }))} fullWidth />
            <Select label="검사장비" options={[{ value: 'T-001', label: 'TESTER-001 (4.5~5.5)' }, { value: 'T-002', label: 'TESTER-002 (3.0~4.0)' }, { value: 'T-003', label: 'TESTER-003 (2.0~3.0)' }]} value={form.equipId} onChange={v => setForm(p => ({ ...p, equipId: v }))} fullWidth />
          </div>
          <Input label="LOT번호" value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
          <Input label="측정값" type="number" step="0.1" value={form.measuredValue} onChange={e => setForm(p => ({ ...p, measuredValue: e.target.value }))} fullWidth />
          <Input label="비고" value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button onClick={() => { console.log('검사장비 결과:', form); setIsModalOpen(false); }}><Save className="w-4 h-4 mr-1" />저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InputEquipPage;
