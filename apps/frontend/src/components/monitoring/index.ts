/**
 * @file src/components/monitoring/index.ts
 * @description 모니터링(사이니지) 화면 공통 컴포넌트 배럴
 */
export { default as MonitoringFrame } from "./MonitoringFrame";
export { default as BoardChrome } from "./BoardChrome";
export { default as BoardStat } from "./BoardStat";
export { default as BoardClock } from "./BoardClock";
export { useRotation, RotationIndicator } from "./useRotation";
export { default as MonitoringSettingsModal } from "./MonitoringSettingsModal";
export type { MonitoringTargetOption } from "./MonitoringSettingsModal";
export { useMonitoringConfig, DEFAULT_MONITORING_CONFIG } from "./useMonitoringConfig";
export type { MonitoringConfig } from "./useMonitoringConfig";
