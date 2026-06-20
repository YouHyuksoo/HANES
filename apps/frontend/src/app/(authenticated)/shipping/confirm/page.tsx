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
import { Truck, Search, RefreshCw, Upload, ArrowRight, XCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import { useComCodeOptions } from '@/hooks/useComCode';
import { usePartnerOptions } from '@/hooks/useMasterOptions';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ShipmentStatusBadge, ShipmentScanModal } from '@/components/shipping';
import type { ShipmentStatus } from '@/components/shipping';
import api from '@/services/api';
import OrderFulfillmentModal from './OrderFulfillmentModal';

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

interface ShipOrderLineSummary {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}

interface ShipOrderSummary {
  shipOrderNo: string;
  customerName?: string;
  shipDate?: string;
  dueDate?: string;
  status: string;
  items: ShipOrderLineSummary[];
}

export default function ShipmentPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Shipment[]>([]);
  const [shipOrders, setShipOrders] = useState<ShipOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingShipOrders, setLoadingShipOrders] = useState(false);

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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isFulfillmentOpen, setIsFulfillmentOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedShipOrderNo, setSelectedShipOrderNo] = useState<string | null>(null);
  const [scanTarget, setScanTarget] = useState<Shipment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Shipment | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<Shipment | null>(null);
  const [reverseRemark, setReverseRemark] = useState('');
  const [reversing, setReversing] = useState(false);

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

  const fetchShipOrders = useCallback(async () => {
    setLoadingShipOrders(true);
    try {
      const res = await api.get('/shipping/orders', { params: { status: 'CONFIRMED', limit: '5000' } });
      const list: ShipOrderSummary[] = res.data?.data ?? [];
      const unshipped = list.filter((order) =>
        order.items?.some((item) => item.orderQty > item.shippedQty),
      );
      setShipOrders(unshipped);
      setSelectedShipOrderNo((current) =>
        current && unshipped.some((order) => order.shipOrderNo === current) ? current : null,
      );
    } catch {
      setShipOrders([]);
      setSelectedShipOrderNo(null);
    } finally {
      setLoadingShipOrders(false);
    }
  }, []);

  useEffect(() => { fetchShipOrders(); }, [fetchShipOrders]);

  const handleRefresh = useCallback(() => {
    fetchData();
    fetchShipOrders();
  }, [fetchData, fetchShipOrders]);

  const openFulfillmentForOrder = useCallback((order: ShipOrderSummary) => {
    setSelectedShipOrderNo(order.shipOrderNo);
    setIsFulfillmentOpen(true);
  }, []);

  const handleFulfillmentChanged = useCallback(() => {
    fetchData();
    fetchShipOrders();
  }, [fetchData, fetchShipOrders]);

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
      await api.post(`/shipping/shipments/${shipment.shipNo}/${endpoint}`);
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
      await api.post(`/shipping/shipments/${cancelTarget.shipNo}/cancel`, {
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

  /** 출하 역분개 (SHIPPED → LOADED, 제품재고 복원). ERP 연동분은 서버에서 차단됨 */
  const handleReverseShipment = useCallback(async () => {
    if (!reverseTarget || !reverseRemark.trim()) return;
    setReversing(true);
    try {
      await api.post(`/shipping/shipments/${reverseTarget.shipNo}/reverse`, {
        remark: reverseRemark.trim(),
      });
      setReverseTarget(null);
      setReverseRemark('');
      fetchData();
    } catch (e) {
      console.error('Reverse shipment failed:', e);
    } finally {
      setReversing(false);
    }
  }, [reverseTarget, reverseRemark, fetchData]);

  const shipOrderColumns = useMemo<ColumnDef<ShipOrderSummary>[]>(() => [
    { accessorKey: 'shipOrderNo', header: t('shipping.shipOrder.shipOrderNo', '출하지시번호'), size: 150, meta: { filterType: 'text' as const } },
    { accessorKey: 'customerName', header: t('shipping.confirm.customer'), size: 120, meta: { filterType: 'text' as const }, cell: ({ getValue }) => getValue() || '-' },
    {
      id: 'remainingQty',
      header: t('shipping.confirm.remainingQty', '잔여수량'),
      size: 90,
      meta: { align: 'right' as const, filterType: 'number' as const },
      cell: ({ row }) => {
        const remaining = row.original.items.reduce((sum, item) => sum + Math.max(0, item.orderQty - item.shippedQty), 0);
        return <span className="font-medium text-primary">{remaining.toLocaleString()}</span>;
      },
    },
    { accessorKey: 'shipDate', header: t('shipping.confirm.shipDate'), size: 105, meta: { filterType: 'date' as const }, cell: ({ getValue }) => getValue() || '-' },
  ], [t]);

  const columns = useMemo<ColumnDef<Shipment>[]>(() => [
    { accessorKey: 'shipNo', header: t('shipping.confirm.shipmentNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'shipDate', header: t('shipping.confirm.shipDate'), size: 100, meta: { filterType: 'date' as const } },
    { accessorKey: 'customer', header: t('shipping.confirm.customer'), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'palletCount', header: t('shipping.confirm.pallet'), size: 80, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'boxCount', header: t('shipping.confirm.box'), size: 80, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: 'totalQty', header: t('common.totalQty'), size: 100, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
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
          {s.status === 'SHIPPED' && (
            <button className="p-1 hover:bg-surface rounded" title={t('shipping.confirm.reverseShipment', '출하 역분개')}
              onClick={(e) => { e.stopPropagation(); setReverseTarget(s); }}>
              <RotateCcw className="w-4 h-4 text-amber-500" />
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
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />{t('shipping.confirm.title')}</h1>
          <p className="text-text-muted mt-1">{t('shipping.confirm.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(340px,0.45fr)_minmax(0,1fr)] gap-4 flex-1 min-h-0">
        <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text">{t('shipping.confirm.unshippedOrders', '미출하 출하지시')}</h2>
              <p className="text-xs text-text-muted mt-1">{t('shipping.confirm.unshippedOrdersHint', '행을 선택하면 출하지시 기준 팔레트 작업을 시작합니다.')}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchShipOrders}>
              <RefreshCw className={`w-4 h-4 ${loadingShipOrders ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <DataGrid
              data={shipOrders}
              columns={shipOrderColumns}
              isLoading={loadingShipOrders}
              enableColumnFilter
              enableExport
              exportFileName={t('shipping.confirm.unshippedOrders', '미출하 출하지시')}
              onRowClick={openFulfillmentForOrder}
              selectedRowId={selectedShipOrderNo ?? undefined}
              getRowId={(row) => row.shipOrderNo}
              emptyMessage={t('shipping.confirm.noUnshippedOrders', '미출하 출하지시가 없습니다.')}
              sqlQuery={`SELECT so.SHIP_ORDER_NO, so.CUSTOMER_ID, so.SHIP_DATE, soi.ITEM_CODE, soi.ORDER_QTY, soi.SHIPPED_QTY\nFROM SHIPMENT_ORDERS so\nJOIN SHIPMENT_ORDER_ITEMS soi ON soi.SHIP_ORDER_ID = so.SHIP_ORDER_NO\nWHERE so.COMPANY = '40'\n  AND so.PLANT_CD = '1000'\n  AND so.STATUS = 'CONFIRMED'\n  AND soi.SHIPPED_QTY < soi.ORDER_QTY\nORDER BY so.CREATED_AT DESC`}
            />
          </div>
        </CardContent></Card>

        <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
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
              </div>
            }
            onRowClick={(row) => { setSelectedShipment(row); setIsDetailModalOpen(true); }}
            sqlQuery={`SELECT *\nFROM SHIPPING_CONFIRMS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

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

      {/* 출하 역분개 모달 (SHIPPED → LOADED) */}
      <Modal isOpen={!!reverseTarget} onClose={() => { setReverseTarget(null); setReverseRemark(''); }} title={t('shipping.confirm.reverseShipment', '출하 역분개')} size="lg">
        <div className="space-y-4">
          {reverseTarget && (
            <div className="p-3 bg-surface-secondary rounded-lg space-y-1 text-sm">
              <p><span className="text-text-muted">{t('shipping.confirm.shipmentNo')}:</span> {reverseTarget.shipNo}</p>
              <p><span className="text-text-muted">{t('shipping.confirm.customer')}:</span> {reverseTarget.customer}</p>
              <p><span className="text-text-muted">{t('shipping.confirm.shipDate')}:</span> {reverseTarget.shipDate}</p>
            </div>
          )}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t('shipping.confirm.reverseWarning', '출하를 LOADED 상태로 되돌리고 제품재고를 복원합니다. ERP 연동된 출하는 역분개할 수 없습니다.')}
            </p>
          </div>
          <Input
            label={t('shipping.confirm.reverseReason', '역분개 사유')}
            value={reverseRemark}
            onChange={(e) => setReverseRemark(e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => { setReverseTarget(null); setReverseRemark(''); }}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleReverseShipment} disabled={!reverseRemark.trim() || reversing}>
              {reversing ? t('common.processing') : t('shipping.confirm.reverseShipment', '출하 역분개')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 바코드 스캔 검증 모달 (LOADED → SHIPPED) */}
      {scanTarget && (
        <ShipmentScanModal
          isOpen={isScanModalOpen}
          onClose={() => { setIsScanModalOpen(false); setScanTarget(null); }}
          shipmentId={scanTarget.shipNo}
          shipmentNo={scanTarget.shipNo}
          onConfirm={fetchData}
        />
      )}

      <OrderFulfillmentModal
        isOpen={isFulfillmentOpen}
        shipOrderNo={selectedShipOrderNo}
        onClose={() => setIsFulfillmentOpen(false)}
        onChanged={handleFulfillmentChanged}
      />
    </div>
  );
}
