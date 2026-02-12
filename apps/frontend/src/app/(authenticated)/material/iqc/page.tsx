"use client";

/**
 * @file src/pages/material/iqc/IqcPage.tsx
 * @description 수입검사(IQC) 페이지 - 입하 자재 품질 검사 관리
 *
 * 초보자 가이드:
 * 1. **IQC**: Incoming Quality Control, 수입(입하) 자재 품질 검사
 * 2. **대상**: 입하 후 PENDING, IQC_IN_PROGRESS 상태인 건
 * 3. **프로세스**: 입하(가입고) → [IQC 검사] → 합격/불합격 → 입고관리로 이동
 */
import { Shield, Search, RefreshCw, Clock, ClipboardCheck, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import IqcTable from '@/components/material/IqcTable';
import IqcModal from '@/components/material/IqcModal';
import { useIqcData } from '@/hooks/material/useIqcData';

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '검사대기' },
  { value: 'IQC_IN_PROGRESS', label: '검사중' },
  { value: 'PASSED', label: '합격' },
  { value: 'FAILED', label: '불합격' },
];

export default function IqcPage() {
  const {
    filteredItems,
    stats,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    isIqcModalOpen, setIsIqcModalOpen,
    selectedItem,
    resultForm, setResultForm,
    openIqcModal,
    handleIqcSubmit,
  } = useIqcData();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            수입검사 (IQC)
          </h1>
          <p className="text-text-muted mt-1">입하 자재의 품질 검사를 수행합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="검사대기" value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label="검사중" value={stats.inProgress} icon={ClipboardCheck} color="blue" />
        <StatCard label="합격" value={stats.passed} icon={CheckCircle} color="green" />
        <StatCard label="불합격" value={stats.failed} icon={XCircle} color="red" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="입하번호, 품목명, LOT번호 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-40">
              <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <IqcTable data={filteredItems} onInspect={openIqcModal} />
        </CardContent>
      </Card>

      {/* IQC 검사결과 등록 모달 */}
      <IqcModal
        isOpen={isIqcModalOpen}
        onClose={() => setIsIqcModalOpen(false)}
        selectedItem={selectedItem}
        form={resultForm}
        setForm={setResultForm}
        onSubmit={handleIqcSubmit}
      />
    </div>
  );
}
