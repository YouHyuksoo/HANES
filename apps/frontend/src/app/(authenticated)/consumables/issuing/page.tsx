"use client";

/**
 * @file src/pages/consumables/issuing/IssuingPage.tsx
 * @description 소모품 출고관리 메인 페이지
 *
 * 초보자 가이드:
 * 1. **출고(OUT)**: 소모품을 현장에 투입/지급
 * 2. **출고반품(OUT_RETURN)**: 사용 후 또는 미사용 반품
 * 3. **통계카드**: 금일 출고건수, 출고반품건수, 미반품건수 표시
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search, ArrowUpCircle, Undo2, AlertTriangle, PackageMinus } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import IssuingTable from '@/components/consumables/IssuingTable';
import IssuingModal from '@/components/consumables/IssuingModal';
import IssuingReturnModal from '@/components/consumables/IssuingReturnModal';
import { useIssuingData } from '@/hooks/consumables/useIssuingData';

function IssuingPage() {
  const { t } = useTranslation();
  const [isIssuingModalOpen, setIsIssuingModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const {
    data, searchTerm, setSearchTerm, typeFilter, setTypeFilter, todayStats, refresh,
  } = useIssuingData();

  const handleIssuingSubmit = (formData: any) => {
    // TODO: API 호출
    console.log('출고 등록:', { ...formData, logType: 'OUT' });
  };

  const handleReturnSubmit = (formData: any) => {
    // TODO: API 호출
    console.log('출고반품 등록:', { ...formData, logType: 'OUT_RETURN' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageMinus className="w-7 h-7 text-primary" />{t('consumables.issuing.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('consumables.issuing.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsReturnModalOpen(true)}>
            <Undo2 className="w-4 h-4 mr-1" /> {t('consumables.issuing.returnIssuing')}
          </Button>
          <Button size="sm" onClick={() => setIsIssuingModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('consumables.issuing.register')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('consumables.issuing.todayOutCount')} value={todayStats.outCount} icon={ArrowUpCircle} color="blue" />
        <StatCard label={t('consumables.issuing.todayReturnCount')} value={todayStats.returnCount} icon={Undo2} color="purple" />
        <StatCard label={t('consumables.issuing.unreturned')} value={todayStats.unreturned} icon={AlertTriangle} color="red" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('consumables.issuing.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <Select
              options={[
                { value: '', label: t('consumables.issuing.allTypes') },
                { value: 'OUT', label: t('consumables.issuing.typeOut') },
                { value: 'OUT_RETURN', label: t('consumables.issuing.typeOutReturn') },
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="유형"
            />
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <IssuingTable data={data} />
        </CardContent>
      </Card>

      {/* 모달 */}
      <IssuingModal
        isOpen={isIssuingModalOpen}
        onClose={() => setIsIssuingModalOpen(false)}
        onSubmit={handleIssuingSubmit}
      />
      <IssuingReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSubmit={handleReturnSubmit}
      />
    </div>
  );
}

export default IssuingPage;
