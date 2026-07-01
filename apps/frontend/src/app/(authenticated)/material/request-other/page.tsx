"use client";

/**
 * @file src/app/(authenticated)/material/request-other/page.tsx
 * @description 기타출고요청 페이지 - 작업지시 없이 생성되는 ISSUE_TYPE=MANUAL 출고요청 관리
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus2, PackagePlus, RefreshCw, Search } from 'lucide-react';
import { Button, Card, CardContent, Input, Select } from '@/components/ui';
import RequestTable from '@/components/material/RequestTable';
import { useApiQuery } from '@/hooks/useApi';
import type { IssueRequest } from '@/hooks/material/useIssueRequestData';
import OtherIssueRequestDetailPanel from './components/OtherIssueRequestDetailPanel';

type PanelMode = 'detail' | 'create';

interface IssueRequestListResponse {
  data: IssueRequest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function OtherIssueRequestPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [panelMode, setPanelMode] = useState<PanelMode>('detail');
  const [detailTarget, setDetailTarget] = useState<IssueRequest | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ page: '1', limit: '50', issueType: 'MANUAL' });
    if (statusFilter) params.set('status', statusFilter);
    if (searchText) params.set('search', searchText);
    return params.toString();
  }, [statusFilter, searchText]);

  const { data, isLoading, refetch } = useApiQuery<IssueRequestListResponse>(
    ['issue-request-other', statusFilter, searchText],
    `/material/issue-requests?${queryParams}`,
    { staleTime: 30_000 },
  );

  const requests = useMemo(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : (raw as IssueRequestListResponse | undefined)?.data ?? [];
    return list.filter((request) => request.issueType === 'MANUAL');
  }, [data]);

  useEffect(() => {
    if (panelMode === 'create') return;
    if (requests.length === 0) {
      setDetailTarget(null);
      return;
    }
    if (!detailTarget || !requests.some((request) => request.requestNo === detailTarget.requestNo)) {
      setDetailTarget(requests[0]);
    }
  }, [detailTarget, panelMode, requests]);

  const handleSelectRequest = (request: IssueRequest) => {
    setDetailTarget(request);
    setPanelMode('detail');
  };

  const handleSubmitted = async () => {
    await refetch();
    setPanelMode('detail');
  };

  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'REQUESTED', label: t('material.request.status.requested', '요청') },
    { value: 'APPROVED', label: t('material.request.status.approved', '승인') },
    { value: 'PARTIAL', label: t('material.request.status.partial', '부분출고') },
    { value: 'COMPLETED', label: t('material.request.status.completed', '완료') },
    { value: 'REJECTED', label: t('material.request.status.rejected', '반려') },
  ];

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <PackagePlus className="w-7 h-7 text-primary" />
              {t('material.requestOther.title', '기타출고요청')}
            </h1>
            <p className="text-text-muted mt-1">
              {t('material.requestOther.description', '작업지시 없이 필요한 자재 출고요청을 등록하고 조회합니다.')}
            </p>
          </div>
          <Button size="sm" onClick={() => setPanelMode('create')}>
            <FilePlus2 className="w-4 h-4 mr-1" />
            {t('material.requestOther.newRequest', '기타출고요청')}
          </Button>
        </div>

        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col min-h-0">
            <RequestTable
              data={requests}
              isLoading={isLoading}
              onViewDetail={handleSelectRequest}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t('material.request.searchRequestPlaceholder', '요청번호 / 품목 / 비고 검색')}
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <div className="w-40 flex-shrink-0">
                    <Select
                      options={statusOptions}
                      value={statusFilter}
                      onChange={setStatusFilter}
                      fullWidth
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => refetch()} className="flex-shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>

      </div>

      <OtherIssueRequestDetailPanel
        request={detailTarget}
        mode={panelMode}
        onCancelCreate={() => setPanelMode('detail')}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
