/**
 * @file src/stores/pdaStore.ts
 * @description PDA 전용 상태 관리 스토어 - 스캔 설정, 사운드 등
 *
 * 초보자 가이드:
 * 1. **scanDelay**: 하드웨어 스캐너 감지 딜레이 (ms, 기본 80ms)
 * 2. **soundEnabled**: 스캔 성공/실패 사운드 피드백 ON/OFF
 * 3. **keyboardVisible**: 가상 키보드 표시 여부
 * 4. **lastScanTime**: 마지막 스캔 시각 (중복 방지)
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PdaState {
  /** 바코드 스캔 감지 딜레이 (ms) - 80ms 이내 연속 keypress = 하드웨어 스캔 */
  scanDelay: number;
  /** 스캔 사운드 피드백 활성화 */
  soundEnabled: boolean;
  /** 가상 키보드 표시 여부 (PDA에서 기본 숨김) */
  keyboardVisible: boolean;
  /** 마지막 스캔 시각 (중복 스캔 방지) */
  lastScanTime: number;

  setScanDelay: (delay: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setKeyboardVisible: (visible: boolean) => void;
  toggleKeyboard: () => void;
  setLastScanTime: (time: number) => void;
}

export const usePdaStore = create<PdaState>()(
  persist(
    (set) => ({
      scanDelay: 80,
      soundEnabled: true,
      keyboardVisible: false,
      lastScanTime: 0,

      setScanDelay: (delay) => set({ scanDelay: delay }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setKeyboardVisible: (visible) => set({ keyboardVisible: visible }),
      toggleKeyboard: () =>
        set((state) => ({ keyboardVisible: !state.keyboardVisible })),
      setLastScanTime: (time) => set({ lastScanTime: time }),
    }),
    {
      name: "harness-pda",
      partialize: (state) => ({
        scanDelay: state.scanDelay,
        soundEnabled: state.soundEnabled,
      }),
    },
  ),
);
