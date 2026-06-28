"use client";

/**
 * @file src/app/(authenticated)/production/result/page.tsx
 * @description 생산실적 조회 페이지 (절단/압착/조립/검사/포장 통합 + 작업자 선택)
 *
 * 초보자 가이드:
 * 1. **생산실적**: 작업지시에 대한 실제 생산 결과 기록
 * 2. **공정유형**: CUT(절단), CRIMP(압착), ASSY(조립), INSP(검사), PACK(포장)
 * 3. **작업자 아바타**: 부서별 색상 이니셜 아바타 표시
 * 4. API: GET /production/prod-results
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw, Factory,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, Button, Input, Select, ComCodeBadge, ConfirmModal, Modal } from '@/components/ui';
import { getTodayLocal } from '@/utils/date';
import { QtyInput } from '@/components/shared';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useComCodeOptions } from '@/hooks/useComCode';
import { useEquipOptions } from '@/hooks/useMasterOptions';
import { WorkerAvatar } from '@/components/worker/WorkerSelector';
import { getWorkerDisplayName } from '@/components/worker/workerAvatar';
import api from '@/services/api';

/** 생산실적 인터페이스 */
interface ProdResult {
  id: string;
  resultNo: string;
  orderNo: string;
  processType: string;
  itemCode: string;
  itemName: string;
  lineName: string;
  processName: string;
  equipName: string;
  workerName?: string | null;
  workerDept?: string | null;
  workerId?: string | null;
  worker?: { workerName?: string | null; dept?: string | null };
  prdUid: string;
  goodQty: number;
  defectQty: number;
  totalQty: number;
  status: string;
  workDate: string;
  startAt: string;
  endAt: string;
  workHours: number;
}

