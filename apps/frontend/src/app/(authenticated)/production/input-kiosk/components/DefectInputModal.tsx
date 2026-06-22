"use client";

/**
 * @file components/DefectInputModal.tsx
 * @description 불량입력 모달 — 불량 유형/수량을 등록하고 실적 저장 시 함께 반영
 *
 * 초보자 가이드:
 * - 불량 유형: DEFECT_TYPE 공통코드 (useComCode 훅)
 * - pendingDefects: kioskStore에 임시 저장 → 실적저장 버튼 클릭 시 defect-logs API 호출
 * - 동일 불량코드 재입력 시 수량 합산
 * - 목록에서 X 클릭으로 삭제 가능
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useKioskStore } from '@/stores/kioskStore';
import { useComCodeList } from '@/hooks/useComCode';
import toast from 'react-hot-toast';
import { formatQty, parseQty } from '@/utils/qty';

interface DefectInputModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DefectInputModal({ isOpen, onClose }: DefectInputModalProps) {
  const { t } = useTranslation();
  const { pendingDefects, addPendingDefect, removePendingDefect } = useKioskStore();
  const defectCodes = useComCodeList('DEFECT_TYPE');

  const [selectedCode, setSelectedCode] = useState('');
  const [qty, setQty] = useState('1');

  const selectedCodeInfo = defectCodes.find(c => c.detailCode === selectedCode);

  const handleAdd = useCallback(() => {
    if (!selectedCode) {
      toast.error(t('kiosk.defect.selectType'));
      return;
    }
    const qtyNum = parseQty(qty);
    if (!qtyNum || qtyNum < 1) {
      toast.error(t('kiosk.defect.qtyMin'));
      return;
    }
    addPendingDefect({
      defectCode: selectedCode,
      defectName: selectedCodeInfo?.codeName ?? selectedCode,
      qty: qtyNum,
    });
    toast.success(t('kiosk.defect.added', { name: selectedCodeInfo?.codeName ?? selectedCode }));
    setSelectedCode('');
    setQty('1');
  }, [selectedCode, qty, selectedCodeInfo, addPendingDefect, t]);

  const totalDefectQty = pendingDefects.reduce((s, d) => s + d.qty, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('kiosk.defect.title')}
      size="md"
    >
      <div className="space-y-4">

        {/* 불량 입력 폼 */}
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              {t('kiosk.defect.addDefect')}
            </span>
          </div>

          <div className="flex gap-2">
            {/* 불량 유형 셀렉트 */}
            <select
              value={selectedCode}
              onChange={e => setSelectedCode(e.target.value)}
              className="flex-1 h-9 px-2 text-sm bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-red-400"
            >
              <option value="">{t('kiosk.defect.selectType')}</option>
              {defectCodes.map(c => (
                <option key={c.detailCode} value={c.detailCode}>{c.codeName}</option>
              ))}
            </select>

            {/* 수량 */}
            <input
              type="text"
              inputMode="numeric"
              value={qty === '' ? '' : formatQty(parseQty(qty))}
              onChange={e => setQty(e.target.value)}
              className="w-20 h-9 text-center text-sm font-bold bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-red-400"
            />

            {/* 추가 버튼 */}
            <Button
              variant="danger"
              onClick={handleAdd}
              className="h-9 px-3 shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 등록된 불량 목록 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-text">
              {t('kiosk.defect.registeredList')}
            </span>
            {totalDefectQty > 0 && (
              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
                {t('kiosk.defect.totalQty')}: {totalDefectQty.toLocaleString()}
              </span>
            )}
          </div>

          {pendingDefects.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              {t('kiosk.defect.empty')}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {pendingDefects.map(d => (
                <div
                  key={d.defectCode}
                  className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded-lg"
                >
                  <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-text">{d.defectName}</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums shrink-0">
                    {(d.qty ?? 0).toLocaleString()} {t('common.unit.ea')}
                  </span>
                  <button
                    onClick={() => removePendingDefect(d.defectCode)}
                    className="shrink-0 p-1 text-text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 안내 문구 */}
        {pendingDefects.length > 0 && (
          <p className="text-xs text-text-muted bg-surface/50 border border-border/50 rounded p-2">
            {t('kiosk.defect.saveHint')}
          </p>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          {pendingDefects.length > 0 && (
            <Button onClick={onClose}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {t('kiosk.defect.confirm', { count: totalDefectQty })}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
