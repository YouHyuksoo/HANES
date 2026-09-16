"use client";

/**
 * @file src/app/(authenticated)/consumables/safety-alert/page.tsx
 * @description 소모품 안전재고 사전알림 — 부족해지기 전에 잡는 화면
 *
 * 부족을 알린 시점에는 이미 늦다. 그래서 두 가지를 같이 본다.
 * 1. 임계 배수 — 안전재고에 닿기 전 여유 구간에서 미리 경고
 * 2. 수명 잔여 — 장착중 소모품이 곧 교체되면 그만큼 재고가 곧 빠진다(교체임박을 가용에서 뺀다)
 *
 * 판정은 서버가 @harness/shared 규칙으로 끝낸다. 이 화면에서 조건을 다시 쓰지 말 것.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { ComCodeSelect } from '@/components/shared';
import DataGrid from '@/components/data-grid/DataGrid';
import { useConsumableSafetyAlert } from '@/hooks/consumables/useConsumableSafetyAlert';
import { buildSafetyAlertColumns } from './safetyAlertColumns';

function ConsumableSafetyAlertPage() {
  const { t } = useTranslation();
  const h = useConsumableSafetyAlert();
  const columns = useMemo(() => buildSafetyAlertColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text">
            {t('consumables.safetyAlert.title', '소모품 안전재고 사전알림')}
          </h1>
          <p className="text-xs text-text-muted">
            {t(
              'consumables.safetyAlert.description',
              '안전재고에 닿기 전에 미리 알립니다. 장착중이면서 수명이 임박한 수량은 가용재고에서 뺍니다.',
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void h.refresh()}>
          <RefreshCw className={`w-4 h-4 mr-1 ${h.isLoading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </Button>
      </div>

      {/* 요약 — 카드박스 나열 대신 한 줄 타이포로 */}
      <div className="flex items-center gap-4 flex-shrink-0 text-sm">
        <span className="flex items-center gap-1 text-danger font-semibold">
          <AlertTriangle className="w-4 h-4" />
          {t('consumables.safetyAlert.levelShortage', '부족')} {h.summary.shortage}
        </span>
        <span className="text-border">·</span>
        <span className="text-warning font-semibold">
          {t('consumables.safetyAlert.levelPreAlert', '사전경고')} {h.summary.preAlert}
        </span>
        <span className="text-border">·</span>
        <span className="text-xs text-text-muted">
          {t('consumables.safetyAlert.ratioNote', '사전경고 임계 = 안전재고 × {{ratio}}', { ratio: h.ratio })}
        </span>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={h.data}
          columns={columns}
          isLoading={h.isLoading}
          getRowId={(row) => row.consumableCode}
          emptyMessage={
            h.onlyActionNeeded
              ? t('consumables.safetyAlert.emptyAction', '부족하거나 사전경고 대상인 소모품이 없습니다.')
              : t('consumables.safetyAlert.empty', '표시할 소모품이 없습니다.')
          }
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0 items-center">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t('consumables.safetyAlert.searchPlaceholder', '소모품코드 또는 소모품명 검색')}
                  value={h.searchTerm}
                  onChange={(e) => h.setSearchTerm(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-36 flex-shrink-0">
                <ComCodeSelect
                  groupCode="CONSUMABLE_CATEGORY"
                  value={h.categoryFilter}
                  onChange={h.setCategoryFilter}
                  labelPrefix={t('consumables.life.categoryLabel', '분류')}
                  fullWidth
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={h.onlyActionNeeded}
                  onChange={(e) => h.setOnlyActionNeeded(e.target.checked)}
                />
                {t('consumables.safetyAlert.onlyActionNeeded', '조치 필요만')}
              </label>
            </div>
          }
        />
      </CardContent></Card>
    </div>
  );
}

export default ConsumableSafetyAlertPage;
