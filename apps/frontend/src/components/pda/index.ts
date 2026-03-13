/**
 * @file src/components/pda/index.ts
 * @description PDA 컴포넌트 배럴 파일
 *
 * 사용 예시:
 * import { PdaHeader, PdaMenuGrid, ScanInput } from '@/components/pda';
 */

export { default as NetworkStatusBanner } from "./NetworkStatusBanner";
export { default as PdaAuthGuard } from "./PdaAuthGuard";
export { default as PdaHeader } from "./PdaHeader";
export { default as PdaLayout } from "./PdaLayout";
export { default as PdaMenuGrid } from "./PdaMenuGrid";
export { default as ScanInput } from "./ScanInput";
export { default as ScanResultCard } from "./ScanResultCard";
export { default as ScanHistoryList } from "./ScanHistoryList";
export { default as PdaActionButton } from "./PdaActionButton";
export { default as BomCheckList } from "./BomCheckList";
export type { BomCheckItem } from "./BomCheckList";
export { default as ReasonCodeSelect } from "./ReasonCodeSelect";
export { useSoundFeedback } from "./SoundFeedback";
export {
  pdaMainMenuItems,
  pdaMaterialSubMenuItems,
  pdaLogoutItem,
  // deprecated aliases — 하위 호환성 유지
  mainMenuItems,
  materialSubMenuItems,
} from "./pdaMenuConfig";
export type { PdaMenuItem } from "./pdaMenuConfig";
