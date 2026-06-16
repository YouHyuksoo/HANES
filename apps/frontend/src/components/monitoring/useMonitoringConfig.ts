"use client";

/**
 * @file src/components/monitoring/useMonitoringConfig.ts
 * @description 모니터링 화면 설정(선택 대상·인터벌·그리드)을 localStorage 에 영속화하는 훅
 *
 * 초보자 가이드:
 * - selectedCodes: 모니터링할 대상 코드 목록. 빈 배열이면 "전체"로 간주한다.
 * - refetchSec: 데이터 재조회 주기(초). rollingSec: 페이지 자동 전환 주기(초).
 * - columns/rows: 한 페이지에 보일 그리드(열×행 = 페이지당 개수).
 */
import { useState, useEffect, useCallback } from "react";

export interface MonitoringConfig {
  /** 선택된 대상 코드. 빈 배열 = 전체 */
  selectedCodes: string[];
  refetchSec: number;
  rollingSec: number;
  columns: number;
  rows: number;
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  selectedCodes: [],
  refetchSec: 30,
  rollingSec: 8,
  columns: 5,
  rows: 4,
};

export function useMonitoringConfig(storageKey: string) {
  const [config, setConfigState] = useState<MonitoringConfig>(DEFAULT_MONITORING_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MonitoringConfig>;
        setConfigState({ ...DEFAULT_MONITORING_CONFIG, ...parsed });
      }
    } catch {
      // 손상된 값은 기본값으로 무시
    }
    setLoaded(true);
  }, [storageKey]);

  const setConfig = useCallback((cfg: MonitoringConfig) => {
    setConfigState(cfg);
    try {
      localStorage.setItem(storageKey, JSON.stringify(cfg));
    } catch {
      // 저장 실패는 무시(시크릿 모드 등)
    }
  }, [storageKey]);

  return { config, setConfig, loaded };
}
