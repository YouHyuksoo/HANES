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
import ComCodeSelect from '@/components/shared/ComCodeSelect';
import IqcTable from '@/components/material/IqcTable';
import IqcModal from '@/components/material/IqcModal';
import { useIqcData } from '@/hooks/material/useIqcData';

export default function IqcPage() {
  const { t } = useTranslation();

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
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
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

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
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
                  <ComCodeSelect groupCode="IQC_STATUS" labelPrefix={t('common.status')}
                    value={statusFilter} onChange={setStatusFilter} fullWidth />
                </div>
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
