"use client";

/**
 * @file src/app/(authenticated)/production/wip-material-stock/page.tsx
 * @description 설비별 공정재고(WIP_MAT_STOCKS) 조회 전용 화면
 *
 * 초보자 가이드:
 * 1. **목적**: 설비(EQUIP_CODE) 단위 공정재고 현황 조회 (원자재재고 MAT_STOCKS와 분리)
 * 2. API: GET /inventory/wip-mat-stocks?equipCode=&search=
 * 3. 응답 행: { equipCode, equipName, itemCode, matUid, qty, availableQty, reservedQty }
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Cpu } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import EquipSelect from '@/components/shared/EquipSelect';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/services/api';

interface WipMatStockRow {
  equipCode: string;
  equipName: string | null;
  itemCode: string;
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (equipCode) params.equipCode = equipCode;
      const res = await api.get('/inventory/wip-mat-stocks', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, equipCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo<ColumnDef<WipMatStockRow>[]>(() => [
    {
      accessorKey: 'equipName', header: t('production.wipMaterialStock.equipName'), size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.equipName ?? '-'}</span>
          <span className="font-mono text-xs text-text-muted">{row.original.equipCode}</span>
        </div>
      ),
    },
    {
      accessorKey: 'itemCode', header: t('production.wipMaterialStock.partCode'), size: 130,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: 'matUid', header: t('production.wipMaterialStock.lot'), size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: 'qty', header: t('production.wipMaterialStock.qty'), size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-medium text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'availableQty', header: t('production.wipMaterialStock.availableQty'), size: 110,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'reservedQty', header: t('production.wipMaterialStock.reservedQty'), size: 110,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Cpu className="w-7 h-7 text-primary" />{t('production.wipMaterialStock.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.wipMaterialStock.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.wipMaterialStock.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.wipMaterialStock.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-56 flex-shrink-0">
                <EquipSelect value={equipCode} onChange={setEquipCode} labelPrefix={t('production.wipMaterialStock.equipName')} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT s.EQUIP_CODE, e.EQUIP_NAME, s.ITEM_CODE, s.MAT_UID,\n       s.QTY, s.AVAILABLE_QTY, s.RESERVED_QTY\nFROM WIP_MAT_STOCKS s\nLEFT JOIN EQUIP_MASTERS e ON e.EQUIP_CODE = s.EQUIP_CODE\nWHERE s.COMPANY = '40'\n  AND s.PLANT_CD = '1000'\nORDER BY s.EQUIP_CODE, s.ITEM_CODE, s.MAT_UID`} />
      </CardContent></Card>
    </div>
  );
}
