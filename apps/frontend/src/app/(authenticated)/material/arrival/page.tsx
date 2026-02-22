"use client";

/**
 * @file src/app/(authenticated)/material/arrival/page.tsx
 * @description 입하관리 페이지 - PO 기반/수동 입하 등록 및 이력 조회
 *
 * 초보자 가이드:
 * 1. **PO 입하**: 발주(PO) 기반 분할/전량 입하 등록
 * 2. **수동 입하**: PO 없이 직접 품목 지정하여 입하
 * 3. **입하 취소**: 역분개 방식으로 +/- 이력 관리
 * 4. **통계 카드**: 오늘 입하건수/수량, 미입하 PO 수, 전체건수
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, PackageCheck, Package, AlertTriangle, Hash, Search, RefreshCw, Plus } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import api from '@/services/api';
import PoArrivalModal from './components/PoArrivalModal';
import ManualArrivalModal from './components/ManualArrivalModal';
import ArrivalCancelModal from './components/ArrivalCancelModal';
import ArrivalHistoryTable from './components/ArrivalHistoryTable';
import type { ArrivalRecord, ArrivalStats } from './components/types';

const INITIAL_STATS: ArrivalStats = { todayCount: 0, todayQty: 0, unrecevedPoCount: 0, totalCount: 0 };

export default function ArrivalPage() {
  const { t } = useTranslation();

  // 상태
  const [records, setRecords] = useState<ArrivalRecord[]>([]);
  const [stats, setStats] = useState<ArrivalStats>(INITIAL_STATS);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 모달
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ArrivalRecord | null>(null);

  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'DONE', label: t('material.arrival.status.done') },
    { value: 'CANCELED', label: t('material.arrival.status.canceled') },
  ];

  /** 이력 조회 */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/arrivals', {
        params: {
          page, limit: 10,
          ...(searchText && { search: searchText }),
          ...(statusFilter && { status: statusFilter }),
        },
      });
      setRecords(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch { setRecords([]); }
    setLoading(false);
  }, [page, searchText, statusFilter]);

  /** 통계 조회 */
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/material/arrivals/stats');
      setStats(res.data.data || INITIAL_STATS);
    } catch { /* 무시 */ }
  }, []);

  /** 데이터 새로고침 */
  const refresh = useCallback(() => {
    fetchRecords();
    fetchStats();
  }, [fetchRecords, fetchStats]);

  useEffect(() => { refresh(); }, [refresh]);

  /** 등록 성공 콜백 */
  const handleSuccess = () => {
    setPage(1);
    refresh();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            {t('material.arrival.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.arrival.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setIsPoModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('material.arrival.poArrival')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setIsManualModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('material.arrival.manualArrival')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.arrival.stats.todayCount')} value={stats.todayCount} icon={PackageCheck} color="blue" />
        <StatCard label={t('material.arrival.stats.todayQty')} value={stats.todayQty} icon={Package} color="green" />
        <StatCard label={t('material.arrival.stats.unrecevedPo')} value={stats.unrecevedPoCount} icon={AlertTriangle} color="orange" />
        <StatCard label={t('material.arrival.stats.totalCount')} value={stats.totalCount} icon={Hash} color="gray" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <ArrivalHistoryTable
            data={records}
            isLoading={loading}
            onCancel={(r) => setCancelTarget(r)}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.arrival.searchPlaceholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={refresh} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 모달 */}
      <PoArrivalModal isOpen={isPoModalOpen} onClose={() => setIsPoModalOpen(false)} onSuccess={handleSuccess} />
      <ManualArrivalModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} onSuccess={handleSuccess} />
      <ArrivalCancelModal
        isOpen={!!cancelTarget}
        record={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
