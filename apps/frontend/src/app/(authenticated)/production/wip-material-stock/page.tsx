"use client";

/**
 * @file src/app/(authenticated)/production/wip-material-stock/page.tsx
 * @description 설비별 공정재고(WIP_MAT_STOCKS) 조회
 *
 * 좌측: 설비+품목 집계 그리드 (행 선택)
 * 우측: 선택된 설비+품목의 LOT별 상세 (qty > 0만 표시)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Cpu, Package } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import EquipSelect from '@/components/shared/EquipSelect';
import DataGrid from '@/components/data-grid/DataGrid';
import api from '@/services/api';
import { createWipMaterialStockGridColumns, type WipMatStockRow } from './wipMaterialStockColumns';

interface LotRow {
  matUid: string;
  qty: number;
  availableQty: number;
  reservedQty: number;
}

export default function WipMaterialStockPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WipMatStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [equipCode, setEquipCode] = useState('');

  const [selectedRow, setSelectedRow] = useState<WipMatStockRow | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (equipCode) params.equipCode = equipCode;
      const res = await api.get('/inventory/wip-mat-stocks', { params });
      setData(res.data?.data ?? []);
      setSelectedRow(null);
      setLots([]);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, equipCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchLots = useCallback(async (row: WipMatStockRow) => {
    setLotsLoading(true);
    try {
      const res = await api.get('/inventory/wip-mat-stocks/lots', {
        params: { equipCode: row.equipCode, itemCode: row.itemCode },
      });
      setLots(res.data?.data ?? []);
    } catch {
      setLots([]);
    } finally {
      setLotsLoading(false);
    }
  }, []);

  const handleRowClick = useCallback((row: WipMatStockRow) => {
    setSelectedRow(row);
    fetchLots(row);
  }, [fetchLots]);

  const columns = useMemo(() => createWipMaterialStockGridColumns({ t }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Cpu className="w-7 h-7 text-primary" />{t('production.wipMaterialStock.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.wipMaterialStock.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
        </Button>
      </div>

      {/* 좌우 패널 */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* 좌측: 집계 그리드 */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t('production.wipMaterialStock.title')}
              onRowClick={handleRowClick}
              selectedRowId={selectedRow ? `${selectedRow.equipCode}__${selectedRow.itemCode}` : undefined}
              getRowId={(row) => `${row.equipCode}__${row.itemCode}`}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t('production.wipMaterialStock.searchPlaceholder')}
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <div className="w-52 flex-shrink-0">
                    <EquipSelect
                      value={equipCode}
                      onChange={setEquipCode}
                      labelPrefix={t('production.wipMaterialStock.equipName')}
                      fullWidth
                    />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* 우측: LOT 상세 패널 */}
        <Card className="w-80 flex-shrink-0 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col gap-3">
            {/* 패널 헤더 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">LOT 재고 상세</span>
              {selectedRow && (
                <span className="text-xs text-text-muted ml-auto">qty &gt; 0</span>
              )}
            </div>

            {selectedRow ? (
              <>
                {/* 선택된 행 요약 */}
                <div className="flex-shrink-0 rounded border border-border bg-surface-alt p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-text-muted shrink-0">설비코드</span>
                    <span className="font-mono text-xs text-right">{selectedRow.equipCode}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-text-muted shrink-0">설비명</span>
                    <span className="font-medium text-xs truncate text-right">{selectedRow.equipName || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-text-muted shrink-0">품목코드</span>
                    <span className="font-mono text-xs text-right">{selectedRow.itemCode}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-text-muted shrink-0">품목명</span>
                    <span className="font-medium text-xs truncate text-right">{selectedRow.itemName || '-'}</span>
                  </div>
                  <div className="border-t border-border pt-1 mt-1 flex justify-between">
                    <span className="text-text-muted">총재고</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedRow.qty.toLocaleString()}</span>
                  </div>
                </div>

                {/* LOT 목록 */}
                <div className="flex-1 min-h-0 overflow-auto">
                  {lotsLoading ? (
                    <div className="flex items-center justify-center h-20 text-text-muted text-sm">로딩 중...</div>
                  ) : lots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-text-muted text-sm gap-1">
                      <Package className="w-6 h-6 opacity-30" />
                      <span>재고 있는 LOT 없음</span>
                    </div>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-surface-alt sticky top-0">
                          <th className="text-left px-2 py-2 font-medium text-text-muted text-xs">LOT No.</th>
                          <th className="text-right px-2 py-2 font-medium text-text-muted text-xs">재고</th>
                          <th className="text-right px-2 py-2 font-medium text-text-muted text-xs">가용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lots.map((lot) => (
                          <tr key={lot.matUid} className="border-b border-border/50 hover:bg-surface-alt/50">
                            <td className="px-2 py-2 font-mono text-xs">{lot.matUid}</td>
                            <td className="px-2 py-2 text-right font-medium text-blue-600 dark:text-blue-400">
                              {lot.qty.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-right text-green-600 dark:text-green-400">
                              {lot.availableQty.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-2">
                <Cpu className="w-10 h-10 opacity-20" />
                <span className="text-sm">행을 선택하면 LOT 상세를 표시합니다</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
