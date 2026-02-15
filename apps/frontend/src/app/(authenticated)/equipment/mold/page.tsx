"use client";

/**
 * @file src/app/(authenticated)/equipment/mold/page.tsx
 * @description 금형관리 페이지 - 타수(Shot Count) 및 수명 관리
 *
 * 초보자 가이드:
 * 1. **금형(Applicator)**: 터미널 압착에 사용되는 금형 도구
 * 2. **타수(Shot)**: 금형 사용 횟수, 수명 관리의 기준
 * 3. **수명 프로그래스바**: 현재타수/기대수명 비율로 교체 시기 판단
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, RefreshCw, RotateCcw, Settings2, Package, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { Mold, MoldStatus, moldStatusStyles } from '@/types/mold';

// Mock 데이터
const mockMolds: Mold[] = [
  { id: '1', moldCode: 'MD-001', moldName: '110형 금형 A', terminalCode: 'T-001', terminalName: '110형 단자', currentShots: 45000, expectedLife: 100000, status: 'OK', lastMaintDate: '2025-01-10', nextMaintDate: '2025-02-10', location: 'CRM-001' },
  { id: '2', moldCode: 'MD-002', moldName: '250형 금형 B', terminalCode: 'T-002', terminalName: '250형 단자', currentShots: 82000, expectedLife: 100000, status: 'WARNING', lastMaintDate: '2024-12-20', nextMaintDate: '2025-01-20', location: 'CRM-001' },
  { id: '3', moldCode: 'MD-003', moldName: '312형 금형 C', terminalCode: 'T-003', terminalName: '312형 단자', currentShots: 95000, expectedLife: 100000, status: 'REPLACE', lastMaintDate: '2024-11-15', nextMaintDate: '2024-12-15', location: '창고' },
  { id: '4', moldCode: 'MD-004', moldName: '110형 금형 D', terminalCode: 'T-001', terminalName: '110형 단자', currentShots: 0, expectedLife: 100000, status: 'MAINT', lastMaintDate: '2025-01-25', nextMaintDate: '2025-02-25', location: '정비실', remark: '신규 금형 정비중' },
  { id: '5', moldCode: 'MD-005', moldName: '040형 금형 E', terminalCode: 'T-004', terminalName: '040형 단자', currentShots: 28000, expectedLife: 80000, status: 'OK', lastMaintDate: '2025-01-05', nextMaintDate: '2025-02-05', location: 'CRM-002' },
];

function MoldPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedMold, setSelectedMold] = useState<Mold | null>(null);

  const statusOptions = useMemo(() => [
    { value: '', label: t('crimping.mold.allStatus') },
    { value: 'OK', label: t('crimping.mold.ok') },
    { value: 'WARNING', label: t('crimping.mold.warning') },
    { value: 'REPLACE', label: t('crimping.mold.replace') },
    { value: 'MAINT', label: t('crimping.mold.maint') },
  ], [t]);

  const filteredMolds = useMemo(() => {
    return mockMolds.filter((m) => {
      const matchStatus = !statusFilter || m.status === statusFilter;
      const matchSearch = !searchText ||
        m.moldCode.toLowerCase().includes(searchText.toLowerCase()) ||
        m.moldName.toLowerCase().includes(searchText.toLowerCase()) ||
        m.terminalName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const stats = useMemo(() => ({
    total: mockMolds.length,
    ok: mockMolds.filter(m => m.status === 'OK').length,
    warning: mockMolds.filter(m => m.status === 'WARNING').length,
    replace: mockMolds.filter(m => m.status === 'REPLACE').length,
    maint: mockMolds.filter(m => m.status === 'MAINT').length,
  }), []);

  const urgentMolds = useMemo(() =>
    mockMolds.filter(m => m.status === 'WARNING' || m.status === 'REPLACE')
      .sort((a, b) => (b.currentShots / b.expectedLife) - (a.currentShots / a.expectedLife)), []);

  const handleReset = () => {
    console.log(`금형 타수 리셋: ${selectedMold?.moldCode}`);
    setIsResetOpen(false);
    setSelectedMold(null);
  };

  const LifeBar = ({ current, expected }: { current: number; expected: number }) => {
    const percent = Math.min(Math.round((current / expected) * 100), 100);
    const color = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs text-text-muted w-10 text-right">{percent}%</span>
      </div>
    );
  };

  const columns = useMemo<ColumnDef<Mold>[]>(() => [
    { accessorKey: 'moldCode', header: t('crimping.mold.moldCode'), size: 90 },
    { accessorKey: 'moldName', header: t('crimping.mold.moldName'), size: 120 },
    { accessorKey: 'terminalName', header: t('crimping.mold.terminal'), size: 100 },
    { id: 'shots', header: t('crimping.mold.shotsLife'), size: 150,
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.currentShots.toLocaleString()} / {row.original.expectedLife.toLocaleString()}</div>
          <LifeBar current={row.original.currentShots} expected={row.original.expectedLife} />
        </div>
      ),
    },
    { accessorKey: 'status', header: t('common.status'), size: 90,
      cell: ({ getValue }) => {
        const s = getValue() as MoldStatus;
        return <span className={`px-2 py-1 text-xs rounded-full ${moldStatusStyles[s].color}`}>{moldStatusStyles[s].label}</span>;
      },
    },
    { accessorKey: 'location', header: t('crimping.mold.location'), size: 80 },
    { accessorKey: 'nextMaintDate', header: t('crimping.mold.nextMaint'), size: 100 },
    { id: 'actions', header: t('common.actions'), size: 80,
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedMold(row.original); setIsResetOpen(true); }}
          className="p-1 hover:bg-surface rounded"
          title={t('crimping.mold.resetButton')}
        >
          <RotateCcw className="w-4 h-4 text-primary" />
        </button>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Settings2 className="w-7 h-7 text-primary" />{t('crimping.mold.title')}</h1>
          <p className="text-text-muted mt-1">{t('crimping.mold.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
          <Button size="sm" onClick={() => { setSelectedMold(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('crimping.mold.register')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label={t('common.total')} value={stats.total} icon={Settings2} color="blue" />
        <StatCard label={t('crimping.mold.ok')} value={stats.ok} icon={CheckCircle} color="green" />
        <StatCard label={t('crimping.mold.warning')} value={stats.warning} icon={AlertTriangle} color="yellow" />
        <StatCard label={t('crimping.mold.replace')} value={stats.replace} icon={XCircle} color="red" />
        <StatCard label={t('crimping.mold.maint')} value={stats.maint} icon={RotateCcw} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <Input placeholder={t('crimping.mold.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
              </div>
              <DataGrid data={filteredMolds} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedMold(row); setIsResetOpen(true); }} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader title={t('crimping.mold.replaceSchedule')} subtitle={t('crimping.mold.replaceScheduleDesc')} />
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {urgentMolds.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">{t('crimping.mold.noReplaceMold')}</div>
                ) : (
                  urgentMolds.map((mold) => (
                    <div key={mold.id} className={`p-3 rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow ${moldStatusStyles[mold.status].bgColor}`} onClick={() => { setSelectedMold(mold); setIsResetOpen(true); }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-text">{mold.moldName}</div>
                          <div className="text-sm text-text-muted">{mold.moldCode} | {mold.terminalName}</div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${moldStatusStyles[mold.status].color}`}>{moldStatusStyles[mold.status].label}</span>
                      </div>
                      <div className="mt-2"><LifeBar current={mold.currentShots} expected={mold.expectedLife} /></div>
                      <div className="text-xs text-text-muted mt-1">{t('crimping.mold.location')}: {mold.location} | {t('crimping.mold.nextMaint')}: {mold.nextMaintDate}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedMold ? t('crimping.mold.editMold') : t('crimping.mold.registerMold')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('crimping.mold.moldCode')} placeholder="MD-001" defaultValue={selectedMold?.moldCode} fullWidth />
            <Input label={t('crimping.mold.moldName')} placeholder="110형 금형 A" defaultValue={selectedMold?.moldName} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('crimping.mold.terminalCode')} placeholder="T-001" defaultValue={selectedMold?.terminalCode} fullWidth />
            <Input label={t('crimping.mold.location')} placeholder="CRM-001" defaultValue={selectedMold?.location} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('crimping.mold.currentShots')} type="number" placeholder="0" defaultValue={String(selectedMold?.currentShots || 0)} fullWidth />
            <Input label={t('crimping.mold.expectedLife')} type="number" placeholder="100000" defaultValue={String(selectedMold?.expectedLife || 100000)} fullWidth />
          </div>
          <Input label={t('common.remark')} placeholder={t('common.remark')} defaultValue={selectedMold?.remark} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{selectedMold ? t('common.edit') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isResetOpen} onClose={() => { setIsResetOpen(false); setSelectedMold(null); }} title={t('crimping.mold.resetTitle')} size="sm">
        {selectedMold && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="flex items-center gap-2 text-text-muted text-sm"><Package className="w-4 h-4" />{t('crimping.mold.selectedMold')}</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedMold.moldName}</div>
              <div className="text-sm text-text-muted">{selectedMold.moldCode} | {selectedMold.terminalName}</div>
              <div className="mt-3 p-2 bg-surface rounded">
                <div className="text-sm text-text-muted">{t('crimping.mold.lifeProgress')}</div>
                <LifeBar current={selectedMold.currentShots} expected={selectedMold.expectedLife} />
                <div className="text-xs text-text-muted mt-1">{selectedMold.currentShots.toLocaleString()} / {selectedMold.expectedLife.toLocaleString()} shots</div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <div className="text-sm font-medium text-text mb-2">{t('crimping.mold.resetSettings')}</div>
              <Input label={t('crimping.mold.newExpectedLife')} placeholder={t('crimping.mold.newExpectedLifePlaceholder')} fullWidth />
              <div className="text-xs text-text-muted mt-2">{t('crimping.mold.resetNote')}</div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => { setIsResetOpen(false); setSelectedMold(null); }}>{t('common.cancel')}</Button>
              <Button onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />{t('crimping.mold.resetButton')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default MoldPage;
