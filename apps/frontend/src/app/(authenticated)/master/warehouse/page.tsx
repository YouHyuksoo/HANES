"use client";

/**
 * @file src/app/(authenticated)/master/warehouse/page.tsx
 * @description 창고 관리 페이지 - 창고 마스터 + 이동규칙 탭 구조
 *
 * 초보자 가이드:
 * 1. **창고 목록 탭**: 창고 마스터 CRUD (유형별 필터, 검색, 초기화)
 * 2. **이동규칙 탭**: 창고 간 이동 허용/금지 규칙 관리
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Warehouse, ArrowRightLeft } from 'lucide-react';
import WarehouseList from './components/WarehouseList';
import TransferRuleList from './components/TransferRuleList';

type TabType = 'warehouse' | 'transfer-rule';

export default function WarehousePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('warehouse');

  const tabs: { key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'warehouse', label: t('inventory.warehouse.title'), icon: Warehouse },
    { key: 'transfer-rule', label: t('master.transferRule.title'), icon: ArrowRightLeft },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Warehouse className="w-7 h-7 text-primary" />{t('inventory.warehouse.title')}
        </h1>
        <p className="text-text-muted mt-1">{t('inventory.warehouse.subtitle')}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border">
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

      {/* 탭 컨텐츠 */}
      {activeTab === 'warehouse' && <WarehouseList />}
      {activeTab === 'transfer-rule' && <TransferRuleList />}
    </div>
  );
}
