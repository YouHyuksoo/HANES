"use client";

/**
 * @file src/pages/inspection/EquipPage.tsx
 * @description 검사기연동 페이지 - 검사기 상태 모니터링, 연결 상태 표시
 *
 * 초보자 가이드:
 * 1. **검사기 카드**: 각 검사기의 실시간 상태 표시
 * 2. **연결 상태**: CONNECTED(연결), DISCONNECTED(끊김), ERROR(오류)
 * 3. **통신 로그**: 최근 수신 데이터 로그 표시
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import {
  RefreshCw, Wifi, WifiOff, AlertTriangle,
  Cpu, Power, Clock,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Select, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';

// ========================================
// 타입 정의
// ========================================
type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
type CommType = 'MQTT' | 'SERIAL' | 'TCP';

interface InspectorEquip {
  id: string;
  equipCode: string;
  equipName: string;
  commType: CommType;
  status: ConnectionStatus;
  ipAddress?: string;
  port?: string;
  lastDataAt: string;
  todayCount: number;
  passRate: number;
}

interface CommLog {
  id: string;
  timestamp: string;
  equipCode: string;
  direction: 'RX' | 'TX';
  message: string;
  status: 'OK' | 'ERROR';
}

// ========================================
// Mock 데이터
// ========================================
const mockEquipments: InspectorEquip[] = [
  { id: '1', equipCode: 'INSP-01', equipName: '통전검사기 1호', commType: 'MQTT', status: 'CONNECTED', ipAddress: '192.168.1.101', port: '1883', lastDataAt: '2024-01-15 09:15:32', todayCount: 156, passRate: 94.2 },
  { id: '2', equipCode: 'INSP-02', equipName: '통전검사기 2호', commType: 'SERIAL', status: 'CONNECTED', port: 'COM3', lastDataAt: '2024-01-15 09:15:28', todayCount: 142, passRate: 96.5 },
  { id: '3', equipCode: 'INSP-03', equipName: '통전검사기 3호', commType: 'TCP', status: 'DISCONNECTED', ipAddress: '192.168.1.103', port: '5000', lastDataAt: '2024-01-15 08:45:10', todayCount: 89, passRate: 91.0 },
  { id: '4', equipCode: 'INSP-04', equipName: '통전검사기 4호', commType: 'MQTT', status: 'ERROR', ipAddress: '192.168.1.104', port: '1883', lastDataAt: '2024-01-15 07:30:00', todayCount: 45, passRate: 88.9 },
];

const mockLogs: CommLog[] = [
  { id: '1', timestamp: '2024-01-15 09:15:32', equipCode: 'INSP-01', direction: 'RX', message: 'RESULT:PASS,SN:SN-2024011500156,V:12.1,I:0.52', status: 'OK' },
  { id: '2', timestamp: '2024-01-15 09:15:28', equipCode: 'INSP-02', direction: 'RX', message: 'RESULT:PASS,SN:SN-2024011500142,V:12.0,I:0.51', status: 'OK' },
  { id: '3', timestamp: '2024-01-15 09:15:15', equipCode: 'INSP-01', direction: 'TX', message: 'ACK:OK', status: 'OK' },
  { id: '4', timestamp: '2024-01-15 09:14:55', equipCode: 'INSP-04', direction: 'RX', message: 'CONNECTION_TIMEOUT', status: 'ERROR' },
  { id: '5', timestamp: '2024-01-15 09:14:30', equipCode: 'INSP-02', direction: 'RX', message: 'RESULT:FAIL,SN:SN-2024011500141,ERR:E001', status: 'OK' },
];


// ========================================
// 검사기 카드 컴포넌트
// ========================================
function EquipCard({ equip, t }: { equip: InspectorEquip; t: (key: string) => string }) {
  const borderColor = equip.status === 'CONNECTED' ? 'border-green-500' : equip.status === 'ERROR' ? 'border-red-500' : 'border-gray-400';

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-text">{equip.equipName}</h3>
            <p className="text-sm text-text-muted">{equip.equipCode}</p>
          </div>
          <ComCodeBadge groupCode="CONNECTION_STATUS" code={equip.status} />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-text-muted">{t('inspection.equip.commType')}</span><span className="text-text font-medium">{equip.commType}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">{t('inspection.equip.address')}</span><span className="text-text font-mono">{equip.ipAddress || equip.port}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">{t('inspection.equip.lastReceived')}</span><span className="text-text">{equip.lastDataAt.split(' ')[1]}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">{t('inspection.equip.todayCount')}</span><span className="text-text font-bold">{equip.todayCount}{t('common.count')}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">{t('inspection.equip.passRateLabel')}</span><span className={`font-bold ${equip.passRate >= 95 ? 'text-green-500' : 'text-yellow-500'}`}>{equip.passRate}%</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// 메인 컴포넌트
// ========================================
function EquipPage() {
  const { t } = useTranslation();

  const comCodeStatusOptions = useComCodeOptions('CONNECTION_STATUS');
  const statusOptions = useMemo(() => [{ value: '', label: t('common.allStatus') }, ...comCodeStatusOptions], [t, comCodeStatusOptions]);
  const [statusFilter, setStatusFilter] = useState('');

  const filteredEquipments = useMemo(() => {
    if (!statusFilter) return mockEquipments;
    return mockEquipments.filter((e) => e.status === statusFilter);
  }, [statusFilter]);

  const stats = useMemo(() => ({
    total: mockEquipments.length,
    connected: mockEquipments.filter((e) => e.status === 'CONNECTED').length,
    disconnected: mockEquipments.filter((e) => e.status === 'DISCONNECTED').length,
    error: mockEquipments.filter((e) => e.status === 'ERROR').length,
  }), []);

  const logColumns = useMemo<ColumnDef<CommLog>[]>(() => [
    { accessorKey: 'timestamp', header: t('inspection.equip.time'), size: 150 },
    { accessorKey: 'equipCode', header: t('inspection.equip.inspector'), size: 90 },
    { accessorKey: 'direction', header: t('inspection.equip.direction'), size: 60, cell: ({ getValue }) => <span className={getValue() === 'RX' ? 'text-blue-500' : 'text-orange-500'}>{getValue() as string}</span> },
    { accessorKey: 'message', header: t('inspection.equip.message'), size: 350, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: 'status', header: t('common.status'), size: 70, cell: ({ getValue }) => <span className={getValue() === 'OK' ? 'text-green-500' : 'text-red-500'}>{getValue() as string}</span> },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Cpu className="w-7 h-7 text-primary" />{t('inspection.equip.title')}</h1>
          <p className="text-text-muted mt-1">{t('inspection.equip.description')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><Power className="w-5 h-5 text-text-muted" /><span className="text-text-muted text-sm">{t('inspection.equip.totalEquipments')}</span></div><div className="text-lg font-bold leading-tight text-text mt-1">{stats.total}{t('inspection.equip.unit')}</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><Wifi className="w-5 h-5 text-green-500" /><span className="text-text-muted text-sm">{t('inspection.equip.connected')}</span></div><div className="text-lg font-bold leading-tight text-green-500 mt-1">{stats.connected}{t('inspection.equip.unit')}</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><WifiOff className="w-5 h-5 text-gray-500" /><span className="text-text-muted text-sm">{t('inspection.equip.disconnected')}</span></div><div className="text-lg font-bold leading-tight text-gray-500 mt-1">{stats.disconnected}{t('inspection.equip.unit')}</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /><span className="text-text-muted text-sm">{t('inspection.equip.error')}</span></div><div className="text-lg font-bold leading-tight text-red-500 mt-1">{stats.error}{t('inspection.equip.unit')}</div></CardContent></Card>
      </div>

      <Card padding="sm">
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-text">{t('common.filter')}</span>
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredEquipments.map((equip) => <EquipCard key={equip.id} equip={equip} t={t} />)}
      </div>

      <Card>
        <CardHeader title={t('inspection.equip.commLog')} subtitle={t('inspection.equip.commLogSubtitle')} action={<div className="flex items-center gap-1 text-sm text-text-muted"><Clock className="w-4 h-4" />{t('inspection.equip.realtime')}</div>} />
        <CardContent><DataGrid data={mockLogs} columns={logColumns} pageSize={5} /></CardContent>
      </Card>
    </div>
  );
}

export default EquipPage;
