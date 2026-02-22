/**
 * @file stores/sysConfigStore.ts
 * @description 시스템 환경설정 전역 스토어 (Zustand)
 *
 * 초보자 가이드:
 * 1. configMap: 설정키 → 설정값 맵 (e.g. {'FIFO_ENABLED': 'Y'})
 * 2. fetchConfigs: 앱 로딩 시 API 호출하여 설정 로드
 * 3. getConfig: 특정 키의 값 조회
 * 4. isEnabled: BOOLEAN 타입 설정의 활성 여부 조회
 * 5. 모든 페이지에서 useSysConfigStore()로 접근 가능
 */
import { create } from 'zustand';
import { api } from '@/services/api';

export interface SysConfigItem {
  id: string;
  configGroup: string;
  configKey: string;
  configValue: string;
  configType: string;
  label: string;
  description: string | null;
  options: string | null;
  sortOrder: number;
  isActive: string;
}

interface SysConfigState {
  configs: SysConfigItem[];
  configMap: Record<string, string>;
  isLoaded: boolean;
  isLoading: boolean;
  fetchConfigs: () => Promise<void>;
  getConfig: (key: string) => string | null;
  isEnabled: (key: string) => boolean;
  getNumberConfig: (key: string, defaultValue?: number) => number;
}

export const useSysConfigStore = create<SysConfigState>((set, get) => ({
  configs: [],
  configMap: {},
  isLoaded: false,
  isLoading: false,

  fetchConfigs: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await api.get('/system/configs/active');
      const result = res.data?.data ?? res.data;
      const configs = result?.data ?? [];
      const configMap = result?.map ?? {};
      set({ configs, configMap, isLoaded: true });
    } catch (err) {
      console.warn('[SysConfig] 환경설정 로드 실패:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  getConfig: (key: string) => get().configMap[key] ?? null,

  isEnabled: (key: string) => get().configMap[key] === 'Y',

  getNumberConfig: (key: string, defaultValue = 0) => {
    const val = get().configMap[key];
    if (val === null || val === undefined) return defaultValue;
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  },
}));
