'use client';

/**
 * @file src/app/(authenticated)/material/issue/page.tsx
 * @description 출고관리(양산) 페이지 - 양산계정(PRODUCTION) 전용 (출고요청처리 / 바코드스캔 / 이력)
 *
 * 초보자 가이드:
 * 1. **출고요청처리**: 생산현장 출고요청 목록 조회 + 승인/반려/출고처리
 * 2. **바코드스캔**: LOT 바코드 스캔 → 즉시 전량 출고 (출고계정=양산 고정)
 * 3. **이력**: 출고 이력 조회
 * 4. 양산 외 계정(불량/샘플/외주/폐기 등)은 별도 화면 '기타출고'에서 처리
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightFromLine, ClipboardList, QrCode, History } from 'lucide-react';
import IssueRequestTab from '@/components/material/IssueRequestTab';
import BarcodeScanTab from '@/components/material/BarcodeScanTab';
import IssueHistoryTab from '@/components/material/IssueHistoryTab';

/** 탭 키 타입 */
type TabKey = 'request' | 'scan' | 'history';

/** 탭 정의 */
const TAB_CONFIG: { key: TabKey; labelKey: string; icon: typeof ClipboardList }[] = [
  { key: 'request', labelKey: 'material.issue.tab.request', icon: ClipboardList },
  { key: 'scan', labelKey: 'material.issue.tab.scan', icon: QrCode },
  { key: 'history', labelKey: 'material.issue.tab.history', icon: History },
];

function IssuePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('request');
  /** 양산계정 고정 코드 */
  const PRODUCTION_ISSUE_TYPE = 'PRODUCTION';

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ArrowRightFromLine className="w-7 h-7 text-primary" />
          {t('material.issue.title')}
        </h1>
        <p className="text-text-muted mt-1">{t('material.issue.description')}</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border flex-shrink-0">
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
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'request' && <IssueRequestTab />}
        {activeTab === 'scan' && <BarcodeScanTab fixedIssueType={PRODUCTION_ISSUE_TYPE} />}
        {activeTab === 'history' && <IssueHistoryTab />}
      </div>
    </div>
  );
}

export default IssuePage;
