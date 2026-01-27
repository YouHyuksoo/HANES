/**
 * @file src/pages/shipping/PalletPage.tsx
 * @description 팔레트적재 페이지 - 박스를 팔레트에 적재
 *
 * 초보자 가이드:
 * 1. **팔레트**: 여러 박스를 묶어 운송하는 물류 단위
 * 2. **상태 흐름**: OPEN -> CLOSED -> LOADED -> SHIPPED
 * 3. **박스 할당**: 포장 완료된 박스를 팔레트에 적재
 */
import { useState, useMemo } from 'react';
import { Layers, Plus, Search, RefreshCw, Lock, Truck, Package, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import { useComCodeOptions } from '@/hooks/useComCode';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { StatCard } from '@/components/ui';
import { PalletStatusBadge } from './components';
import type { PalletStatus } from './components';

interface PalletBox { boxNo: string; partName: string; quantity: number; }
interface Pallet { id: string; palletNo: string; boxCount: number; totalQty: number; status: PalletStatus; shipmentNo: string | null; createdAt: string; closedAt: string | null; boxes: PalletBox[]; }

const mockPallets: Pallet[] = [
  { id: '1', palletNo: 'PLT-20250126-001', boxCount: 4, totalQty: 280, status: 'OPEN', shipmentNo: null, createdAt: '2025-01-26 10:00', closedAt: null, boxes: [{ boxNo: 'BOX-20250126-001', partName: '메인 하네스 A', quantity: 50 }, { boxNo: 'BOX-20250126-002', partName: '서브 하네스 B', quantity: 100 }, { boxNo: 'BOX-20250126-003', partName: '메인 하네스 A', quantity: 50 }, { boxNo: 'BOX-20250126-004', partName: '도어 하네스 C', quantity: 80 }] },
  { id: '2', palletNo: 'PLT-20250126-002', boxCount: 6, totalQty: 420, status: 'CLOSED', shipmentNo: null, createdAt: '2025-01-26 09:00', closedAt: '2025-01-26 14:00', boxes: Array.from({ length: 6 }, (_, i) => ({ boxNo: `BOX-20250126-${String(i + 5).padStart(3, '0')}`, partName: '메인 하네스 A', quantity: 70 })) },
  { id: '3', palletNo: 'PLT-20250125-001', boxCount: 5, totalQty: 350, status: 'LOADED', shipmentNo: 'SHP-20250126-001', createdAt: '2025-01-25 14:00', closedAt: '2025-01-25 17:00', boxes: Array.from({ length: 5 }, (_, i) => ({ boxNo: `BOX-20250125-${String(i + 1).padStart(3, '0')}`, partName: '서브 하네스 B', quantity: 70 })) },
  { id: '4', palletNo: 'PLT-20250124-001', boxCount: 3, totalQty: 210, status: 'SHIPPED', shipmentNo: 'SHP-20250125-001', createdAt: '2025-01-24 10:00', closedAt: '2025-01-24 15:00', boxes: Array.from({ length: 3 }, (_, i) => ({ boxNo: `BOX-20250124-${String(i + 1).padStart(3, '0')}`, partName: '도어 하네스 C', quantity: 70 })) },
];

const availableBoxes = [{ boxNo: 'BOX-20250126-011', partName: '메인 하네스 A', quantity: 50 }, { boxNo: 'BOX-20250126-012', partName: '서브 하네스 B', quantity: 80 }, { boxNo: 'BOX-20250126-013', partName: '도어 하네스 C', quantity: 60 }];

function PalletPage() {
  const comCodeOptions = useComCodeOptions('PALLET_STATUS');
  const statusOptions = [{ value: '', label: '전체 상태' }, ...comCodeOptions];
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const filteredPallets = useMemo(() => mockPallets.filter((p) => (!statusFilter || p.status === statusFilter) && (!searchText || p.palletNo.toLowerCase().includes(searchText.toLowerCase()) || (p.shipmentNo?.toLowerCase().includes(searchText.toLowerCase()) ?? false))), [statusFilter, searchText]);
  const stats = useMemo(() => ({ open: mockPallets.filter((p) => p.status === 'OPEN').length, closed: mockPallets.filter((p) => p.status === 'CLOSED').length, loaded: mockPallets.filter((p) => p.status === 'LOADED').length, shipped: mockPallets.filter((p) => p.status === 'SHIPPED').length }), []);

  const handleCreate = () => { console.log('팔레트 생성'); setIsCreateModalOpen(false); };
  const handleAssignBoxes = () => { if (selectedPallet && selectedBoxes.length > 0) { console.log(`팔레트 ${selectedPallet.palletNo}에 박스 할당:`, selectedBoxes); setSelectedBoxes([]); setIsAssignModalOpen(false); } };
  const handleClosePallet = (pallet: Pallet) => { console.log('팔레트 닫기:', pallet.palletNo); };
  const toggleBoxSelection = (boxNo: string) => setSelectedBoxes((prev) => prev.includes(boxNo) ? prev.filter((b) => b !== boxNo) : [...prev, boxNo]);

  const columns = useMemo<ColumnDef<Pallet>[]>(() => [
    { accessorKey: 'palletNo', header: '팔레트번호', size: 160 },
    { accessorKey: 'boxCount', header: '박스수', size: 80, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'totalQty', header: '총수량', size: 100, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: '상태', size: 100, cell: ({ getValue }) => <PalletStatusBadge status={getValue() as PalletStatus} /> },
    { accessorKey: 'shipmentNo', header: '출하번호', size: 150, cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span> },
    { accessorKey: 'createdAt', header: '생성일시', size: 140 },
    { id: 'actions', header: '작업', size: 120, cell: ({ row }) => {
      const pallet = row.original;
      return (<div className="flex gap-1"><button className="p-1 hover:bg-surface rounded" title="박스할당" disabled={pallet.status !== 'OPEN'} onClick={() => { setSelectedPallet(pallet); setIsAssignModalOpen(true); }}><Plus className={`w-4 h-4 ${pallet.status === 'OPEN' ? 'text-primary' : 'text-text-muted opacity-50'}`} /></button><button className="p-1 hover:bg-surface rounded" title="팔레트닫기" disabled={pallet.status !== 'OPEN'} onClick={() => handleClosePallet(pallet)}><Lock className={`w-4 h-4 ${pallet.status === 'OPEN' ? 'text-primary' : 'text-text-muted opacity-50'}`} /></button></div>);
    }},
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div><h1 className="text-xl font-bold text-text flex items-center gap-2"><Layers className="w-7 h-7 text-primary" />팔레트적재</h1><p className="text-text-muted mt-1">박스를 팔레트에 적재하여 출하를 준비합니다.</p></div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> 팔레트 생성</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="진행중" value={stats.open} icon={Layers} color="blue" />
        <StatCard label="적재완료" value={stats.closed} icon={CheckCircle} color="green" />
        <StatCard label="차량적재" value={stats.loaded} icon={Truck} color="orange" />
        <StatCard label="출하" value={stats.shipped} icon={Package} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]"><Input placeholder="팔레트번호, 출하번호 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
                <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
                <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
              </div>
              <DataGrid data={filteredPallets} columns={columns} pageSize={10} onRowClick={(row) => setSelectedPallet(row)} />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader title="포함된 박스" subtitle={selectedPallet ? selectedPallet.palletNo : '팔레트를 선택하세요'} />
          <CardContent>
            {selectedPallet ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectedPallet.boxes.map((box, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg"><div><p className="font-mono text-sm text-text">{box.boxNo}</p><p className="text-xs text-text-muted">{box.partName}</p></div><span className="text-sm font-medium text-text">{box.quantity}개</span></div>))}
              </div>
            ) : (<div className="text-center py-8 text-text-muted"><Layers className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>팔레트를 선택하면<br />박스 목록이 표시됩니다</p></div>)}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="팔레트 생성" size="sm">
        <div className="space-y-4"><p className="text-text-muted">새 팔레트를 생성하시겠습니까?</p><p className="text-sm text-text-muted">팔레트 번호는 자동으로 부여됩니다.</p><div className="flex justify-end gap-2 pt-4 border-t border-border"><Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>취소</Button><Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> 생성</Button></div></div>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="박스 할당" size="md">
        <div className="space-y-4">
          {selectedPallet && (<div className="p-3 bg-background rounded-lg"><p className="text-sm text-text-muted">팔레트: <span className="font-medium text-text">{selectedPallet.palletNo}</span></p></div>)}
          <p className="text-sm text-text-muted">할당할 박스를 선택하세요:</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableBoxes.map((box) => (<div key={box.boxNo} onClick={() => toggleBoxSelection(box.boxNo)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedBoxes.includes(box.boxNo) ? 'bg-primary/10 border-2 border-primary' : 'bg-background hover:bg-surface border-2 border-transparent'}`}><div><p className="font-mono text-sm text-text">{box.boxNo}</p><p className="text-xs text-text-muted">{box.partName}</p></div><span className="text-sm font-medium text-text">{box.quantity}개</span></div>))}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border"><span className="text-sm text-text-muted">선택: {selectedBoxes.length}개</span><div className="flex gap-2"><Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>취소</Button><Button onClick={handleAssignBoxes} disabled={selectedBoxes.length === 0}><ArrowRight className="w-4 h-4 mr-1" /> 할당</Button></div></div>
        </div>
      </Modal>
    </div>
  );
}

export default PalletPage;
