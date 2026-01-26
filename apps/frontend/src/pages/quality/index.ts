/**
 * @file src/pages/quality/index.ts
 * @description 품질관리 페이지 배럴 파일
 *
 * 포함된 페이지:
 * - DefectPage: 불량관리 (불량 등록, 상태 변경, 통계)
 * - InspectPage: 검사실적 (검사 결과, 합격률 통계)
 * - TracePage: 추적성조회 (4M 이력, 타임라인)
 */

export { default as DefectPage } from './DefectPage';
export { default as InspectPage } from './InspectPage';
export { default as TracePage } from './TracePage';
