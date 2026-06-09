"use client";

/**
 * @file src/app/(authenticated)/material/receive/page.tsx
 * @description 자재입고관리 페이지 - IQC 합격건 스캔 방식 입고 등록
 *
 * 초보자 가이드:
 * 1. 입고대기 그리드는 입고 대상 확인용이다.
 * 2. 입고처리 버튼을 누른 뒤 거래처 바코드와 자체부착 바코드를 순환 스캔한다.
 * 3. 스캔된 매핑만 입고 확정된다.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus, RefreshCw, ScanLine, Search } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import api from '@/services/api';
import ReceivableTable from './components/ReceivableTable';
import ReceiveScanModal from './components/ReceiveScanModal';
import type { ReceivableLot } from './components/types';

export default function ReceivingPage() {
  const { t } = useTranslation();

  const [receivable, setReceivable] = useState<ReceivableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  /** 입고 가능 LOT 조회 */
  const fetchReceivable = useCallback(async () => {
    try {
      const res = await api.get('/material/receiving/receivable');
      const lots: ReceivableLot[] = res.data.data || [];
      setReceivable(lots);
    } catch { setReceivable([]); }
  }, []);

  /** 전체 새로고침 */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchReceivable();
    setLoading(false);
  }, [fetchReceivable]);

  useEffect(() => { refresh(); }, [refresh]);

  /** 검색 필터링 */
  const filtered = searchText
    ? receivable.filter((lot) => {
        const q = searchText.toLowerCase();
        return lot.matUid.toLowerCase().includes(q)
          || lot.part?.itemCode?.toLowerCase().includes(q)
          || lot.part?.itemName?.toLowerCase().includes(q)
          || lot.vendor?.toLowerCase().includes(q)
          || lot.poNo?.toLowerCase().includes(q);
    })
    : receivable;

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            {t('material.receive.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.receive.description')}</p>
        </div>
        <Button size="sm" onClick={() => setScanOpen(true)}>
          <ScanLine className="w-4 h-4 mr-1" />
          입고처리
        </Button>
      </div>

      {/* 입고대기 테이블 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <ReceivableTable
            data={filtered}
            isLoading={loading}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.receive.searchPlaceholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <Button variant="secondary" onClick={refresh} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ReceiveScanModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onSuccess={refresh}
        receivable={receivable}
      />
    </div>
  );
}
