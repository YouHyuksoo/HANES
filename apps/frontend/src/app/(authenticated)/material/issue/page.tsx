'use client';

import { useTranslation } from 'react-i18next';
import { ArrowRightFromLine } from 'lucide-react';
import { Card } from '@/components/ui';
import IssueRequestTab from '@/components/material/IssueRequestTab';
import IssueScanPanel from './components/IssueScanPanel';

export default function IssuePage() {
  const { t } = useTranslation();

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

      {/* 본문: 좌측 요청처리 + 우측 스캔패널 */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* 좌측: 출고요청처리 목록 */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <IssueRequestTab excludeIssueTypes={['MANUAL']} />
        </div>

        {/* 우측: 바코드 스캔 패널 */}
        <Card className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden" padding="none">
          <IssueScanPanel />
        </Card>
      </div>
    </div>
  );
}