export default function ProdResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProdResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProdResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<ProdResult | null>(null);
  const [editForm, setEditForm] = useState({ goodQty: '', defectQty: '', remark: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  /** 공정 유형 필터 */
  const comCodeProcessOptions = useComCodeOptions('PROCESS_TYPE');
  const processTypeOptions = useMemo(() => [
    { value: '', label: t('production.order.processAll') },
    ...comCodeProcessOptions.filter(o => ['CUT','CRIMP','ASSY','INSP','PACK'].includes(o.value))
  ], [t, comCodeProcessOptions]);

  /** 설비 필터 */
  const { options: rawEquipOptions } = useEquipOptions();
  const equipOptions = useMemo(() => [
    { value: '', label: t('production.result.equipAll', '전체 설비') },
    ...rawEquipOptions,
  ], [rawEquipOptions, t]);

  // 필터 상태
  const [processTypeFilter, setProcessTypeFilter] = useState('');
  const [equipFilter, setEquipFilter] = useState('');
  const [startDate, setStartDate] = useState(() => getTodayLocal());
  const [endDate, setEndDate] = useState(() => getTodayLocal());
  const [searchText, setSearchText] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (processTypeFilter) params.processCode = processTypeFilter;
      if (equipFilter) params.equipCode = equipFilter;
      if (startDate) params.startTimeFrom = startDate;
      if (endDate) params.startTimeTo = endDate;
      const res = await api.get('/production/prod-results', { params });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setData(rows.map((row: ProdResult) => ({
        ...row,
        workerName: row.workerName ?? row.worker?.workerName ?? row.workerId ?? null,
        workerDept: row.workerDept ?? row.worker?.dept ?? null,
      })));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, processTypeFilter, equipFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 실적 삭제 — 연결 수불/재고를 되돌린 뒤 실적 row를 제거한다. */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/production/prod-results/${deleteTarget.resultNo}`);
      toast.success(t('production.result.deleteSuccess', '실적이 삭제되고 재고가 역분개되었습니다.'));
      setDeleteTarget(null);
      fetchData();
    } catch {
      // api 인터셉터 처리
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchData, t]);

  /** 실적 수정 모달 열기 */
  const openEdit = useCallback((row: ProdResult) => {
    setEditForm({ goodQty: String(row.goodQty ?? 0), defectQty: String(row.defectQty ?? 0), remark: '' });
    setEditTarget(row);
  }, []);

  /** 실적 수정 저장 — 수량 변경 시 백엔드가 자재+제품재고를 재동기화한다 */
  const handleEditSave = useCallback(async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await api.put(`/production/prod-results/${editTarget.resultNo}`, {
        goodQty: Number(editForm.goodQty) || 0,
        defectQty: Number(editForm.defectQty) || 0,
        ...(editForm.remark ? { remark: editForm.remark } : {}),
      });
      toast.success(t('production.result.editSuccess', '실적이 수정되었습니다.'));
      setEditTarget(null);
      fetchData();
    } catch {
      // api 인터셉터 처리
    } finally {
      setSavingEdit(false);
    }
  }, [editTarget, editForm, fetchData, t]);

  const getDefectRate = (result: ProdResult): string => {
    if (result.totalQty === 0) return '0.0';
    return ((result.defectQty / result.totalQty) * 100).toFixed(1);
  };

  /** 통계 */
  /** 컬럼 정의 */
  const columns = useMemo<ColumnDef<ProdResult>[]>(
    () => [
      { accessorKey: 'resultNo', header: t('production.result.resultNo'), size: 150, meta: { filterType: 'text' as const } },
      { accessorKey: 'workDate', header: t('production.result.workDate'), size: 100, meta: { filterType: 'date' as const } },
      {
        accessorKey: 'processType', header: t('production.order.processType'), size: 80,
        meta: { filterType: 'multi' as const },
        cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
      },
      { accessorKey: 'orderNo', header: t('production.result.orderNo'), size: 150, meta: { filterType: 'text' as const } },
      { accessorKey: 'itemName', header: t('production.result.partName'), size: 130, meta: { filterType: 'text' as const } },
      { accessorKey: 'lineName', header: t('production.progress.line'), size: 90, meta: { filterType: 'text' as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
      { accessorKey: 'equipName', header: t('production.result.equipment'), size: 90, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'workerName', header: t('production.result.worker'), size: 110,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => {
          const workerName = row.original.workerName ?? row.original.worker?.workerName ?? row.original.workerId;
          const workerDept = row.original.workerDept ?? row.original.worker?.dept;
          return (
            <div className="flex items-center gap-2">
              <WorkerAvatar name={workerName} dept={workerDept} size="sm" />
              <span className="text-sm">{getWorkerDisplayName(workerName)}</span>
            </div>
          );
        }
      },
      { accessorKey: 'prdUid', header: t('production.result.prdUid'), size: 150, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'goodQty', header: t('production.result.goodQty'), size: 70,
        meta: { filterType: 'number' as const },
        cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>
      },
      {
        accessorKey: 'defectQty', header: t('production.result.defectQty'), size: 70,
        meta: { filterType: 'number' as const },
        cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>
      },
      {
        id: 'defectRate', header: t('production.result.defectRate'), size: 80,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => {
          const rate = parseFloat(getDefectRate(row.original));
          return <span className={`${rate > 3 ? 'text-red-500' : 'text-text-muted'}`}>{rate}%</span>;
        }
      },
      {
        id: 'workTime', header: t('production.result.workTime'), size: 120,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => <span className="text-text-muted">{row.original.startAt} ~ {row.original.endAt}</span>
      },
      {
        id: 'actions', header: t('common.actions'), size: 120,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => {
          return (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
                {t('common.edit')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(row.original)}
                className="text-red-600 dark:text-red-400">
                {t('common.delete')}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, openEdit]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Factory className="w-7 h-7 text-primary" />
            {t('production.result.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.result.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* 메인 카드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
            enableExport exportFileName={t('production.result.title')}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t('production.result.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-32 flex-shrink-0">
                  <Select options={processTypeOptions} value={processTypeFilter} onChange={setProcessTypeFilter} fullWidth />
                </div>
                <div className="w-44 flex-shrink-0">
                  <Select options={equipOptions} value={equipFilter} onChange={setEquipFilter} fullWidth />
                </div>
                <DateRangeFilter from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
              </div>
            }
            sqlQuery={`SELECT *\nFROM PROD_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.resultNo || ''}' ${t('production.result.deleteConfirm', '실적을 삭제하시겠습니까? 연결된 수불과 재고가 역분개됩니다.')}`}
      />

      <Modal
        isOpen={!!editTarget}
        onClose={() => !savingEdit && setEditTarget(null)}
        title={`${t('common.edit')} — ${editTarget?.resultNo || ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleEditSave} disabled={savingEdit}>
              {savingEdit ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            {t('production.result.editHint', '수량 변경 시 자재 차감과 제품재고가 자동 재동기화됩니다.')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <QtyInput label={t('production.result.goodQty')}
              value={Number(editForm.goodQty) || 0} onChange={(n) => setEditForm(f => ({ ...f, goodQty: String(n) }))} fullWidth />
            <QtyInput label={t('production.result.defectQty')}
              value={Number(editForm.defectQty) || 0} onChange={(n) => setEditForm(f => ({ ...f, defectQty: String(n) }))} fullWidth />
          </div>
          <Input label={t('common.remark')} value={editForm.remark}
            onChange={(e) => setEditForm(f => ({ ...f, remark: e.target.value }))} fullWidth />
        </div>
      </Modal>
    </div>
  );
}
