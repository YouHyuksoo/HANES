/**
 * @file src/pages/shipping/index.ts
 * @description 출하관리 페이지 배럴 파일
 *
 * 사용 예시:
 * import { PackPage, PalletPage, ShipmentPage } from '@/pages/shipping';
 *
 * 포함된 페이지:
 * - PackPage: 포장관리 (박스 단위 포장)
 * - PalletPage: 팔레트적재 (박스를 팔레트에 적재)
 * - ShipmentPage: 출하확정 (팔레트를 출하로 확정)
 */

export { default as PackPage } from './PackPage';
export { default as PalletPage } from './PalletPage';
export { default as ShipmentPage } from './ShipmentPage';
