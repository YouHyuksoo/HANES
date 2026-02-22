"use client";

/**
 * @file src/pages/consumables/receiving/ReceivingPage.tsx
 * @description 소모품 입고관리 메인 페이지
 *
 * 초보자 가이드:
 * 1. **입고(IN)**: 공급업체에서 소모품을 받아 등록
 * 2. **입고반품(IN_RETURN)**: 불량/오배송 등으로 공급업체에 반품
 * 3. **통계카드**: 금일 입고건수, 입고금액, 반품건수 표시
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search, ArrowDownCircle, DollarSign, Undo2, PackagePlus } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import ReceivingTable from '@/components/consumables/ReceivingTable';
import ReceivingModal from '@/components/consumables/ReceivingModal';
import ReceivingReturnModal from '@/components/consumables/ReceivingReturnModal';
import { useReceivingData } from '@/hooks/consumables/useReceivingData';
import api from '@/services/api';

export default function ReceivingPage() {
  const { t } = useTranslation();
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const {
    data, searchTerm, setSearchTerm, typeFilter, setTypeFilter, todayStats, refresh,
  } = useReceivingData();

  const handleReceivingSubmit = async (formData: any) => {
    try {
      await api.post("/consumables/receiving", { ...formData, logType: "IN" });
      setIsReceivingModalOpen(false);
      refresh();
    } catch (e) {
      console.error("Receiving submit failed:", e);
    }
  };

  const handleReturnSubmit = async (formData: any) => {
    try {
      await api.post("/consumables/receiving", { ...formData, logType: "IN_RETURN" });
      setIsReturnModalOpen(false);
      refresh();
    } catch (e) {
      console.error("Return submit failed:", e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />{t('consumables.receiving.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('consumables.receiving.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsReturnModalOpen(true)}>
            <Undo2 className="w-4 h-4 mr-1" /> {t('consumables.receiving.returnReceiving')}
          </Button>
          <Button size="sm" onClick={() => setIsReceivingModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('consumables.receiving.register')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('consumables.receiving.todayInCount')} value={todayStats.inCount} icon={ArrowDownCircle} color="green" />
        <StatCard label={t('consumables.receiving.todayInAmount')} value={todayStats.inAmount.toLocaleString() + t('common.won')} icon={DollarSign} color="blue" />
        <StatCard label={t('consumables.receiving.todayReturnCount')} value={todayStats.returnCount} icon={Undo2} color="orange" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <ReceivingTable
            data={data}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('consumables.receiving.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Select
                    options={[
                      { value: '', label: t('consumables.receiving.allTypes') },
                      { value: 'IN', label: t('consumables.receiving.typeIn') },
                      { value: 'IN_RETURN', label: t('consumables.receiving.typeInReturn') },
                    ]}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    fullWidth
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={refresh} className="flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 모달 */}
      <ReceivingModal
        isOpen={isReceivingModalOpen}
        onClose={() => setIsReceivingModalOpen(false)}
        onSubmit={handleReceivingSubmit}
      />
      <ReceivingReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSubmit={handleReturnSubmit}
      />
    </div>
  );
}
