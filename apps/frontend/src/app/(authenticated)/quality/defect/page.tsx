"use client";

/**
 * @file src/pages/quality/DefectPage.tsx
 * @description 불량관리 페이지 - 불량 등록, 상태 관리, 통계 조회
 *
 * 초보자 가이드:
 * 1. **불량 목록**: DataGrid로 발생시간, 작업지시, 불량코드 등 표시
 * 2. **필터**: 날짜, 불량유형, 상태로 필터링
 * 3. **불량 등록**: 모달을 통해 새 불량 등록
 * 4. **상태 변경**: 수리대기 -> 수리중 -> 완료/폐기
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  RefreshCw,
  AlertTriangle,
  Wrench,
  CheckCircle,
  XCircle,
  Trash2,
  Calendar,
  Clock,
  Search,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';

// ========================================
// 타입 정의
// ========================================
type DefectStatus = 'PENDING' | 'REPAIRING' | 'COMPLETED' | 'SCRAPPED';

interface Defect {
  id: string;
  occurredAt: string;
  workOrderNo: string;
  defectCode: string;
  defectName: string;
  quantity: number;
  status: DefectStatus;
  partNo: string;
  equipmentNo: string;
  operator: string;
  remark?: string;
}

// ========================================
// Mock 데이터
// ========================================
const mockDefects: Defect[] = [
  {
    id: 'DEF-001',
    occurredAt: '2024-01-15 09:30',
    workOrderNo: 'WO-2024-0115-001',
    defectCode: 'D001',
    defectName: '피복 손상',
    quantity: 3,
    status: 'PENDING',
    partNo: 'WIRE-001',
    equipmentNo: 'CUT-01',
    operator: '김철수',
    remark: '절단면 불량',
  },
  {
    id: 'DEF-002',
    occurredAt: '2024-01-15 10:15',
    workOrderNo: 'WO-2024-0115-002',
    defectCode: 'D002',
    defectName: '압착 불량',
    quantity: 5,
    status: 'REPAIRING',
    partNo: 'TERM-002',
    equipmentNo: 'CRM-02',
    operator: '이영희',
  },
  {
    id: 'DEF-003',
    occurredAt: '2024-01-15 11:00',
    workOrderNo: 'WO-2024-0115-003',
    defectCode: 'D003',
    defectName: '통전 불량',
    quantity: 2,
    status: 'COMPLETED',
    partNo: 'HARNESS-001',
    equipmentNo: 'INS-01',
    operator: '박민수',
  },
  {
    id: 'DEF-004',
    occurredAt: '2024-01-15 13:30',
    workOrderNo: 'WO-2024-0115-004',
    defectCode: 'D004',
    defectName: '외관 불량',
    quantity: 1,
    status: 'SCRAPPED',
    partNo: 'CONN-003',
    equipmentNo: 'ASM-01',
    operator: '정수진',
    remark: '복구 불가',
  },
  {
    id: 'DEF-005',
    occurredAt: '2024-01-15 14:20',
    workOrderNo: 'WO-2024-0115-005',
    defectCode: 'D001',
    defectName: '피복 손상',
    quantity: 4,
    status: 'PENDING',
    partNo: 'WIRE-002',
    equipmentNo: 'CUT-02',
    operator: '최동훈',
  },
];

// ========================================
// 메인 컴포넌트
// ========================================
function DefectPage() {
  const { t } = useTranslation();

  const defectTypes = useMemo(() => [
    { value: '', label: t('quality.defect.allTypes') },
    { value: 'D001', label: t('quality.defect.typeCoating') },
    { value: 'D002', label: t('quality.defect.typeCrimping') },
    { value: 'D003', label: t('quality.defect.typeContinuity') },
    { value: 'D004', label: t('quality.defect.typeAppearance') },
  ], [t]);

  const comCodeStatusOptions = useComCodeOptions('DEFECT_STATUS');
  const statusOptions = useMemo(() => [{ value: '', label: t('common.allStatus') }, ...comCodeStatusOptions], [t, comCodeStatusOptions]);
  // 상태 관리
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [defectType, setDefectType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // 필터링된 데이터
  const filteredDefects = useMemo(() => {
    return mockDefects.filter((defect) => {
      if (defectType && defect.defectCode !== defectType) return false;
      if (statusFilter && defect.status !== statusFilter) return false;
      if (searchText && !defect.workOrderNo.toLowerCase().includes(searchText.toLowerCase()) && !defect.defectName.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [defectType, statusFilter, searchText]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = filteredDefects.length;
    const pending = filteredDefects.filter((d) => d.status === 'PENDING').length;
    const repairing = filteredDefects.filter((d) => d.status === 'REPAIRING').length;
    const completed = filteredDefects.filter((d) => d.status === 'COMPLETED').length;
    const scrapped = filteredDefects.filter((d) => d.status === 'SCRAPPED').length;
    const totalQty = filteredDefects.reduce((sum, d) => sum + d.quantity, 0);

    return { total, pending, repairing, completed, scrapped, totalQty };
  }, [filteredDefects]);

  // 상태 변경 핸들러
  const handleStatusChange = (newStatus: DefectStatus) => {
    if (selectedDefect) {
      console.log(`상태 변경: ${selectedDefect.id} -> ${newStatus}`);
      // TODO: API 호출
    }
    setIsStatusModalOpen(false);
    setSelectedDefect(null);
  };

  // 컬럼 정의
  const columns = useMemo<ColumnDef<Defect>[]>(
    () => [
      {
        accessorKey: 'occurredAt',
        header: t('quality.defect.occurredAt'),
        size: 140,
      },
      {
        accessorKey: 'workOrderNo',
        header: t('quality.defect.workOrder'),
        size: 160,
        cell: ({ getValue }) => (
          <span className="text-primary font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'defectCode',
        header: t('quality.defect.defectCode'),
        size: 80,
      },
      {
        accessorKey: 'defectName',
        header: t('quality.defect.defectName'),
        size: 100,
      },
      {
        accessorKey: 'quantity',
        header: t('quality.defect.quantity'),
        size: 60,
        cell: ({ getValue }) => (
          <span className="font-mono text-right block">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 100,
        cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_STATUS" code={getValue() as string} />,
      },
      {
        accessorKey: 'operator',
        header: t('quality.defect.operator'),
        size: 80,
      },
      {
        id: 'actions',
        header: t('common.manage'),
        size: 100,
        cell: ({ row }) => (
          <button
            className="p-1 hover:bg-surface rounded text-xs text-primary"
            onClick={() => {
              setSelectedDefect(row.original);
              setIsStatusModalOpen(true);
            }}
          >
            {t('quality.defect.changeStatus')}
          </button>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><AlertTriangle className="w-7 h-7 text-primary" />{t('quality.defect.title')}</h1>
          <p className="text-text-muted mt-1">{t('quality.defect.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('quality.defect.register')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label={t('quality.defect.totalCount')} value={stats.total} icon={AlertTriangle} color="blue" />
        <StatCard label={t('quality.defect.pending')} value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label={t('quality.defect.repairing')} value={stats.repairing} icon={Wrench} color="blue" />
        <StatCard label={t('quality.defect.completedStat')} value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label={t('quality.defect.totalDefectQty')} value={stats.totalQty} icon={XCircle} color="red" />
      </div>

      {/* 필터 + 데이터 그리드 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('quality.defect.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Select options={defectTypes} value={defectType} onChange={setDefectType} placeholder={t('quality.defect.defectType')} />
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={filteredDefects}
            columns={columns}
            pageSize={10}
            onRowClick={(row) => {
              setSelectedDefect(row);
              setIsStatusModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* 불량 등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('quality.defect.register')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('quality.defect.workOrderNo')} placeholder="WO-2024-XXXX" fullWidth />
            <Select
              label={t('quality.defect.defectType')}
              options={defectTypes.filter((d) => d.value !== '')}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('quality.defect.partNo')} placeholder={t('quality.defect.partNoPlaceholder')} fullWidth />
            <Input label={t('quality.defect.quantity')} type="number" placeholder="0" fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('quality.defect.equipmentNo')} placeholder={t('quality.defect.equipmentNo')} fullWidth />
            <Input label={t('quality.defect.operator')} placeholder={t('quality.defect.operatorPlaceholder')} fullWidth />
          </div>
          <Input label={t('common.remark')} placeholder={t('quality.defect.remarkPlaceholder')} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>{t('common.register')}</Button>
          </div>
        </div>
      </Modal>

      {/* 상태 변경 모달 */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setSelectedDefect(null);
        }}
        title={t('quality.defect.changeStatus')}
        size="sm"
      >
        {selectedDefect && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">{t('quality.defect.selectedDefect')}</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedDefect.id}</div>
              <div className="text-sm text-text-muted mt-2">
                {selectedDefect.defectName} / {t('quality.defect.quantity')}: {selectedDefect.quantity}{t('common.ea')}
              </div>
              <div className="mt-2">
                <ComCodeBadge groupCode="DEFECT_STATUS" code={selectedDefect.status} />
              </div>
            </div>

            <div className="text-sm font-medium text-text mb-2">{t('quality.defect.selectStatus')}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('PENDING')}
                disabled={selectedDefect.status === 'PENDING'}
              >
                <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                {t('quality.defect.pending')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('REPAIRING')}
                disabled={selectedDefect.status === 'REPAIRING'}
              >
                <Wrench className="w-4 h-4 mr-1 text-blue-500" />
                {t('quality.defect.repairing')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('COMPLETED')}
                disabled={selectedDefect.status === 'COMPLETED'}
              >
                <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                {t('quality.defect.completedStat')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('SCRAPPED')}
                disabled={selectedDefect.status === 'SCRAPPED'}
              >
                <Trash2 className="w-4 h-4 mr-1 text-red-500" />
                {t('quality.defect.scrapped')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DefectPage;
