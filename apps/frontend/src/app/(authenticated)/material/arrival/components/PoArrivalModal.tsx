"use client";

/**
 * @file src/app/(authenticated)/material/arrival/components/PoArrivalModal.tsx
 * @description PO 기반 입하 등록 모달 - 2단계 UI
 *
 * 초보자 가이드:
 * 1. **Step 1**: 입하 가능 PO 목록에서 PO 선택
 * 2. **Step 2**: 선택된 PO의 품목별 입하수량 입력 + 창고 선택
 * 3. **분할 입하**: 잔량 범위 내에서 부분 입하 가능
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';
import { Modal, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useWarehouseOptions } from '@/hooks/useMasterOptions';
import api from '@/services/api';
import type { ReceivablePO, PoItemForArrival, ArrivalItemInput } from './types';

interface PoArrivalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PoArrivalModal({ isOpen, onClose, onSuccess }: PoArrivalModalProps) {
  const { t } = useTranslation();
  const { options: warehouses } = useWarehouseOptions();
  const [step, setStep] = useState<1 | 2>(1);
  const [poList, setPoList] = useState<ReceivablePO[]>([]);
  const [selectedPO, setSelectedPO] = useState<ReceivablePO | null>(null);
  const [poItems, setPoItems] = useState<PoItemForArrival[]>([]);
  const [inputs, setInputs] = useState<Record<string, ArrivalItemInput>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedPO(null);
      setInputs({});
      fetchReceivablePOs();
    }
  }, [isOpen]);

  const fetchReceivablePOs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/arrivals/receivable-pos');
      setPoList(res.data.data || []);
    } catch { setPoList([]); }
    setLoading(false);
  };

  const handleSelectPO = async (po: ReceivablePO) => {
    setSelectedPO(po);
    setLoading(true);
    try {
      const res = await api.get(`/material/arrivals/po/${po.id}/items`);
      const data = res.data.data;
      const items: PoItemForArrival[] = data?.items || [];
      setPoItems(items);
      const init: Record<string, ArrivalItemInput> = {};
      items.forEach((item) => {
        init[item.id] = {
          poItemId: item.id,
          partId: item.partId,
          receivedQty: 0,
          warehouseId: warehouses[0]?.value || '',
        };
      });
      setInputs(init);
    } catch { setPoItems([]); }
    setLoading(false);
    setStep(2);
  };

  const updateInput = useCallback((poItemId: string, field: keyof ArrivalItemInput, value: string | number) => {
    setInputs((prev) => ({
      ...prev,
      [poItemId]: { ...prev[poItemId], [field]: value },
    }));
  }, []);

  const handleSubmit = async () => {
    if (!selectedPO) return;
    const validItems = Object.values(inputs).filter((i) => i.receivedQty > 0);
    if (validItems.length === 0) return;

    setSubmitting(true);
    try {
      await api.post('/material/arrivals/po', {
        poId: selectedPO.id,
        items: validItems,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('PO 입하 등록 실패:', err);
    }
    setSubmitting(false);
  };

  /** Step 1: PO 목록 컬럼 */
  const poColumns = useMemo<ColumnDef<ReceivablePO>[]>(() => [
    { accessorKey: 'poNo', header: t('material.arrival.col.poNo'), size: 140 },
    { accessorKey: 'partnerName', header: t('material.arrival.col.vendor'), size: 120 },
    {
      accessorKey: 'orderDate',
      header: t('material.arrival.col.orderDate'),
      size: 100,
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) || '-',
    },
    {
      accessorKey: 'dueDate',
      header: t('material.arrival.col.dueDate'),
      size: 100,
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) || '-',
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 90,
      cell: ({ getValue }) => {
        const st = getValue() as string;
        const color = st === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{st}</span>;
      },
    },
    {
      id: 'remaining',
      header: t('material.arrival.col.remainingQty'),
      size: 100,
      cell: ({ row }) => (
        <span className="font-medium text-orange-600">{row.original.totalRemainingQty.toLocaleString()}</span>
      ),
    },
  ], [t]);

  /** Step 2: PO 품목 컬럼 */
  const itemColumns = useMemo<ColumnDef<PoItemForArrival>[]>(() => [
    { id: 'partCode', header: t('common.partCode'), size: 110, cell: ({ row }) => row.original.part?.partCode },
    { id: 'partName', header: t('common.partName'), size: 130, cell: ({ row }) => row.original.part?.partName },
    { accessorKey: 'orderQty', header: t('material.arrival.col.orderQty'), size: 80 },
    { accessorKey: 'receivedQty', header: t('material.arrival.col.receivedQty'), size: 80 },
    {
      accessorKey: 'remainingQty',
      header: t('material.arrival.col.remainingQty'),
      size: 80,
      cell: ({ getValue }) => <span className="text-orange-600 font-medium">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      id: 'inputQty',
      header: t('material.arrival.col.inputQty'),
      size: 100,
      cell: ({ row }) => (
        <Input
          type="number"
          min={0}
          max={row.original.remainingQty}
          value={inputs[row.original.id]?.receivedQty || 0}
          onChange={(e) => {
            const val = Math.min(Number(e.target.value) || 0, row.original.remainingQty);
            updateInput(row.original.id, 'receivedQty', val);
          }}
          className="w-20"
        />
      ),
    },
    {
      id: 'manufactureDate',
      header: t('material.arrival.col.manufactureDate'),
      size: 140,
      cell: ({ row }) => (
        <Input
          type="date"
          value={inputs[row.original.id]?.manufactureDate || ''}
          onChange={(e) => updateInput(row.original.id, 'manufactureDate', e.target.value)}
          className="w-[130px]"
        />
      ),
    },
    {
      id: 'warehouse',
      header: t('material.arrival.col.warehouse'),
      size: 130,
      cell: ({ row }) => (
        <Select
          options={warehouses}
          value={inputs[row.original.id]?.warehouseId || ''}
          onChange={(v) => updateInput(row.original.id, 'warehouseId', v)}
          placeholder={t('material.arrival.selectWarehouse')}
        />
      ),
    },
  ], [t, inputs, warehouses, updateInput]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.poArrival')} size="full">
      {step === 1 ? (
        <div>
          <p className="text-sm text-text-muted mb-3">{t('material.arrival.selectPoDesc')}</p>
          {loading ? (
            <div className="py-10 text-center text-text-muted">{t('common.loading')}</div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <DataGrid
                data={poList}
                columns={poColumns}
                pageSize={10}
                isLoading={loading}
                onRowClick={(row) => handleSelectPO(row)}
              />
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t('common.back')}
            </Button>
            <span className="text-sm font-medium">
              {selectedPO?.poNo} - {selectedPO?.partnerName}
            </span>
          </div>
          {loading ? (
            <div className="py-10 text-center text-text-muted">{t('common.loading')}</div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <DataGrid data={poItems} columns={itemColumns} pageSize={50} isLoading={loading} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
            <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('common.processing') : t('common.register')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
