"use client";

/**
 * @file src/app/(authenticated)/production/input-machine/page.tsx
 * @description 실적입력(가공) 페이지 - 설비설정 + 점검확인 + 소모부품 체크 포함
 *
 * 초보자 가이드:
 * 1. **목적**: 가공 공정에서 설비를 선택하고 실적을 입력
 * 2. **설비 점검**: 실적 입력 전 설비 점검 상태 확인 필수
 * 3. **소모부품**: 사용된 소모부품 체크 기능
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, Cog, Settings, Shield, Package, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

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
  const [inspectConfirmed, setInspectConfirmed] = useState(false);
  const [checkedParts, setCheckedParts] = useState<string[]>([]);
  const [form, setForm] = useState({ orderNo: '', equipId: '', workerName: '', lotNo: '', goodQty: '', defectQty: '', cycleTime: '', remark: '' });

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    return item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.equipName.toLowerCase().includes(searchText.toLowerCase());
  }), [searchText]);

  const stats = useMemo(() => ({
    count: mockData.length,
    totalGood: mockData.reduce((s, r) => s + r.goodQty, 0),
    totalDefect: mockData.reduce((s, r) => s + r.defectQty, 0),
    avgCycle: Math.round(mockData.reduce((s, r) => s + r.cycleTime, 0) / mockData.length),
  }), []);

  const togglePart = (p: string) => setCheckedParts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const columns = useMemo<ColumnDef<MachineResult>[]>(() => [
    { accessorKey: 'orderNo', header: '작업지시번호', size: 160 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'equipName', header: '설비', size: 100 },
    { accessorKey: 'workerName', header: '작업자', size: 80 },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 130 },
    { accessorKey: 'goodQty', header: '양품', size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: '불량', size: 80, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'cycleTime', header: 'CT(초)', size: 70 },
    { accessorKey: 'inspectChecked', header: '점검', size: 70, cell: ({ getValue }) => getValue() ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" /> },
    { accessorKey: 'workDate', header: '작업일', size: 100 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Cog className="w-7 h-7 text-primary" />실적입력 (가공)</h1>
          <p className="text-text-muted mt-1">가공 공정의 설비별 생산실적을 입력합니다</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Save className="w-4 h-4 mr-1" />실적 입력</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="입력 건수" value={stats.count} icon={Package} color="blue" />
        <StatCard label="양품 합계" value={stats.totalGood} icon={CheckCircle} color="green" />
        <StatCard label="불량 합계" value={stats.totalDefect} icon={XCircle} color="red" />
        <StatCard label="평균 CT" value={`${stats.avgCycle}초`} icon={Settings} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="지시번호, 설비명 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="가공 실적 입력" size="lg">
        <div className="space-y-4">
          {/* 설비 점검 확인 */}
          <div className="p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-orange-500" /><span className="font-semibold text-text">설비 점검 확인</span></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={inspectConfirmed} onChange={e => setInspectConfirmed(e.target.checked)} className="rounded" />
              <span className="text-sm text-text">설비 점검을 완료하였습니다</span>
            </label>
          </div>
          {/* 소모부품 체크 */}
          <div className="p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2 mb-2"><Settings className="w-5 h-5 text-blue-500" /><span className="font-semibold text-text">소모부품 사용 체크</span></div>
            <div className="grid grid-cols-2 gap-2">
              {consumableParts.map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer text-sm text-text">
                  <input type="checkbox" checked={checkedParts.includes(p)} onChange={() => togglePart(p)} className="rounded" />{p}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="작업지시" options={[{ value: 'JO-001', label: 'JO-20250126-001 (메인 하네스 A)' }]} value={form.orderNo} onChange={v => setForm(p => ({ ...p, orderNo: v }))} fullWidth />
            <Select label="설비" options={[{ value: 'CNC-001', label: 'CNC-001' }, { value: 'CNC-002', label: 'CNC-002' }, { value: 'PRESS-001', label: 'PRESS-001' }]} value={form.equipId} onChange={v => setForm(p => ({ ...p, equipId: v }))} fullWidth />
            <Input label="작업자" value={form.workerName} onChange={e => setForm(p => ({ ...p, workerName: e.target.value }))} fullWidth />
            <Input label="LOT번호" value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
            <Input label="양품 수량" type="number" value={form.goodQty} onChange={e => setForm(p => ({ ...p, goodQty: e.target.value }))} fullWidth />
            <Input label="불량 수량" type="number" value={form.defectQty} onChange={e => setForm(p => ({ ...p, defectQty: e.target.value }))} fullWidth />
            <Input label="사이클타임(초)" type="number" value={form.cycleTime} onChange={e => setForm(p => ({ ...p, cycleTime: e.target.value }))} fullWidth />
          </div>
          <Input label="비고" value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button onClick={() => { console.log('가공 실적:', form, { inspectConfirmed, checkedParts }); setIsModalOpen(false); }} disabled={!inspectConfirmed}><Save className="w-4 h-4 mr-1" />저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InputMachinePage;
