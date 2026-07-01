"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarcodeScanInput } from '@/components/shared';
import { Modal, Button } from '@/components/ui';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

interface OrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}
interface OrderData {
  shipOrderNo: string;
  customerName?: string;
  status: string;
  items: OrderLine[];
}
interface ShippedRow {
  boxNo: string;
  itemCode: string;
  qty: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onShipped?: () => void; // 출하 1건 성공 시 부모 목록 갱신
  initialShipOrderNo?: string;
}

export default function BoxScanShipModal({ isOpen, onClose, onShipped, initialShipOrderNo }: Props) {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  const [orderNoInput, setOrderNoInput] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [boxInput, setBoxInput] = useState('');
  const [rows, setRows] = useState<ShippedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [shipping, setShipping] = useState(false);
  const boxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setOrderNoInput(''); setOrder(null); setBoxInput(''); setRows([]); setError(null);
    }
  }, [isOpen]);

  const loadOrder = useCallback(async (no: string) => {
    const code = no.trim();
    if (!code) return;
    setLoadingOrder(true); setError(null);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(code)}`);
      const data = res.data?.data as OrderData;
      if (data.status !== 'CONFIRMED') {
        setError(t('shipping.boxScan.notConfirmed', '확정(CONFIRMED) 상태의 출하지시만 출하할 수 있습니다.'));
        setOrder(null);
        return;
      }
      setOrder(data); setRows([]);
      setTimeout(() => boxRef.current?.focus(), 50);
    } catch {
      setError(t('shipping.boxScan.orderNotFound', '출하지시를 찾을 수 없습니다.'));
      setOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen || !initialShipOrderNo) return;
    setOrderNoInput(initialShipOrderNo);
    loadOrder(initialShipOrderNo);
  }, [isOpen, initialShipOrderNo, loadOrder]);

  const shipBox = useCallback(async (box: string) => {
    const boxNo = box.trim();
    if (!boxNo || !order) return;
    if (rows.some((r) => r.boxNo === boxNo)) {
      setError(t('shipping.boxScan.duplicate', '이미 스캔한 박스입니다.'));
      setBoxInput(''); return;
    }
    setShipping(true); setError(null);
    try {
      const res = await api.post(`/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/ship-box`, {
        boxNo,
        workerId: userId,
      });
      const d = res.data?.data as { itemCode: string; qty: number; lineShippedQty: number; orderStatus: string };
      setRows((prev) => [{ boxNo, itemCode: d.itemCode, qty: d.qty }, ...prev]);
      setOrder((prev) => prev && ({
        ...prev,
        status: d.orderStatus,
        items: prev.items.map((it) => it.itemCode === d.itemCode ? { ...it, shippedQty: d.lineShippedQty } : it),
      }));
      onShipped?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('shipping.boxScan.shipFailed', '출하 처리에 실패했습니다.'));
    } finally {
      setBoxInput('');
      setShipping(false);
      setTimeout(() => boxRef.current?.focus(), 50);
    }
  }, [order, rows, userId, t, onShipped]);

  const cancelBox = useCallback(async (boxNo: string) => {
    if (!order) return;
    setShipping(true); setError(null);
    try {
      const res = await api.post(`/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/cancel-ship-box`, {
        boxNo,
        workerId: userId,
      });
      const d = res.data?.data as { itemCode: string; lineShippedQty: number; orderStatus: string };
      setRows((prev) => prev.filter((r) => r.boxNo !== boxNo));
      setOrder((prev) => prev && ({
        ...prev,
        status: d.orderStatus,
        items: prev.items.map((it) => it.itemCode === d.itemCode ? { ...it, shippedQty: d.lineShippedQty } : it),
      }));
      onShipped?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('shipping.boxScan.cancelFailed', '출하 취소에 실패했습니다.'));
    } finally {
      setShipping(false);
      setTimeout(() => boxRef.current?.focus(), 50);
    }
  }, [order, userId, t, onShipped]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('shipping.boxScan.title', '박스 스캔 출하')} size="xl">
      <div className="space-y-4">
        {!initialShipOrderNo && (
          <div className="flex gap-2 items-end">
            <BarcodeScanInput
              label={t('shipping.boxScan.shipOrderNo', '출하지시번호')}
              placeholder={t('shipping.boxScan.scanOrder', '출하지시 바코드 스캔/입력')}
              value={orderNoInput}
              onChange={setOrderNoInput}
              onScan={loadOrder}
              fullWidth
            />
            <Button onClick={() => loadOrder(orderNoInput)} disabled={loadingOrder}>
              {t('common.search', '조회')}
            </Button>
          </div>
        )}

        {order && (
          <div className="p-3 bg-surface-secondary rounded-lg space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-muted">{t('shipping.boxScan.shipOrderNo', '출하지시번호')}</span>
              <span className="font-mono text-lg font-bold text-primary">{order.shipOrderNo}</span>
            </div>
            <div className="flex gap-4">
              <span><span className="text-text-muted">{t('shipping.boxScan.customer', '고객사')}:</span> {order.customerName ?? '-'}</span>
              <span><span className="text-text-muted">{t('common.status', '상태')}:</span> {order.status}</span>
            </div>
            <div className="space-y-1">
              {order.items.map((it) => (
                <div key={it.itemCode} className="flex items-center justify-between">
                  <span className="font-mono">{it.itemCode} {it.itemName ? `(${it.itemName})` : ''}</span>
                  <span className={it.shippedQty >= it.orderQty ? 'text-green-600 font-medium' : ''}>
                    {it.shippedQty} / {it.orderQty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order && order.status === 'CONFIRMED' && (
          <BarcodeScanInput
            ref={boxRef}
            label={t('shipping.boxScan.boxNo', '박스 바코드')}
            placeholder={t('shipping.boxScan.scanBox', '박스 바코드 스캔')}
            value={boxInput}
            onChange={setBoxInput}
            onScan={shipBox}
            disabled={shipping}
            fullWidth
          />
        )}

        {error && (
          <div className="flex items-center gap-2 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
            <XCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {rows.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-60 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.boxNo} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><span className="font-mono">{r.boxNo}</span></span>
                <span className="text-text-muted">{r.itemCode}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{r.qty}</span>
                  <button
                    type="button"
                    title={t('shipping.boxScan.cancelBox', '출하 취소')}
                    className="p-1 hover:bg-surface rounded disabled:opacity-50"
                    disabled={shipping}
                    onClick={() => cancelBox(r.boxNo)}
                  >
                    <XCircle className="w-4 h-4 text-red-500" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.close', '닫기')}</Button>
        </div>
      </div>
    </Modal>
  );
}
