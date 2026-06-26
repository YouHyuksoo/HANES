"use client";

/**
 * @file PoLineReceiptModal.tsx
 * @description IQC005 PO 1라인 입하 등록 모달
 *
 * 초보자 가이드:
 * 1. 단일 라인 폼: 입하수량, 입하일, 제조사(필수), 시리얼수량단위(read-only), 예상시리얼수, 비고
 * 2. 저장 → onConfirm 호출 (부모에서 SerialIssueConfirmModal 띄움)
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '@/components/ui';
import MfgPartnerSelect from '@/components/shared/MfgPartnerSelect';
import { QtyInput } from '@/components/shared';
import { useWarehouseOptions } from '@/hooks/useMasterOptions';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import type { PoLineRow, PoLineReceiptInput } from './types';

interface PoLineReceiptModalProps {
  isOpen: boolean;
  line: PoLineRow | null;
  onClose: () => void;
  onConfirm: (input: PoLineReceiptInput, expectedCount: number) => void;
}

const formatQuantity = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString();
};

export default function PoLineReceiptModal({ isOpen, line, onClose, onConfirm }: PoLineReceiptModalProps) {
  const { t } = useTranslation();
  const { options: warehouses } = useWarehouseOptions('RAW');

  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [mfgPartnerCode, setMfgPartnerCode] = useState('');
  const [receivedDate, setReceivedDate] = useState<string>(() => getTodayLocal());
  const [remark, setRemark] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [lotUnitQty, setLotUnitQty] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && line) {
      setReceivedQty(0);
      setMfgPartnerCode('');
      setReceivedDate(getTodayLocal());
      setRemark('');
      setWarehouseCode(warehouses[0]?.value ?? '');
      api.get(`/master/parts/code/${encodeURIComponent(line.itemCode)}`, { suppressErrorModal: true })
        .then((res) => setLotUnitQty(res.data?.data?.lotUnitQty ?? null))
        .catch(() => setLotUnitQty(null));
    }
  }, [isOpen, line, warehouses]);

  const expectedCount = useMemo(() => {
    if (!receivedQty) return 0;
    if (!lotUnitQty || lotUnitQty <= 0) return 1;
    return Math.ceil(receivedQty / lotUnitQty);
  }, [receivedQty, lotUnitQty]);

  const today = getTodayLocal();
  const canSave = !!line
    && receivedQty > 0
    && receivedQty <= (line?.remainingQty ?? 0)
    && !!mfgPartnerCode
    && !!warehouseCode
    && receivedDate <= today;

  const handleSave = () => {
    if (!canSave || !line) return;
    onConfirm({
      poNo: line.poNo,
      lineNo: line.lineNo,
      revNo: line.revNo,
      receivedQty,
      mfgPartnerCode,
      receivedDate,
      remark: remark || undefined,
      warehouseCode,
    }, expectedCount);
  };

  if (!line) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.modal.receiveTitle')} size="lg">
      <div className="flex flex-col gap-4">
        {/* PO 정보 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3 text-sm">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            {line.poNo} / L{line.lineNo} / R{line.revNo}
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">[{line.itemCode}]</span> {line.itemName}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {t('material.arrival.col.vendor')}: <b>{line.partnerName}</b>
          </div>
        </div>

        {/* 입하/발주/잔량 */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded p-3 flex items-center justify-end gap-2 text-sm">
          <span className="font-bold text-teal-600 dark:text-teal-400 text-base">{line.receivedQty.toLocaleString()}</span>
          <span className="text-slate-500 dark:text-slate-400">/</span>
          <span>{line.orderQty.toLocaleString()}</span>
          <span className="ml-4 text-blue-700 dark:text-blue-400 font-bold">
            {t('material.arrival.col.remainingQty')} {line.remainingQty.toLocaleString()}
          </span>
        </div>

        {/* 폼 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.receivedQty')}<span className="text-red-500 ml-0.5">*</span></span>
            <div className="flex items-stretch gap-1">
              <div className="flex-1">
                <QtyInput
                  maxValue={line.remainingQty}
                  value={receivedQty}
                  onChange={setReceivedQty}
                  className="text-right font-semibold"
                  fullWidth
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setReceivedQty(line.remainingQty)}
                disabled={line.remainingQty <= 0}
              >
                {t('material.arrival.fillRemaining', '잔량입하')}
              </Button>
            </div>
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.receivedDate')}<span className="text-red-500 ml-0.5">*</span></span>
            <Input
              type="date"
              max={today}
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.mfgPartner')}<span className="text-red-500 ml-0.5">*</span></span>
            <MfgPartnerSelect
              value={mfgPartnerCode}
              onChange={setMfgPartnerCode}
              required
              fullWidth
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.warehouse')}<span className="text-red-500 ml-0.5">*</span></span>
            <Select
              options={warehouses}
              value={warehouseCode}
              onChange={setWarehouseCode}
              placeholder={t('material.arrival.selectWarehouse')}
              fullWidth
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.serialUnitQty')}</span>
            <Input
              type="text"
              value={lotUnitQty === null ? t('material.arrival.singleLot') : formatQuantity(lotUnitQty)}
              disabled
              className="text-right bg-gray-50 dark:bg-gray-800/50 text-slate-600 dark:text-slate-400"
            />
            <span className="text-xs text-slate-500">{t('material.arrival.serialUnitNote')}</span>
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span>{t('material.arrival.col.expectedSerialCount')}</span>
            <div className="h-10 border border-gray-200 rounded px-3 flex items-center justify-between bg-white">
              <span className="text-xs text-slate-500">
                {receivedQty.toLocaleString()} ÷ {formatQuantity(lotUnitQty)} →
              </span>
              <span className="font-bold text-pink-600 text-lg">{t('material.arrival.confirm.serialCountUnit', '{{count}}개', { count: expectedCount })}</span>
            </div>
          </label>
        </div>

        <label className="text-sm flex flex-col gap-1">
          <span>{t('common.remark')}</span>
          <textarea
            rows={2}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder={t('common.remarkOptional')}
          />
        </label>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-2 text-xs text-slate-600 dark:text-slate-400">
          <b className="text-yellow-700 dark:text-yellow-400">⚠ {t('common.confirm')}</b> · {t('material.arrival.confirm.notice')}
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
        <span className="text-xs text-slate-500">{t('common.requiredMark')}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!canSave}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
