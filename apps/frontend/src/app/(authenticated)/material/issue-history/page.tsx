'use client';

import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import IssueHistoryTab from '@/components/material/IssueHistoryTab';

export default function IssueHistoryPage() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <History className="w-7 h-7 text-primary" />
          {t('material.issue.history.tabTitle')}
        </h1>
        <p className="text-text-muted mt-1">{t('material.issueHistory', { defaultValue: '출고이력조회' })}</p>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <IssueHistoryTab />
      </div>
    </div>
  );
}
