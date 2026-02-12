"use client";

/**
 * @file src/pages/consumables/LifePage.tsx
 * @description 소모품 수명 현황 페이지
 */
import { useMemo } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, RotateCcw, Activity } from 'lucide-react';
import { Card, CardContent, Button, StatCard } from '@/components/ui';

interface LifeStatus {
  id: string;
  consumableCode: string;
  name: string;
  category: string;
  currentCount: number;
  expectedLife: number;
  warningCount: number;
  lifePercentage: number;
  remainingLife: number;
  status: string;
  lastReplaced: string | null;
}

const mockData: LifeStatus[] = [
  {
    id: '1',
    consumableCode: 'TOOL-001',
    name: '절단날 표준형',
    category: 'TOOL',
    currentCount: 10500,
    expectedLife: 10000,
    warningCount: 8000,
    lifePercentage: 105,
    remainingLife: -500,
    status: 'REPLACE',
    lastReplaced: '2024-12-01',
  },
  {
    id: '2',
    consumableCode: 'JIG-001',
    name: '조립지그 001',
    category: 'JIG',
    currentCount: 48000,
    expectedLife: 50000,
    warningCount: 40000,
    lifePercentage: 96,
    remainingLife: 2000,
    status: 'WARNING',
    lastReplaced: '2024-10-15',
  },
  {
    id: '3',
    consumableCode: 'MOLD-001',
    name: '압착금형 A타입',
    category: 'MOLD',
    currentCount: 85000,
    expectedLife: 100000,
    warningCount: 80000,
    lifePercentage: 85,
    remainingLife: 15000,
    status: 'WARNING',
    lastReplaced: '2024-08-20',
  },
  {
    id: '4',
    consumableCode: 'MOLD-002',
    name: '압착금형 B타입',
    category: 'MOLD',
    currentCount: 45000,
    expectedLife: 100000,
    warningCount: 80000,
    lifePercentage: 45,
    remainingLife: 55000,
    status: 'NORMAL',
    lastReplaced: '2024-11-10',
  },
  {
    id: '5',
    consumableCode: 'MOLD-003',
    name: '압착금형 C타입',
    category: 'MOLD',
    currentCount: 20000,
    expectedLife: 100000,
    warningCount: 80000,
    lifePercentage: 20,
    remainingLife: 80000,
    status: 'NORMAL',
    lastReplaced: '2025-01-05',
  },
];

const categoryLabels: Record<string, string> = {
  MOLD: '금형',
  JIG: '지그',
  TOOL: '공구',
};

function ConsumableLifePage() {
  const sortedData = useMemo(() => {
    return [...mockData].sort((a, b) => b.lifePercentage - a.lifePercentage);
  }, []);

  const stats = useMemo(() => ({
    total: mockData.length,
    normal: mockData.filter((d) => d.status === 'NORMAL').length,
    warning: mockData.filter((d) => d.status === 'WARNING').length,
    replace: mockData.filter((d) => d.status === 'REPLACE').length,
  }), []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'REPLACE':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-yellow-500';
    if (pct >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Activity className="w-7 h-7 text-primary" />수명 현황</h1>
          <p className="text-text-muted mt-1">소모품의 수명 상태를 모니터링합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="전체" value={stats.total} icon={Activity} color="blue" />
        <StatCard label="정상" value={stats.normal} icon={CheckCircle} color="green" />
        <StatCard label="경고" value={stats.warning} icon={AlertTriangle} color="yellow" />
        <StatCard label="교체필요" value={stats.replace} icon={XCircle} color="red" />
      </div>

      {/* 수명 현황 리스트 */}
      <Card>
        <CardContent>
          <div className="text-sm font-medium text-text mb-3">수명 현황 (사용률 높은 순)</div>
          <div className="space-y-4">
            {sortedData.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${
                  item.status === 'REPLACE'
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    : item.status === 'WARNING'
                    ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                    : 'border-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text">{item.consumableCode}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-surface text-text-muted">
                          {categoryLabels[item.category]}
                        </span>
                      </div>
                      <p className="text-sm text-text-muted">{item.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-text">
                      {item.currentCount.toLocaleString()} / {item.expectedLife.toLocaleString()}
                    </div>
                    <p className="text-sm text-text-muted">
                      잔여: {item.remainingLife > 0 ? item.remainingLife.toLocaleString() : '초과'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-3 bg-background rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(item.lifePercentage)} transition-all`}
                        style={{ width: `${Math.min(item.lifePercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-semibold w-14 text-right ${
                    item.lifePercentage >= 100 ? 'text-red-600 dark:text-red-400' :
                    item.lifePercentage >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-text'
                  }`}>
                    {item.lifePercentage}%
                  </span>
                  {item.status === 'REPLACE' && (
                    <Button size="sm" variant="secondary">
                      <RotateCcw className="w-4 h-4 mr-1" /> 리셋
                    </Button>
                  )}
                </div>

                {item.lastReplaced && (
                  <p className="text-xs text-text-muted mt-2">
                    최근 교체: {item.lastReplaced}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConsumableLifePage;
