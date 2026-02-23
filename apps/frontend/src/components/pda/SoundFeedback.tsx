"use client";

/**
 * @file src/components/pda/SoundFeedback.tsx
 * @description PDA 사운드 피드백 훅 - 스캔 성공/실패 시 소리 재생
 *
 * 초보자 가이드:
 * 1. **playSuccess**: 스캔 성공 시 사운드 재생
 * 2. **playError**: 스캔 실패 시 사운드 재생
 * 3. pdaStore.soundEnabled가 false면 소리 안 남
 * 4. public/sounds/ 폴더에 WAV 파일 필요
 */
import { useCallback, useRef } from "react";
import { usePdaStore } from "@/stores/pdaStore";

interface UseSoundFeedbackReturn {
  playSuccess: () => void;
  playError: () => void;
}

/**
 * PDA 사운드 피드백 훅
 *
 * 사용법:
 * ```tsx
 * const { playSuccess, playError } = useSoundFeedback();
 * // 스캔 성공 시
 * playSuccess();
 * // 스캔 실패 시
 * playError();
 * ```
 */
export function useSoundFeedback(): UseSoundFeedbackReturn {
  const soundEnabled = usePdaStore((s) => s.soundEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(
    (src: string) => {
      if (!soundEnabled) return;
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.play().catch(() => {
          // 사용자 인터랙션 없이는 autoplay 차단됨 - 무시
        });
      } catch {
        // Audio API 미지원 환경 무시
      }
    },
    [soundEnabled],
  );

  const playSuccess = useCallback(() => {
    play("/sounds/success.wav");
  }, [play]);

  const playError = useCallback(() => {
    play("/sounds/error.wav");
  }, [play]);

  return { playSuccess, playError };
}
