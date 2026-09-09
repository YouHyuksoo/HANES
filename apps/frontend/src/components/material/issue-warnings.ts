/**
 * @file src/components/material/issue-warnings.ts
 * @description 자재 출고/출고요청 API 응답의 `warnings: string[]`(FIFO WARN, IQC 미검사 안내, 승인 재고 경고)를
 *              사용자에게 toast 로 보여주는 공통 지점.
 *
 * 초보자 가이드:
 * 1. 백엔드는 차단(BLOCK)이 아닌 정책 위반을 응답 `warnings` 배열로 돌려준다(응답 형태는 기존 그대로, 필드만 추가).
 * 2. 응답 래퍼(`{ data: {...} }`)·행 배열(`[{ warnings }]`)·중첩(`{ request, issueResult, warnings }`) 어느 형태든
 *    `extractIssueWarnings` 가 문자열 배열로 평탄화한다.
 * 3. `notifyIssueWarnings` 는 react-hot-toast 경고 toast 로 띄운다(브라우저 기본 알림창 금지 규칙).
 */
import toast from 'react-hot-toast';

const WARNING_TOAST_DURATION_MS = 8000;

function collect(value: unknown, out: string[], depth: number): void {
  if (!value || typeof value !== 'object' || depth > 3) return;
  if (Array.isArray(value)) {
    for (const row of value) collect(row, out, depth + 1);
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.warnings)) {
    for (const message of record.warnings) {
      if (typeof message === 'string' && message.trim()) out.push(message);
    }
  }
  if ('data' in record) collect(record.data, out, depth + 1);
  if (Array.isArray(record.issueResult)) collect(record.issueResult, out, depth + 1);
}

/** API 응답(axios `res.data` 또는 `res.data.data`)에서 warnings 를 중복 없이 모은다 */
export function extractIssueWarnings(payload: unknown): string[] {
  const out: string[] = [];
  collect(payload, out, 0);
  return [...new Set(out)];
}

/** warnings 가 있으면 경고 toast 로 보여준다. 반환값은 표시한 경고 목록 */
export function notifyIssueWarnings(payload: unknown): string[] {
  const warnings = extractIssueWarnings(payload);
  for (const message of warnings) {
    toast(message, { icon: '⚠️', duration: WARNING_TOAST_DURATION_MS, id: `issue-warning:${message}` });
  }
  return warnings;
}
