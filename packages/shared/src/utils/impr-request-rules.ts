/**
 * @file packages/shared/src/utils/impr-request-rules.ts
 * @description 개선요청 "처리됨(DONE)" 판정 근거 규칙 — 프론트(모달 활성 조건)와 백엔드(상태 변경 API)가 같은 함수를 쓴다.
 *
 * 배경(2026-09-03): 현장 개선요청이 코드 없이 "처리됨"으로 표시된 사례가 있어, DONE 전이는
 * 수정 커밋 해시 · 테스트 근거 · 배포 SHA 3개가 모두 있을 때만 허용한다.
 */

export const IMPR_DONE_STATUS = 'DONE';

export const IMPR_DONE_EVIDENCE_FIELDS = ['fixCommit', 'fixTest', 'deploySha'] as const;
export type ImprDoneEvidenceField = (typeof IMPR_DONE_EVIDENCE_FIELDS)[number];

export interface ImprDoneEvidence {
  /** 수정 커밋 해시(7~40자 hex) */
  fixCommit?: string | null;
  /** 테스트 근거 — spec 파일 경로 또는 실행 결과 요약 */
  fixTest?: string | null;
  /** 배포된 빌드의 커밋 SHA(7~40자 hex) */
  deploySha?: string | null;
}

const GIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export function isValidGitSha(value?: string | null): boolean {
  return GIT_SHA_PATTERN.test((value ?? '').trim());
}

/** DONE으로 바꾸려는 전이인가 */
export function requiresImprDoneEvidence(status?: string | null): boolean {
  return (status ?? '').trim().toUpperCase() === IMPR_DONE_STATUS;
}

/** 누락되었거나 형식이 틀린 근거 필드 목록(빈 배열이면 DONE 허용) */
export function missingImprDoneEvidence(evidence: ImprDoneEvidence): ImprDoneEvidenceField[] {
  const missing: ImprDoneEvidenceField[] = [];
  if (!isValidGitSha(evidence.fixCommit)) missing.push('fixCommit');
  if (!(evidence.fixTest ?? '').trim()) missing.push('fixTest');
  if (!isValidGitSha(evidence.deploySha)) missing.push('deploySha');
  return missing;
}
