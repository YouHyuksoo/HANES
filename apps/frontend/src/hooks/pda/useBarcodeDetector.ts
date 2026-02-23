/**
 * @file src/hooks/pda/useBarcodeDetector.ts
 * @description 하드웨어 바코드 스캐너 감지 훅 (Layer 1)
 *
 * 초보자 가이드:
 * 1. Zebra TC21 같은 하드웨어 스캐너는 keypress 이벤트로 바코드 전송
 * 2. 연속 keypress 간격 < scanDelay(80ms) = 하드웨어 스캔
 * 3. Enter 키 = 스캔 완료 → onScan 콜백 호출
 * 4. 수동 입력은 간격이 느려서 자동 구분됨
 */
import { useEffect, useRef, useCallback } from "react";
import { usePdaStore } from "@/stores/pdaStore";

interface UseBarcodeDetectorOptions {
  /** 스캔 완료 시 호출 (바코드 값) */
  onScan: (barcode: string) => void;
  /** 활성화 여부 (기본 true) */
  enabled?: boolean;
  /** 최소 바코드 길이 (기본 3자) */
  minLength?: number;
}

interface UseBarcodeDetectorReturn {
  /** 현재 버퍼에 쌓인 값 */
  buffer: string;
  /** 버퍼 초기화 */
  clearBuffer: () => void;
}

/**
 * 하드웨어 바코드 스캐너 감지 훅
 *
 * 동작 원리:
 * 1. window keydown 이벤트 리스닝
 * 2. 연속 키 입력 간격이 scanDelay(80ms) 이내면 버퍼에 축적
 * 3. Enter 키 입력 시 → 버퍼 값으로 onScan 호출
 * 4. scanDelay 초과 시 → 새 입력으로 초기화
 */
export function useBarcodeDetector({
  onScan,
  enabled = true,
  minLength = 3,
}: UseBarcodeDetectorOptions): UseBarcodeDetectorReturn {
  const scanDelay = usePdaStore((s) => s.scanDelay);
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearBuffer = useCallback(() => {
    bufferRef.current = "";
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      // Enter 키 → 스캔 완료
      if (e.key === "Enter") {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);

        const barcode = bufferRef.current.trim();
        if (barcode.length >= minLength) {
          onScan(barcode);
        }
        bufferRef.current = "";
        lastKeyTimeRef.current = 0;
        return;
      }

      // 특수키, 조합키 무시
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      // 딜레이 초과 → 새 입력 시작
      if (timeDiff > scanDelay && lastKeyTimeRef.current !== 0) {
        bufferRef.current = "";
      }

      bufferRef.current += e.key;
      lastKeyTimeRef.current = now;

      // 타이머 리셋: scanDelay * 3 이상 입력 없으면 버퍼 자동 클리어
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = "";
        lastKeyTimeRef.current = 0;
      }, scanDelay * 3);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, scanDelay, minLength, onScan]);

  return {
    buffer: bufferRef.current,
    clearBuffer,
  };
}
