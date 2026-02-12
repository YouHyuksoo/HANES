"use client";

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
import { useTranslation } from 'react-i18next';
import { Truck, Plus, Search, RefreshCw, CheckCircle, Package, Clock, MapPin, Calendar, Upload, ArrowRight } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import { useComCodeOptions } from '@/hooks/useComCode';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { StatCard } from '@/components/ui';
import { ShipmentStatusBadge } from '@/components/shipping';
import type { ShipmentStatus } from '@/components/shipping';

interface Shipment { id: string; shipmentNo: string; shipDate: string; customerCode: string; customerName: string; palletCount: number; boxCount: number; totalQty: number; status: ShipmentStatus; vehicleNo: string; driverName: string; destination: string; createdAt: string; }

const mockShipments: Shipment[] = [
  { id: '1', shipmentNo: 'SHP-20250126-001', shipDate: '2025-01-26', customerCode: 'CUST-001', customerName: '현대자동차', palletCount: 3, boxCount: 15, totalQty: 1050, status: 'PREPARING', vehicleNo: '12가 3456', driverName: '김운전', destination: '울산공장', createdAt: '2025-01-26 08:00' },
  { id: '2', shipmentNo: 'SHP-20250126-002', shipDate: '2025-01-26', customerCode: 'CUST-002', customerName: '기아자동차', palletCount: 2, boxCount: 10, totalQty: 700, status: 'LOADED', vehicleNo: '34나 5678', driverName: '이운전', destination: '광명공장', createdAt: '2025-01-26 09:00' },
  { id: '3', shipmentNo: 'SHP-20250125-001', shipDate: '2025-01-25', customerCode: 'CUST-001', customerName: '현대자동차', palletCount: 4, boxCount: 20, totalQty: 1400, status: 'SHIPPED', vehicleNo: '56다 7890', driverName: '박운전', destination: '아산공장', createdAt: '2025-01-25 08:00' },
  { id: '4', shipmentNo: 'SHP-20250124-001', shipDate: '2025-01-24', customerCode: 'CUST-003', customerName: 'GM코리아', palletCount: 2, boxCount: 8, totalQty: 560, status: 'DELIVERED', vehicleNo: '78라 1234', driverName: '최운전', destination: '부평공장', createdAt: '2025-01-24 10:00' },
];

const customerOptions = [{ value: '', label: '전체 고객사' }, { value: 'CUST-001', label: '현대자동차' }, { value: 'CUST-002', label: '기아자동차' }, { value: 'CUST-003', label: 'GM코리아' }];

