'use client';

/**
 * @file src/hooks/useZebraPrinter.ts
 * @description Zebra Browser Print 에이전트 연동 Hook
 *
 * 초보자 가이드:
 * 1. Zebra Browser Print는 로컬 PC에 설치되는 에이전트 프로그램
 * 2. 에이전트는 localhost:9100에서 HTTP API를 제공
 * 3. USB/네트워크 연결된 Zebra 프린터를 자동 감지하고 ZPL 데이터를 전송
 * 4. 에이전트 미설치 시 isAgentAvailable = false
 * 5. 사용법:
 *    const { isAgentAvailable, printers, sendZpl } = useZebraPrinter();
 *    await sendZpl('^XA^FO50,50^ADN,36,20^FDHello^FS^XZ');
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/** Zebra Browser Print 에이전트 로컬 주소 */
const AGENT_URL = 'http://localhost:9100';

/** 에이전트 요청 타임아웃 (ms) */
const FETCH_TIMEOUT = 3000;

/** Zebra 프린터 디바이스 정보 */
export interface ZebraPrinter {
  /** 프린터 표시 이름 */
  name: string;
  /** 프린터 고유 식별자 */
  uid: string;
  /** 연결 방식: usb 또는 network */
  connection: string;
  /** 디바이스 유형 */
  deviceType: string;
}

/** useZebraPrinter 훅 반환 타입 */
export interface UseZebraPrinterReturn {
  /** 에이전트 실행 여부 */
  isAgentAvailable: boolean;
  /** 감지된 프린터 목록 */
  printers: ZebraPrinter[];
  /** 현재 선택된 프린터 */
  selectedPrinter: ZebraPrinter | null;
  /** 프린터 선택 핸들러 */
  setSelectedPrinter: (printer: ZebraPrinter | null) => void;
  /** ZPL 데이터를 선택된 프린터로 전송 */
  sendZpl: (zplData: string) => Promise<boolean>;
  /** 에이전트 상태 및 프린터 목록 갱신 */
  checkStatus: () => Promise<void>;
  /** 오류 메시지 (없으면 null) */
  error: string | null;
}

/**
 * 타임아웃이 적용된 fetch wrapper
 * 에이전트 미설치 시 빠르게 실패하도록 timeout 설정
 */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 응답 데이터에서 프린터 객체 파싱
 */
function parsePrinter(data: Record<string, unknown>): ZebraPrinter {
  return {
    name: String(data.name ?? ''),
    uid: String(data.uid ?? data.name ?? ''),
    connection: String(data.connection ?? 'usb'),
    deviceType: String(data.deviceType ?? 'printer'),
  };
}

/** Zebra Browser Print 에이전트 연동 훅 */
export function useZebraPrinter(): UseZebraPrinterReturn {
  const [isAgentAvailable, setIsAgentAvailable] = useState(false);
  const [printers, setPrinters] = useState<ZebraPrinter[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<ZebraPrinter | null>(null);
  const [error, setError] = useState<string | null>(null);

  // selectedPrinter를 ref로 추적 (checkStatus의 useCallback 의존성 방지)
  const selectedPrinterRef = useRef(selectedPrinter);
  selectedPrinterRef.current = selectedPrinter;

  /** 에이전트 상태 확인 및 프린터 목록 조회 */
  const checkStatus = useCallback(async () => {
    try {
      setError(null);

      // 1) 에이전트 가용성 확인
      const availableRes = await fetchWithTimeout(`${AGENT_URL}/available`);
      if (!availableRes.ok) {
        setIsAgentAvailable(false);
        setPrinters([]);
        return;
      }
      setIsAgentAvailable(true);

      // 2) 기본 프린터 조회
      const defaultRes = await fetchWithTimeout(`${AGENT_URL}/default?type=printer`);
      const defaultData = await defaultRes.json();

      // 3) 전체 프린터 목록 조회
      const printersRes = await fetchWithTimeout(`${AGENT_URL}/available?type=printer`);
      const printersData = await printersRes.json();

      // 4) 프린터 목록 구성 (기본 프린터 우선, 중복 제거)
      const printerList: ZebraPrinter[] = [];

      if (defaultData?.name) {
        printerList.push(parsePrinter(defaultData));
      }

      if (Array.isArray(printersData)) {
        for (const p of printersData) {
          const uid = String(p.uid ?? p.name ?? '');
          if (uid && !printerList.some((existing) => existing.uid === uid)) {
            printerList.push(parsePrinter(p));
          }
        }
      }

      setPrinters(printerList);

      // 5) 선택된 프린터가 없으면 첫 번째 자동 선택
      if (!selectedPrinterRef.current && printerList.length > 0) {
        setSelectedPrinter(printerList[0]);
      }
    } catch {
      // 에이전트 미설치 또는 미실행
      setIsAgentAvailable(false);
      setPrinters([]);
    }
  }, []);

  /** ZPL 데이터를 선택된 프린터로 전송 */
  const sendZpl = useCallback(
    async (zplData: string): Promise<boolean> => {
      if (!selectedPrinter) {
        setError('프린터를 선택해주세요.');
        return false;
      }

      try {
        setError(null);

        const response = await fetchWithTimeout(`${AGENT_URL}/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            device: { name: selectedPrinter.name, uid: selectedPrinter.uid },
            data: zplData,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          setError(`프린터 전송 실패: ${errText}`);
          return false;
        }

        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '프린터 전송 중 오류 발생';
        setError(msg);
        return false;
      }
    },
    [selectedPrinter],
  );

  // 마운트 시 에이전트 상태 확인
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isAgentAvailable,
    printers,
    selectedPrinter,
    setSelectedPrinter,
    sendZpl,
    checkStatus,
    error,
  };
}
