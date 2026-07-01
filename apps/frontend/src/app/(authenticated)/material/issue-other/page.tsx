'use client';

/**
 * @file src/app/(authenticated)/material/issue-other/page.tsx
 * @description 기타출고 페이지 - 양산 외 출고계정(불량/샘플/외주/폐기/반품/기타 등) 처리
 *
 * 초보자 가이드:
 * 1. 양산(PRODUCTION) 계정은 '출고관리(양산)' 화면에서 처리한다.
 * 2. 이 화면은 작업지시 없는 기타출고요청(MANUAL)을 승인/출고 처리한다.
 * 3. 그 외 출고계정은 담당자가 직접 선택하여 바코드 스캔 출고한다.
 * 4. 탭: 출고요청처리 / 바코드스캔(계정 선택) / 이력
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, PackageMinus, QrCode, History } from 'lucide-react';
import BarcodeScanTab from '@/components/material/BarcodeScanTab';
import IssueRequestTab from '@/components/material/IssueRequestTab';
import IssueHistoryTab from '@/components/material/IssueHistoryTab';

type TabKey = 'request' | 'scan' | 'history';

const TAB_CONFIG: { key: TabKey; labelKey: string; icon: typeof QrCode }[] = [
  { key: 'request', labelKey: 'material.issue.tab.request', icon: ClipboardList },
  { key: 'scan', labelKey: 'material.issue.tab.scan', icon: QrCode },
  { key: 'history', labelKey: 'material.issue.tab.history', icon: History },
];

/** 기타출고에서 제외할 계정 (양산은 출고관리 화면에서 처리) */
const EXCLUDED_ISSUE_TYPES = ['PRODUCTION'];

export default function IssueOtherPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('request');

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <PackageMinus className="w-7 h-7 text-primary" />
          {t('material.issueOther.title')}
        </h1>
        <p className="text-text-muted mt-1">{t('material.issueOther.description')}</p>
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
        {activeTab === 'request' && <IssueRequestTab issueType="MANUAL" />}
        {activeTab === 'scan' && <BarcodeScanTab excludeIssueTypes={EXCLUDED_ISSUE_TYPES} />}
        {activeTab === 'history' && <IssueHistoryTab />}
      </div>
    </div>
  );
}
