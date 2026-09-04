/**
 * @file packages/shared/src/utils/mat-list-filter-rules.ts
 * @description 자재 모듈 목록 화면의 "기본 조건" 규칙 — 조건 없는 전량 조회 금지 원칙의 단일 출처
 *
 * 초보자 가이드:
 * 1. 처리성 화면(처리하면 목록에서 빠짐)은 기본 상태 = 미완료. 전체/종결 상태를 고르면 날짜구간(기본 당일)이 붙는다.
 * 2. 여기 상수는 프론트 기본 필터값과 백엔드 status 파라미터 해석 양쪽에서 import 한다.
 */

/** 입하관리(IQC005) PO 라인 "미완료" 상태 집합 — 미입하(OPEN)·일부입하(PARTIAL) */
export const PO_LINE_PENDING_STATUSES = ['OPEN', 'PARTIAL'] as const;
/** PO 라인 목록 API status 파라미터에서 "미완료 전체"를 뜻하는 가상 상태값 */
export const PO_LINE_PENDING_FILTER = 'PENDING';

/** 특채 대상 목록 status 파라미터 — 미특채(그룹 내 미처리 시리얼 존재) */
export const CONCESSION_PENDING_FILTER = 'PENDING';
/** 특채 대상 목록 status 파라미터 — 특채완료(그룹 전체 시리얼 특채) */
export const CONCESSION_ACCEPTED_FILTER = 'ACCEPTED';