function ShipmentPage() {
  const { t } = useTranslation();
  const comCodeOptions = useComCodeOptions('SHIPMENT_STATUS');
  const statusOptions = [{ value: '', label: t('common.allStatus') }, ...comCodeOptions];
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
    { accessorKey: 'shipmentNo', header: t('shipping.confirm.shipmentNo'), size: 160 },
    { accessorKey: 'shipDate', header: t('shipping.confirm.shipDate'), size: 100 },
    { accessorKey: 'customerName', header: t('shipping.confirm.customer'), size: 120 },
    { accessorKey: 'palletCount', header: t('shipping.confirm.pallet'), size: 80, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'boxCount', header: t('shipping.confirm.box'), size: 80, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'totalQty', header: t('common.totalQty'), size: 100, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: t('common.status'), size: 100, cell: ({ getValue }) => <ShipmentStatusBadge status={getValue() as ShipmentStatus} /> },
    { accessorKey: 'vehicleNo', header: t('shipping.confirm.vehicleNo'), size: 100 },
    { id: 'actions', header: t('common.actions'), size: 140, cell: ({ row }) => (<div className="flex gap-1"><button className="p-1 hover:bg-surface rounded" title={t('shipping.confirm.changeStatus')} disabled={row.original.status === 'DELIVERED'} onClick={() => handleStatusChange(row.original)}><ArrowRight className={`w-4 h-4 ${row.original.status === 'DELIVERED' ? 'text-text-muted opacity-50' : 'text-primary'}`} /></button><button className="p-1 hover:bg-surface rounded" title={t('shipping.confirm.syncERP')} onClick={() => handleSyncERP(row.original)}><Upload className="w-4 h-4 text-primary" /></button></div>) },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div><h1 className="text-xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />{t('shipping.confirm.title')}</h1><p className="text-text-muted mt-1">{t('shipping.confirm.description')}</p></div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> {t('shipping.confirm.createShipment')}</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('shipping.confirm.statPreparing')} value={stats.preparing} icon={Clock} color="yellow" />
        <StatCard label={t('shipping.confirm.statLoaded')} value={stats.loaded} icon={Package} color="blue" />
        <StatCard label={t('shipping.confirm.statShipped')} value={stats.shipped} icon={Truck} color="green" />
        <StatCard label={t('shipping.confirm.statDelivered')} value={stats.delivered} icon={CheckCircle} color="purple" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder={t('shipping.confirm.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
            <div className="w-40"><Select options={customerOptions} value={customerFilter} onChange={setCustomerFilter} fullWidth /></div>
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-text-muted" /><Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36" /></div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredShipments} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedShipment(row); setIsDetailModalOpen(true); }} />
        </CardContent>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t('shipping.confirm.createShipment')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('shipping.confirm.shipDate')} type="date" value={createForm.shipDate} onChange={(e) => handleFormChange('shipDate', e.target.value)} fullWidth />
            <Select label={t('shipping.confirm.customer')} options={customerOptions.slice(1)} value={createForm.customerCode} onChange={(v) => handleFormChange('customerCode', v)} fullWidth />
            <Input label={t('shipping.confirm.vehicleNo')} placeholder="12가 3456" value={createForm.vehicleNo} onChange={(e) => handleFormChange('vehicleNo', e.target.value)} fullWidth />
            <Input label={t('shipping.confirm.driver')} placeholder={t('shipping.confirm.driverPlaceholder')} value={createForm.driverName} onChange={(e) => handleFormChange('driverName', e.target.value)} fullWidth />
          </div>
          <Input label={t('shipping.confirm.destination')} placeholder={t('shipping.confirm.destinationPlaceholder')} value={createForm.destination} onChange={(e) => handleFormChange('destination', e.target.value)} leftIcon={<MapPin className="w-4 h-4" />} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> {t('common.create')}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={t('shipping.confirm.detail')} size="md">
        {selectedShipment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.shipmentNo')}</p><p className="font-medium text-text">{selectedShipment.shipmentNo}</p></div>
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.shipDate')}</p><p className="font-medium text-text">{selectedShipment.shipDate}</p></div>
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.customer')}</p><p className="font-medium text-text">{selectedShipment.customerName}</p></div>
              <div><p className="text-sm text-text-muted">{t('common.status')}</p><ShipmentStatusBadge status={selectedShipment.status} /></div>
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.vehicleNo')}</p><p className="font-medium text-text">{selectedShipment.vehicleNo}</p></div>
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.driver')}</p><p className="font-medium text-text">{selectedShipment.driverName}</p></div>
              <div className="col-span-2"><p className="text-sm text-text-muted">{t('shipping.confirm.destination')}</p><p className="font-medium text-text">{selectedShipment.destination}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-4 p-4 bg-background rounded-lg">
              <div className="text-center"><p className="text-lg font-bold leading-tight text-primary">{selectedShipment.palletCount}</p><p className="text-sm text-text-muted">{t('shipping.confirm.pallet')}</p></div>
              <div className="text-center"><p className="text-lg font-bold leading-tight text-primary">{selectedShipment.boxCount}</p><p className="text-sm text-text-muted">{t('shipping.confirm.box')}</p></div>
              <div className="text-center"><p className="text-lg font-bold leading-tight text-primary">{selectedShipment.totalQty.toLocaleString()}</p><p className="text-sm text-text-muted">{t('common.totalQty')}</p></div>
            </div>
            <div className="flex justify-end"><Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>{t('common.close')}</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ShipmentPage;
