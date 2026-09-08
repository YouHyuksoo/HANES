"use client";

/**
 * @file src/app/(authenticated)/master/warehouse/page.tsx
 * @description 창고 관리 페이지 - 창고 마스터 + 로케이션, 창고 사용여부 공통 조회
 *
 * 초보자 가이드:
 * 1. **창고 목록 탭**: 창고 마스터 CRUD (유형별 필터, 검색, 초기화)
 * 2. **로케이션 탭**: 창고 내 세부 위치 관리
 * 3. **사용여부**: 두 탭 모두 소속 창고 사용여부 기준, 기본 사용(Y)
 * 4. **헤더 버튼**: 탭 전환 시 우상단 버튼이 해당 탭의 새로고침/등록 버튼으로 교체
 */
import { useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Warehouse, MapPin } from 'lucide-react';
import WarehouseList from './components/WarehouseList';
import { UseYnSelect } from '@/components/shared';
import LocationList from './components/LocationList';
import { usePageAiTools } from '@/ai-page-tools/usePageAiTools';

type TabType = 'warehouse' | 'location';

export default function WarehousePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('warehouse');
  const [useYn, setUseYn] = useState('Y');
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  // AI 채팅 페이지 도구(창고 등록 write 도구) 등록 — createWarehouse는 backend 실행
  usePageAiTools('master.warehouse');

  const tabs: { key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'warehouse', label: t('inventory.warehouse.title'), icon: Warehouse },
    { key: 'location', label: t('inventory.location.title'), icon: MapPin },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" />{t('inventory.warehouse.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.warehouse.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {headerActions}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border flex-shrink-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text hover:border-border'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="w-44 flex-shrink-0">
        <UseYnSelect value={useYn} onChange={setUseYn} labelPrefix={t('inventory.warehouse.useFilter', '창고 사용여부')} fullWidth />
      </div>
      {/* 이동규칙은 재고 이동에서 참조하지 않아 탭만 숨긴다. 기존 API/데이터는 보존. */}
      {/* 탭 컨텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'warehouse' && <WarehouseList useYn={useYn} onHeaderActions={setHeaderActions} />}
        {activeTab === 'location' && <LocationList useYn={useYn} onHeaderActions={setHeaderActions} />}
      </div>
    </div>
  );
}
