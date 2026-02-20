'use client';

/**
 * @file src/app/(authenticated)/material/issue/page.tsx
 * @description 출고관리 페이지 - 3개 탭 구조 (출고요청처리 / 수동출고 / 바코드스캔)
 *
 * 초보자 가이드:
 * 1. **출고요청처리**: 생산현장 출고요청 목록 조회 + 승인/반려/출고처리
 * 2. **수동출고**: 가용재고 목록에서 직접 선택하여 출고 처리
 * 3. **바코드스캔**: LOT 바코드 스캔 → 즉시 전량 출고
 * 4. **탭 전환**: activeTab 상태로 탭 콘텐츠 교체
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightFromLine, ClipboardList, Package, QrCode } from 'lucide-react';
import IssueRequestTab from '@/components/material/IssueRequestTab';
import ManualIssueTab from '@/components/material/ManualIssueTab';
import BarcodeScanTab from '@/components/material/BarcodeScanTab';

/** 탭 키 타입 */
type TabKey = 'request' | 'manual' | 'scan';

/** 탭 정의 */
const TAB_CONFIG: { key: TabKey; labelKey: string; icon: typeof ClipboardList }[] = [
  { key: 'request', labelKey: 'material.issue.tab.request', icon: ClipboardList },
  { key: 'manual', labelKey: 'material.issue.tab.manual', icon: Package },
  { key: 'scan', labelKey: 'material.issue.tab.scan', icon: QrCode },
];

function IssuePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('request');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ArrowRightFromLine className="w-7 h-7 text-primary" />
          {t('material.issue.title')}
        </h1>
        <p className="text-text-muted mt-1">{t('material.issue.description')}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'request' && <IssueRequestTab />}
      {activeTab === 'manual' && <ManualIssueTab />}
      {activeTab === 'scan' && <BarcodeScanTab />}
    </div>
  );
}

export default IssuePage;
