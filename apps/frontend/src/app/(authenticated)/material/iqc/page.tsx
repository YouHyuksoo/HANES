"use client";

/**
 * @file src/app/(authenticated)/material/iqc/page.tsx
 * @description 수입검사(IQC) 페이지 - 입하 자재 품질 검사 관리
 *
 * 초보자 가이드:
 * 1. **IQC**: Incoming Quality Control, 수입(입하) 자재 품질 검사
 * 2. **대상**: 입하 후 PENDING, IQC_IN_PROGRESS 상태인 건
 * 3. API: GET /material/lots, POST /material/iqc-history
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Search, RefreshCw, Clock, ClipboardCheck, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import IqcTable from '@/components/material/IqcTable';
import IqcModal from '@/components/material/IqcModal';
import { useIqcData } from '@/hooks/material/useIqcData';

export default function IqcPage() {
  const { t } = useTranslation();

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'PENDING', label: t('material.iqc.status.pending') },
    { value: 'IQC_IN_PROGRESS', label: t('material.iqc.status.inProgress') },
    { value: 'PASSED', label: t('material.iqc.status.passed') },
    { value: 'FAILED', label: t('material.iqc.status.failed') },
  ], [t]);

  const {
    filteredItems,
    stats,
    loading,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    isIqcModalOpen, setIsIqcModalOpen,
    selectedItem,
    resultForm, setResultForm,
    openIqcModal,
    handleIqcSubmit,
    refresh,
  } = useIqcData();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            {t('material.iqc.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.iqc.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.iqc.stats.pending')} value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label={t('material.iqc.stats.inProgress')} value={stats.inProgress} icon={ClipboardCheck} color="blue" />
        <StatCard label={t('material.iqc.stats.passed')} value={stats.passed} icon={CheckCircle} color="green" />
        <StatCard label={t('material.iqc.stats.failed')} value={stats.failed} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <IqcTable
            data={filteredItems}
            onInspect={openIqcModal}
            isLoading={loading}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.iqc.searchPlaceholder')}
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

      <IqcModal
        isOpen={isIqcModalOpen}
        onClose={() => setIsIqcModalOpen(false)}
        selectedItem={selectedItem}
        form={resultForm}
        setForm={setResultForm}
        onSubmit={handleIqcSubmit}
      />
    </div>
  );
}
