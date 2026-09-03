/**
 * @file src/services/improvementRequestService.ts
 * @description 개선요청 API 클라이언트
 *
 * 초보자 가이드:
 * 1. create: POST /system/improvement-requests — 요청 등록
 * 2. list: GET  /system/improvement-requests — 목록 조회 (스크린샷 제외)
 * 3. detail: GET /system/improvement-requests/:id — 단건 조회 (스크린샷 포함)
 * 4. updateStatus: PATCH /system/improvement-requests/:id/status
 */
import { api } from './api';
import type { ImprDoneEvidence } from '@harness/shared';

export interface ImprRequestItem {
  imprId: string;
  pageUrl: string;
  elementText: string | null;
  elementTag: string | null;
  description: string;
  screenshot?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  /** DONE 판정 근거 — 수정 커밋 해시 */
  fixCommit?: string | null;
  /** DONE 판정 근거 — 테스트 근거 */
  fixTest?: string | null;
  /** DONE 판정 근거 — 배포 SHA */
  deploySha?: string | null;
  doneAt?: string | null;
  requesterId: string;
  requesterNm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateImprRequestPayload {
  pageUrl: string;
  elementText?: string;
  elementTag?: string;
  description: string;
  screenshot?: string;
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const improvementRequestService = {
  create: (payload: CreateImprRequestPayload): Promise<ImprRequestItem> =>
    api.post('/system/improvement-requests', payload).then((r) => unwrap<ImprRequestItem>(r as any)),

  list: (params?: { status?: string; keyword?: string; fromDate?: string; toDate?: string; page?: number; limit?: number }) =>
    api
      .get<{ data: ImprRequestItem[]; meta: { total: number; page: number; limit: number } }>(
        '/system/improvement-requests',
        { params },
      )
      .then((r) => ({ data: r.data.data, total: r.data.meta.total, page: r.data.meta.page, limit: r.data.meta.limit })),

  detail: (id: string): Promise<ImprRequestItem> =>
    api
      .get(`/system/improvement-requests/${id}`)
      .then((r) => unwrap<ImprRequestItem>(r as any)),

  /** 상태 변경 — DONE 전이는 evidence(커밋 해시·테스트 근거·배포 SHA)가 서버에서 필수 검증된다 */
  updateStatus: (id: string, status: string, evidence?: ImprDoneEvidence): Promise<ImprRequestItem> =>
    api
      .patch(`/system/improvement-requests/${id}/status`, { status, ...(evidence ?? {}) })
      .then((r) => unwrap<ImprRequestItem>(r as any)),
};
