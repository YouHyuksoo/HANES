"use client";

/**
 * @file src/pages/material/arrival/ArrivalPage.tsx
 * @description 입하관리 페이지 - 납품 접수 및 가입고 관리
 *
 * 초보자 가이드:
 * 1. **입하**: 공급업체에서 자재가 도착하면 입하(가입고) 등록
 * 2. **프로세스**: 납품 → 입하등록 → IQC 수입검사로 이동
 * 3. **상태**: ARRIVED(입하완료), IQC_READY(IQC대기)
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Search, RefreshCw, Truck, Clock, PackageCheck, Hash } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import ArrivalTable from '@/components/material/ArrivalTable';
import ArrivalModal from '@/components/material/ArrivalModal';
import { useArrivalData, supplierOptions } from '@/hooks/material/useArrivalData';

export default function ArrivalPage() {
  const { t } = useTranslation();

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'ARRIVED', label: t('material.arrival.status.arrived') },
    { value: 'IQC_READY', label: t('material.arrival.status.iqcReady') },
  ], [t]);
  const {
    filteredArrivals,
    stats,
    statusFilter, setStatusFilter,
    supplierFilter, setSupplierFilter,
    searchText, setSearchText,
    isCreateModalOpen, setIsCreateModalOpen,
    createForm, setCreateForm,
    handleCreate,
  } = useArrivalData();

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
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t('material.arrival.register')}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.arrival.stats.todayCount')} value={stats.todayCount} icon={PackageCheck} color="blue" />
        <StatCard label={t('material.arrival.stats.pendingCount')} value={stats.pendingCount} icon={Clock} color="yellow" />
        <StatCard label={t('material.arrival.stats.todayQty')} value={stats.todayQty} icon={Package} color="green" />
        <StatCard label={t('material.arrival.stats.totalCount')} value={stats.totalCount} icon={Hash} color="gray" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('material.arrival.searchPlaceholder')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-40">
              <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
            </div>
            <div className="w-40">
              <Select options={supplierOptions} value={supplierFilter} onChange={setSupplierFilter} fullWidth />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <ArrivalTable data={filteredArrivals} />
        </CardContent>
      </Card>

      {/* 입하 등록 모달 */}
      <ArrivalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreate}
      />
    </div>
  );
}
