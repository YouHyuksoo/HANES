"use client";

/**
 * @file src/app/(authenticated)/shipping/confirm/page.tsx
 * @description 출하확정 페이지 - 팔레트를 출하로 확정
 *
 * 초보자 가이드:
 * 1. **출하**: 고객사로 제품을 발송하는 최종 단계
 * 2. **상태 흐름**: PREPARING -> LOADED -> SHIPPED -> DELIVERED
 * 3. LOADED→SHIPPED 전환 시 팔레트 바코드 스캔 검증 필수
 * 4. API: 전용 엔드포인트 (mark-loaded, mark-shipped, mark-delivered)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Plus, Search, RefreshCw, CheckCircle, Package, Clock, MapPin, Upload, ArrowRight, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import { useComCodeOptions } from '@/hooks/useComCode';
import { usePartnerOptions } from '@/hooks/useMasterOptions';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ShipmentStatusBadge, ShipmentScanModal } from '@/components/shipping';
import type { ShipmentStatus } from '@/components/shipping';
import api from '@/services/api';

interface Shipment {
  id: string;
  shipNo: string;
  shipDate: string;
  customer: string;
  palletCount: number;
  boxCount: number;
  totalQty: number;
  status: ShipmentStatus;
  vehicleNo: string;
  driverName: string;
  destination: string;
  createdAt: string;
}

export default function ShipmentPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const comCodeOptions = useComCodeOptions('SHIPMENT_STATUS');
  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') }, ...comCodeOptions
  ], [t, comCodeOptions]);
  const { options: customerOptions } = usePartnerOptions('CUSTOMER');
  const customerFilterOptions = useMemo(() => [
    { value: '', label: t('shipping.confirm.allCustomers', '전체 고객사') }, ...customerOptions
  ], [t, customerOptions]);

  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [scanTarget, setScanTarget] = useState<Shipment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Shipment | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [createForm, setCreateForm] = useState({ shipDate: '', customerCode: '', vehicleNo: '', driverName: '', destination: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.shipNo = searchText;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer = customerFilter;
      const res = await api.get('/shipping/shipments', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, customerFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    preparing: data.filter((s) => s.status === 'PREPARING').length,
    loaded: data.filter((s) => s.status === 'LOADED').length,
    shipped: data.filter((s) => s.status === 'SHIPPED').length,
    delivered: data.filter((s) => s.status === 'DELIVERED').length,
  }), [data]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    try {
      await api.post('/shipping/shipments', createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ shipDate: '', customerCode: '', vehicleNo: '', driverName: '', destination: '' });
      fetchData();
    } catch (e) {
      console.error('Create failed:', e);
    } finally {
      setSaving(false);
    }
  }, [createForm, fetchData]);

  const handleStatusChange = useCallback(async (shipment: Shipment) => {
    if (shipment.status === 'DELIVERED') return;

    // LOADED → SHIPPED: 바코드 스캔 검증 모달 표시
    if (shipment.status === 'LOADED') {
      setScanTarget(shipment);
      setIsScanModalOpen(true);
      return;
    }

    // PREPARING → LOADED, SHIPPED → DELIVERED: 전용 엔드포인트 사용
    const endpointMap: Record<string, string> = {
      PREPARING: 'mark-loaded',
      SHIPPED: 'mark-delivered',
    };
    const endpoint = endpointMap[shipment.status];
    if (!endpoint) return;

    try {
      await api.post(`/shipping/shipments/${shipment.id}/${endpoint}`);
      fetchData();
    } catch (e) {
      console.error('Status change failed:', e);
    }
  }, [fetchData]);

  /** 출하 취소 */
  const handleCancelShipment = useCallback(async () => {
    if (!cancelTarget || !cancelRemark.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/shipping/shipments/${cancelTarget.id}/cancel`, {
        remark: cancelRemark.trim(),
      });
      setCancelTarget(null);
      setCancelRemark('');
      fetchData();
    } catch (e) {
      console.error('Cancel shipment failed:', e);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelRemark, fetchData]);

  const handleFormChange = (field: string, value: string) => setCreateForm((prev) => ({ ...prev, [field]: value }));

  const columns = useMemo<ColumnDef<Shipment>[]>(() => [
    { accessorKey: 'shipNo', header: t('shipping.confirm.shipmentNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'shipDate', header: t('shipping.confirm.shipDate'), size: 100, meta: { filterType: 'date' as const } },
    { accessorKey: 'customer', header: t('shipping.confirm.customer'), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'palletCount', header: t('shipping.confirm.pallet'), size: 80, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'boxCount', header: t('shipping.confirm.box'), size: 80, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'totalQty', header: t('common.totalQty'), size: 100, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: t('common.status'), size: 100, meta: { filterType: 'multi' as const }, cell: ({ getValue }) => <ShipmentStatusBadge status={getValue() as ShipmentStatus} /> },
    { accessorKey: 'vehicleNo', header: t('shipping.confirm.vehicleNo'), size: 100, meta: { filterType: 'text' as const } },
    { id: 'actions', header: '', size: 130, meta: { filterType: 'none' as const }, cell: ({ row }) => {
      const s = row.original;
      const canCancel = s.status === 'PREPARING' || s.status === 'LOADED';
      return (
        <div className="flex gap-1">
          <button className="p-1 hover:bg-surface rounded" title={t('shipping.confirm.changeStatus')}
            disabled={s.status === 'DELIVERED' || s.status === 'CANCELED'}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(s); }}>
            <ArrowRight className={`w-4 h-4 ${s.status === 'DELIVERED' || s.status === 'CANCELED' ? 'text-text-muted opacity-50' : 'text-primary'}`} />
          </button>
          {canCancel && (
            <button className="p-1 hover:bg-surface rounded" title={t('shipping.confirm.cancelShipment')}
              onClick={(e) => { e.stopPropagation(); setCancelTarget(s); }}>
              <XCircle className="w-4 h-4 text-red-500" />
            </button>
          )}
          <button className="p-1 hover:bg-surface rounded" title={t('shipping.confirm.syncERP')}
            onClick={(e) => e.stopPropagation()}>
            <Upload className="w-4 h-4 text-primary" />
          </button>
        </div>
      );
    } },
  ], [t, handleStatusChange]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />{t('shipping.confirm.title')}</h1>
          <p className="text-text-muted mt-1">{t('shipping.confirm.description')}</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> {t('shipping.confirm.createShipment')}</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('shipping.confirm.statPreparing')} value={stats.preparing} icon={Clock} color="yellow" />
        <StatCard label={t('shipping.confirm.statLoaded')} value={stats.loaded} icon={Package} color="blue" />
        <StatCard label={t('shipping.confirm.statShipped')} value={stats.shipped} icon={Truck} color="green" />
        <StatCard label={t('shipping.confirm.statDelivered')} value={stats.delivered} icon={CheckCircle} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('shipping.confirm.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('shipping.confirm.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={customerFilterOptions} value={customerFilter} onChange={setCustomerFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData} className="flex-shrink-0">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
            </div>
          }
          onRowClick={(row) => { setSelectedShipment(row); setIsDetailModalOpen(true); }} />
      </CardContent></Card>

      {/* 출하 등록 모달 */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t('shipping.confirm.createShipment')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('shipping.confirm.shipDate')} type="date" value={createForm.shipDate} onChange={(e) => handleFormChange('shipDate', e.target.value)} fullWidth />
            <Select label={t('shipping.confirm.customer')} options={customerOptions} value={createForm.customerCode} onChange={(v) => handleFormChange('customerCode', v)} fullWidth />
            <Input label={t('shipping.confirm.vehicleNo')} placeholder="12가 3456" value={createForm.vehicleNo} onChange={(e) => handleFormChange('vehicleNo', e.target.value)} fullWidth />
            <Input label={t('shipping.confirm.driver')} placeholder={t('shipping.confirm.driverPlaceholder')} value={createForm.driverName} onChange={(e) => handleFormChange('driverName', e.target.value)} fullWidth />
          </div>
          <Input label={t('shipping.confirm.destination')} placeholder={t('shipping.confirm.destinationPlaceholder')} value={createForm.destination} onChange={(e) => handleFormChange('destination', e.target.value)} leftIcon={<MapPin className="w-4 h-4" />} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? t('common.saving') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 상세 모달 */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={t('shipping.confirm.detail')} size="lg">
        {selectedShipment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.shipmentNo')}</p><p className="font-medium text-text">{selectedShipment.shipNo}</p></div>
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.shipDate')}</p><p className="font-medium text-text">{selectedShipment.shipDate}</p></div>
              <div><p className="text-sm text-text-muted">{t('shipping.confirm.customer')}</p><p className="font-medium text-text">{selectedShipment.customer}</p></div>
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

      {/* 출하 취소 모달 */}
      <Modal isOpen={!!cancelTarget} onClose={() => { setCancelTarget(null); setCancelRemark(''); }} title={t('shipping.confirm.cancelShipment')} size="lg">
        <div className="space-y-4">
          {cancelTarget && (
            <div className="p-3 bg-surface-secondary rounded-lg space-y-1 text-sm">
              <p><span className="text-text-muted">{t('shipping.confirm.shipmentNo')}:</span> {cancelTarget.shipNo}</p>
              <p><span className="text-text-muted">{t('shipping.confirm.customer')}:</span> {cancelTarget.customer}</p>
              <p><span className="text-text-muted">{t('shipping.confirm.shipDate')}:</span> {cancelTarget.shipDate}</p>
              <p><span className="text-text-muted">{t('shipping.confirm.pallet')}:</span> {cancelTarget.palletCount} / <span className="text-text-muted">{t('shipping.confirm.box')}:</span> {cancelTarget.boxCount}</p>
            </div>
          )}
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{t('shipping.confirm.cancelWarning')}</p>
          </div>
          <Input
            label={t('shipping.confirm.cancelReason')}
            placeholder={t('shipping.confirm.cancelReasonPlaceholder')}
            value={cancelRemark}
            onChange={(e) => setCancelRemark(e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => { setCancelTarget(null); setCancelRemark(''); }}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleCancelShipment} disabled={!cancelRemark.trim() || cancelling}>
              {cancelling ? t('common.processing') : t('shipping.confirm.confirmCancel')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 바코드 스캔 검증 모달 (LOADED → SHIPPED) */}
      {scanTarget && (
        <ShipmentScanModal
          isOpen={isScanModalOpen}
          onClose={() => { setIsScanModalOpen(false); setScanTarget(null); }}
          shipmentId={scanTarget.id}
          shipmentNo={scanTarget.shipNo}
          onConfirm={fetchData}
        />
      )}
    </div>
  );
}
