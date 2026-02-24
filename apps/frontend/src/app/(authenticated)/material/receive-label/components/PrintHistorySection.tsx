'use client';

/**
 * @file components/PrintHistorySection.tsx
 * @description 라벨 발행 이력 섹션 - 접이식 DataGrid로 이력 조회
 *
 * 초보자 가이드:
 * 1. 접이식 카드: 헤더 클릭으로 열고 닫기
 * 2. DataGrid: 발행일시, 출력방식, 매수, 프린터명, 상태, 발행자
 * 3. 필터: 기간(오늘/7일/30일) 버튼으로 조회 범위 변경
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { api } from '@/services/api';

/** 발행 이력 레코드 */
interface PrintLog {
  id: string;
  templateId: string | null;
  category: string;
  printMode: string;
  printerName: string | null;
  lotIds: string | null;
  labelCount: number;
  workerId: string | null;
  printedAt: string;
  status: string;
  errorMsg: string | null;
}

/** 기간 필터 키 */
type DateRangeKey = 'today' | '7d' | '30d';

interface PrintHistoryProps {
  category?: string;
}

/** 출력방식별 Badge 색상 */
const MODE_COLORS: Record<string, string> = {
  BROWSER: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  ZPL_USB: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  ZPL_TCP: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

/** 상태별 Badge 색상 */
const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

/** 기간 키로부터 dateFrom 계산 */
function calcDateFrom(key: DateRangeKey): string {
  const now = new Date();
  if (key === 'today') return now.toISOString().slice(0, 10);
  const d = new Date(now);
  d.setDate(d.getDate() - (key === '7d' ? 7 : 30));
  return d.toISOString().slice(0, 10);
}

export default function PrintHistorySection({ category = 'mat_lot' }: PrintHistoryProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeKey>('7d');

  /** 이력 조회 */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = calcDateFrom(dateRange);
      const res = await api.get('/material/label-print/logs', {
        params: { category, dateFrom, limit: 100 },
      });
      setLogs(res.data?.data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [category, dateRange]);

  /** 열릴 때 or 필터 변경 시 조회 */
  useEffect(() => {
    if (!isOpen) return;
    fetchLogs();
  }, [isOpen, fetchLogs]);

  /** DataGrid 컬럼 정의 */
  const columns = useMemo<ColumnDef<PrintLog>[]>(() => [
    {
      accessorKey: 'printedAt',
      header: t('material.receiveLabel.history.printedAt', { defaultValue: '발행일시' }),
      size: 160,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? v.slice(0, 16).replace('T', ' ') : '-';
      },
    },
    {
      accessorKey: 'printMode',
      header: t('material.receiveLabel.history.printMode', { defaultValue: '출력방식' }),
      size: 120,
      cell: ({ getValue }) => {
        const mode = getValue() as string;
        const cls = MODE_COLORS[mode] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{mode}</span>;
      },
    },
    {
      accessorKey: 'labelCount',
      header: t('material.receiveLabel.history.labelCount', { defaultValue: '매수' }),
      size: 80,
      meta: { align: 'right' as const },
      cell: ({ getValue }) => (getValue() as number) ?? 0,
    },
    {
      accessorKey: 'printerName',
      header: t('material.receiveLabel.history.printerName', { defaultValue: '프린터명' }),
      size: 150,
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
    {
      accessorKey: 'status',
      header: t('material.receiveLabel.history.status', { defaultValue: '상태' }),
      size: 100,
      cell: ({ getValue }) => {
        const st = getValue() as string;
        const cls = STATUS_COLORS[st] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{st}</span>;
      },
    },
    {
      accessorKey: 'workerId',
      header: t('material.receiveLabel.history.workerId', { defaultValue: '발행자' }),
      size: 100,
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
  ], [t]);

  /** 기간 필터 옵션 */
  const dateOptions: { key: DateRangeKey; label: string }[] = [
    { key: 'today', label: t('material.receiveLabel.history.today', { defaultValue: '오늘' }) },
    { key: '7d', label: t('material.receiveLabel.history.days7', { defaultValue: '7일' }) },
    { key: '30d', label: t('material.receiveLabel.history.days30', { defaultValue: '30일' }) },
  ];

  return (
    <div className="border border-border rounded-lg bg-surface">
      {/* 접이식 헤더 */}
      <div
        className="flex items-center gap-2 cursor-pointer px-4 py-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
        />
        <span className="text-sm font-semibold text-text">
          {t('material.receiveLabel.history.title', { defaultValue: '발행 이력' })}
        </span>
        {logs.length > 0 && (
          <span className="text-xs text-text-muted">({logs.length})</span>
        )}
      </div>

      {/* 본문: 필터 + DataGrid */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* 기간 필터 버튼 */}
          <div className="flex gap-1">
            {dateOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDateRange(opt.key)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  dateRange === opt.key
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-muted hover:text-text border border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* DataGrid */}
          <DataGrid
            data={logs}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
          />
        </div>
      )}
    </div>
  );
}
