"use client";

/**
 * @file src/app/(authenticated)/production/input-equip/page.tsx
 * @description 실적입력(검사장비) 페이지 - 설비설정 + 검사범위 표시 포함
 *
 * 초보자 가이드:
 * 1. **목적**: 검사장비를 이용한 검사 실적 입력
 * 2. **검사범위**: 설비별 검사 기준 범위(상한/하한) 표시
 * 3. **측정값**: 실제 측정값을 입력하여 자동 합격/불합격 판정
 * 4. API: GET/POST /production/prod-results
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Save, Microscope, Gauge, CheckCircle, XCircle, Target } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from '@/components/ui';
import WorkOrderContext from '@/components/production/WorkOrderContext';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/services/api';

interface EquipInspect {
  id: string;
  orderNo: string;
  partName: string;
  equipName: string;
  lotNo: string;
  measuredValue: number;
  lowerLimit: number;
  upperLimit: number;
  passYn: string;
  inspectDate: string;
  inspector: string;
}

export default function InputEquipPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<EquipInspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ orderNo: '', equipId: '', lotNo: '', measuredValue: '', remark: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      const res = await api.get('/production/prod-results', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    pass: data.filter(d => d.passYn === 'Y').length,
    fail: data.filter(d => d.passYn === 'N').length,
    passRate: data.length > 0 ? Math.round((data.filter(d => d.passYn === 'Y').length / data.length) * 100) : 0,
  }), [data]);

  const handleSave = useCallback(async () => {
    if (!form.orderNo) return;
    setSaving(true);
    try {
      await api.post('/production/prod-results', {
        jobOrderId: form.orderNo,
        equipId: form.equipId || undefined,
        lotNo: form.lotNo || undefined,
        measuredValue: Number(form.measuredValue) || undefined,
        remark: form.remark || undefined,
      });
      setIsModalOpen(false);
      setForm({ orderNo: '', equipId: '', lotNo: '', measuredValue: '', remark: '' });
      fetchData();
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const columns = useMemo<ColumnDef<EquipInspect>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.inputEquip.orderNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'partName', header: t('production.inputEquip.partName'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'equipName', header: t('production.inputEquip.inspectEquip'), size: 110 },
    { accessorKey: 'lotNo', header: t('production.inputEquip.lotNo'), size: 150, meta: { filterType: 'text' as const } },
    {
      id: 'range', header: t('production.inputEquip.inspectRange'), size: 120,
      cell: ({ row }) => <span className="text-text-muted text-xs">{row.original.lowerLimit} ~ {row.original.upperLimit}</span>,
    },
    {
      accessorKey: 'measuredValue', header: t('production.inputEquip.measuredValue'), size: 90,
      cell: ({ row }) => {
        const { measuredValue, lowerLimit, upperLimit } = row.original;
        const inRange = measuredValue >= lowerLimit && measuredValue <= upperLimit;
        return <span className={inRange ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{measuredValue}</span>;
      },
    },
    {
      accessorKey: 'passYn', header: t('production.inputEquip.judgment'), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('production.inputEquip.pass')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('production.inputEquip.fail')}</span>;
      },
    },
    { accessorKey: 'inspector', header: t('production.inputEquip.inspector'), size: 80 },
    { accessorKey: 'inspectDate', header: t('production.inputEquip.inspectDate'), size: 100 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Microscope className="w-7 h-7 text-primary" />{t('production.inputEquip.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.inputEquip.description')}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}><Save className="w-4 h-4 mr-1" />{t('production.inputEquip.inputInspect')}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.inputEquip.inspectCount')} value={stats.total} icon={Target} color="blue" />
        <StatCard label={t('production.inputEquip.pass')} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t('production.inputEquip.fail')} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t('production.inputEquip.passRate')} value={`${stats.passRate}%`} icon={Gauge} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.inputEquip.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.inputEquip.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('production.inputEquip.modalTitle')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <WorkOrderContext selectedOrderNo={form.orderNo} onSelect={(v) => setForm((p) => ({ ...p, orderNo: v }))} processFilter={["INSP"]} />
            <Select label={t('production.inputEquip.inspectEquip')} options={[{ value: 'T-001', label: 'TESTER-001 (4.5~5.5)' }, { value: 'T-002', label: 'TESTER-002 (3.0~4.0)' }, { value: 'T-003', label: 'TESTER-003 (2.0~3.0)' }]} value={form.equipId} onChange={v => setForm(p => ({ ...p, equipId: v }))} fullWidth />
          </div>
          <Input label={t('production.inputEquip.lotNo')} value={form.lotNo} onChange={e => setForm(p => ({ ...p, lotNo: e.target.value }))} fullWidth />
          <Input label={t('production.inputEquip.measuredValue')} type="number" step="0.1" value={form.measuredValue} onChange={e => setForm(p => ({ ...p, measuredValue: e.target.value }))} fullWidth />
          <Input label={t('production.inputEquip.remark')} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.orderNo}>
              <Save className="w-4 h-4 mr-1" />{saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
