"use client";

import { CircleHelp } from 'lucide-react';
import HelpTooltip from '@/components/shared/HelpTooltip';
import { useTourMode } from '@/hooks/useTourMode';
import { useTranslation } from 'react-i18next';
import { resolveTourHelp } from '@/tour-help/registry';
import ko from '@/tour-help/locales/ko.json';
import en from '@/tour-help/locales/en.json';
import zh from '@/tour-help/locales/zh.json';
import vi from '@/tour-help/locales/vi.json';

const resources = { ko, en, zh, vi };

export default function HelpTarget({ helpKey, label, children }: { helpKey: string; label: string; children: React.ReactNode }) {
  const { enabled } = useTourMode();
  const { i18n } = useTranslation();
  const help = resolveTourHelp(helpKey, i18n.language, resources, label);
  if (!enabled || !helpKey) return <>{children}</>;
  const description = [help.title, help.description, help.usage, help.warning, help.related?.length ? `관련 항목: ${help.related.join(', ')}` : ''].filter(Boolean).join('\n');
  return <span className="relative inline-flex items-center">
    {children}
    <HelpTooltip description={description} focusable dataField={helpKey} className="absolute -right-5 top-1/2 z-10 -translate-y-1/2">
      <span aria-label={help.title} className="flex h-11 w-11 items-center justify-center text-primary"><CircleHelp className="h-4 w-4" /></span>
    </HelpTooltip>
  </span>;
}
