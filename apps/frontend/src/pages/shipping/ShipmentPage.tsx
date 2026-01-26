/**
 * @file src/pages/shipping/ShipmentPage.tsx
 * @description 출하확정 페이지 - 팔레트를 출하로 확정
 *
 * 초보자 가이드:
 * 1. **출하**: 고객사로 제품을 발송하는 최종 단계
 * 2. **상태 흐름**: PREPARING -> LOADED -> SHIPPED -> DELIVERED
 * 3. **ERP 동기화**: 출하 정보를 ERP 시스템에 전송
 */
import { useState, useMemo } from 'react';
import { Truck, Plus, Search, RefreshCw, CheckCircle, Package, Clock, MapPin, Calendar, Upload, ArrowRight } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ShipmentStatusBadge, StatCard } from './components';
import type { ShipmentStatus } from './components';

interface Shipment { id: string; shipmentNo: string; shipDate: string; customerCode: string; customerName: string; palletCount: number; boxCount: number; totalQty: number; status: ShipmentStatus; vehicleNo: string; driverName: string; destination: string; createdAt: string; }

const mockShipments: Shipment[] = [
  { id: '1', shipmentNo: 'SHP-20250126-001', shipDate: '2025-01-26', customerCode: 'CUST-001', customerName: '현대자동차', palletCount: 3, boxCount: 15, totalQty: 1050, status: 'PREPARING', vehicleNo: '12가 3456', driverName: '김운전', destination: '울산공장', createdAt: '2025-01-26 08:00' },
  { id: '2', shipmentNo: 'SHP-20250126-002', shipDate: '2025-01-26', customerCode: 'CUST-002', customerName: '기아자동차', palletCount: 2, boxCount: 10, totalQty: 700, status: 'LOADED', vehicleNo: '34나 5678', driverName: '이운전', destination: '광명공장', createdAt: '2025-01-26 09:00' },
  { id: '3', shipmentNo: 'SHP-20250125-001', shipDate: '2025-01-25', customerCode: 'CUST-001', customerName: '현대자동차', palletCount: 4, boxCount: 20, totalQty: 1400, status: 'SHIPPED', vehicleNo: '56다 7890', driverName: '박운전', destination: '아산공장', createdAt: '2025-01-25 08:00' },
  { id: '4', shipmentNo: 'SHP-20250124-001', shipDate: '2025-01-24', customerCode: 'CUST-003', customerName: 'GM코리아', palletCount: 2, boxCount: 8, totalQty: 560, status: 'DELIVERED', vehicleNo: '78라 1234', driverName: '최운전', destination: '부평공장', createdAt: '2025-01-24 10:00' },
];

const customerOptions = [{ value: '', label: '전체 고객사' }, { value: 'CUST-001', label: '현대자동차' }, { value: 'CUST-002', label: '기아자동차' }, { value: 'CUST-003', label: 'GM코리아' }];
const statusOptions = [{ value: '', label: '전체 상태' }, { value: 'PREPARING', label: 'PREPARING (준비중)' }, { value: 'LOADED', label: 'LOADED (적재완료)' }, { value: 'SHIPPED', label: 'SHIPPED (출하완료)' }, { value: 'DELIVERED', label: 'DELIVERED (배송완료)' }];

function ShipmentPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [createForm, setCreateForm] = useState({ shipDate: '', customerCode: '', vehicleNo: '', driverName: '', destination: '' });

  const filteredShipments = useMemo(() => mockShipments.filter((s) => (!statusFilter || s.status === statusFilter) && (!customerFilter || s.customerCode === customerFilter) && (!dateFilter || s.shipDate === dateFilter) && (!searchText || s.shipmentNo.toLowerCase().includes(searchText.toLowerCase()) || s.customerName.toLowerCase().includes(searchText.toLowerCase()))), [statusFilter, customerFilter, dateFilter, searchText]);
  const stats = useMemo(() => ({ preparing: mockShipments.filter((s) => s.status === 'PREPARING').length, loaded: mockShipments.filter((s) => s.status === 'LOADED').length, shipped: mockShipments.filter((s) => s.status === 'SHIPPED').length, delivered: mockShipments.filter((s) => s.status === 'DELIVERED').length }), []);

  const handleCreate = () => { console.log('출하 생성:', createForm); setIsCreateModalOpen(false); setCreateForm({ shipDate: '', customerCode: '', vehicleNo: '', driverName: '', destination: '' }); };
  const handleStatusChange = (shipment: Shipment) => { const next: Record<ShipmentStatus, ShipmentStatus | null> = { PREPARING: 'LOADED', LOADED: 'SHIPPED', SHIPPED: 'DELIVERED', DELIVERED: null }; if (next[shipment.status]) console.log(`출하 ${shipment.shipmentNo} 상태 변경: ${shipment.status} -> ${next[shipment.status]}`); };
  const handleSyncERP = (shipment: Shipment) => { console.log('ERP 동기화:', shipment.shipmentNo); };
  const handleFormChange = (field: string, value: string) => setCreateForm((prev) => ({ ...prev, [field]: value }));

  const columns = useMemo<ColumnDef<Shipment>[]>(() => [
    { accessorKey: 'shipmentNo', header: '출하번호', size: 160 },
    { accessorKey: 'shipDate', header: '출하일', size: 100 },
    { accessorKey: 'customerName', header: '고객사', size: 120 },
    { accessorKey: 'palletCount', header: '팔레트', size: 80, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'boxCount', header: '박스', size: 80, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'totalQty', header: '총수량', size: 100, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: '상태', size: 100, cell: ({ getValue }) => <ShipmentStatusBadge status={getValue() as ShipmentStatus} /> },
    { accessorKey: 'vehicleNo', header: '차량번호', size: 100 },
    { id: 'actions', header: '작업', size: 140, cell: ({ row }) => (<div className="flex gap-1"><Button variant="ghost" size="sm" disabled={row.original.status === 'DELIVERED'} onClick={() => handleStatusChange(row.original)} title="상태 변경"><ArrowRight className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleSyncERP(row.original)} title="ERP 동기화"><Upload className="w-4 h-4" /></Button></div>) },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />출하확정</h1><p className="text-text-muted mt-1">팔레트를 출하로 확정하고 배송을 관리합니다.</p></div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> 출하 생성</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="준비중" value={stats.preparing} icon={Clock} color="yellow" />
        <StatCard label="적재완료" value={stats.loaded} icon={Package} color="blue" />
        <StatCard label="출하완료" value={stats.shipped} icon={Truck} color="green" />
        <StatCard label="배송완료" value={stats.delivered} icon={CheckCircle} color="purple" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="출하번호, 고객사 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
            <div className="w-40"><Select options={customerOptions} value={customerFilter} onChange={setCustomerFilter} fullWidth /></div>
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-text-muted" /><Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36" /></div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredShipments} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedShipment(row); setIsDetailModalOpen(true); }} />
        </CardContent>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="출하 생성" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="출하일" type="date" value={createForm.shipDate} onChange={(e) => handleFormChange('shipDate', e.target.value)} fullWidth />
            <Select label="고객사" options={customerOptions.slice(1)} value={createForm.customerCode} onChange={(v) => handleFormChange('customerCode', v)} fullWidth />
            <Input label="차량번호" placeholder="12가 3456" value={createForm.vehicleNo} onChange={(e) => handleFormChange('vehicleNo', e.target.value)} fullWidth />
            <Input label="운전자" placeholder="운전자명" value={createForm.driverName} onChange={(e) => handleFormChange('driverName', e.target.value)} fullWidth />
          </div>
          <Input label="배송지" placeholder="배송 주소 또는 공장명" value={createForm.destination} onChange={(e) => handleFormChange('destination', e.target.value)} leftIcon={<MapPin className="w-4 h-4" />} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>취소</Button><Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> 생성</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="출하 상세" size="md">
        {selectedShipment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-text-muted">출하번호</p><p className="font-medium text-text">{selectedShipment.shipmentNo}</p></div>
              <div><p className="text-sm text-text-muted">출하일</p><p className="font-medium text-text">{selectedShipment.shipDate}</p></div>
              <div><p className="text-sm text-text-muted">고객사</p><p className="font-medium text-text">{selectedShipment.customerName}</p></div>
              <div><p className="text-sm text-text-muted">상태</p><ShipmentStatusBadge status={selectedShipment.status} /></div>
              <div><p className="text-sm text-text-muted">차량번호</p><p className="font-medium text-text">{selectedShipment.vehicleNo}</p></div>
              <div><p className="text-sm text-text-muted">운전자</p><p className="font-medium text-text">{selectedShipment.driverName}</p></div>
              <div className="col-span-2"><p className="text-sm text-text-muted">배송지</p><p className="font-medium text-text">{selectedShipment.destination}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-4 p-4 bg-background rounded-lg">
              <div className="text-center"><p className="text-2xl font-bold text-primary">{selectedShipment.palletCount}</p><p className="text-sm text-text-muted">팔레트</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-primary">{selectedShipment.boxCount}</p><p className="text-sm text-text-muted">박스</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-primary">{selectedShipment.totalQty.toLocaleString()}</p><p className="text-sm text-text-muted">총수량</p></div>
            </div>
            <div className="flex justify-end"><Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>닫기</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ShipmentPage;
