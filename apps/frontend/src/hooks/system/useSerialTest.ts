/**
 * @file src/hooks/system/useSerialTest.ts
 * @description Web Serial API를 이용한 시리얼 통신 테스트 훅
 *
 * 초보자 가이드:
 * 1. **connect**: 브라우저 포트 선택 다이얼로그 → 포트 열기 → 수신 루프 시작
 * 2. **send**: HEX 문자열을 바이트로 변환하여 포트에 전송
 * 3. **disconnect**: 수신 루프 중지 → 포트 닫기
 * 4. Chrome/Edge 전용 (Web Serial API 필요)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { CommConfig } from "./useCommConfigData";

/** 로그 한 줄 */
export interface SerialLogEntry {
  id: number;
  timestamp: string;
  direction: "RX" | "TX" | "SYS";
  hex: string;
  ascii: string;
  bytes: number;
}

let logId = 0;

export interface UseSerialTestOptions {
  /** 데이터 수신 시 콜백 (ASCII 텍스트) */
  onData?: (ascii: string) => void;
}

export function useSerialTest(config: CommConfig | null, options?: UseSerialTestOptions) {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<SerialLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const readingRef = useRef(false);
  const mountedRef = useRef(true);
  const onDataRef = useRef(options?.onData);
  onDataRef.current = options?.onData;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 로그 추가 헬퍼 */
  const addLog = useCallback(
    (entry: Omit<SerialLogEntry, "id" | "timestamp">) => {
      if (!mountedRef.current) return;
      setLogs((prev) => [
        ...prev,
        { ...entry, id: ++logId, timestamp: new Date().toISOString() },
      ]);
    },
    [],
  );

  /** Buffer → HEX 문자열 + ASCII 변환 */
  const formatData = (arr: Uint8Array) => {
    const hex = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
    const ascii = Array.from(arr)
      .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
      .join("");
    return { hex, ascii };
  };

  /** 수신 루프 (연결 해제까지 무한 읽기) */
  const readLoop = useCallback(
    async (port: any) => {
      while (port.readable && readingRef.current) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          while (readingRef.current) {
            const { value, done } = await reader.read();
            if (done || !value || !mountedRef.current) break;
            const { hex, ascii } = formatData(value as Uint8Array);
            addLog({
              direction: "RX",
              hex,
              ascii,
              bytes: (value as Uint8Array).length,
            });
            onDataRef.current?.(ascii);
          }
        } catch {
          /* reader cancelled */
        } finally {
          try {
            reader.releaseLock();
          } catch {}
          readerRef.current = null;
        }
      }
    },
    [addLog],
  );

  /** 포트 연결 (이전 승인 포트가 있으면 다이얼로그 없이 바로 연결) */
  const connect = useCallback(async () => {
    if (!config) return;
    setError(null);

    const serial = (navigator as any).serial;
    if (!serial) {
      setError(
        "Web Serial API 미지원 브라우저입니다. Chrome/Edge를 사용하세요.",
      );
      return;
    }

    const openOptions = {
      baudRate: config.baudRate || 9600,
      dataBits: config.dataBits || 8,
      stopBits: config.stopBits === "2" ? 2 : 1,
      parity:
        config.parity?.toLowerCase() === "even" ||
        config.parity?.toLowerCase() === "odd"
          ? config.parity.toLowerCase()
          : "none",
      flowControl: config.flowControl === "RTSCTS" ? "hardware" : "none",
    };

    try {
      /* 이전에 승인한 포트가 있으면 다이얼로그 스킵 */
      const grantedPorts: any[] = await serial.getPorts();
      let port: any;

      if (grantedPorts.length === 1) {
        port = grantedPorts[0];
      } else {
        port = await serial.requestPort();
      }

      await port.open(openOptions);

      portRef.current = port;
      if (mountedRef.current) setConnected(true);
      addLog({
        direction: "SYS",
        hex: "",
        ascii: `연결됨 (${config.baudRate || 9600}bps)`,
        bytes: 0,
      });

      readingRef.current = true;
      readLoop(port);
    } catch (err: any) {
      if (err.name === "NotFoundError") return;
      if (mountedRef.current) setError(err.message || "연결 실패");
    }
  }, [config, addLog, readLoop]);

  /** 데이터 전송 (HEX 문자열) */
  const sendHex = useCallback(
    async (hexStr: string) => {
      if (!portRef.current?.writable) {
        setError("포트가 연결되지 않았습니다.");
        return;
      }

      const raw = hexStr.replace(/\s+/g, "");
      if (!raw || raw.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
        setError("유효한 HEX 데이터를 입력하세요. (예: 01 03 00 00 00 01)");
        return;
      }

      try {
        const bytes = new Uint8Array(
          raw.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
        );
        const writer = portRef.current.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();

        const { hex, ascii } = formatData(bytes);
        addLog({ direction: "TX", hex, ascii, bytes: bytes.length });
        setError(null);
      } catch (err: any) {
        setError(err.message || "전송 실패");
      }
    },
    [addLog],
  );

  /** 데이터 전송 (ASCII 텍스트) */
  const sendAscii = useCallback(
    async (text: string) => {
      if (!portRef.current?.writable) {
        setError("포트가 연결되지 않았습니다.");
        return;
      }

      if (!text) {
        setError("전송할 텍스트를 입력하세요.");
        return;
      }

      try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        const writer = portRef.current.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();

        const { hex, ascii } = formatData(bytes);
        addLog({ direction: "TX", hex, ascii, bytes: bytes.length });
        setError(null);
      } catch (err: any) {
        setError(err.message || "전송 실패");
      }
    },
    [addLog],
  );

  /** 연결 해제 */
  const disconnect = useCallback(async () => {
    readingRef.current = false;

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch {}
      try {
        readerRef.current.releaseLock();
      } catch {}
      readerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {}
      portRef.current = null;
    }

    if (mountedRef.current) {
      setConnected(false);
      addLog({
        direction: "SYS",
        hex: "",
        ascii: "연결 해제됨",
        bytes: 0,
      });
    }
  }, [addLog]);

  const clearLogs = useCallback(() => setLogs([]), []);

  /** 언마운트 시 정리 */
  useEffect(() => {
    return () => {
      readingRef.current = false;
      try {
        readerRef.current?.cancel();
      } catch {}
      try {
        portRef.current?.close();
      } catch {}
    };
  }, []);

  return { connected, logs, error, connect, sendHex, sendAscii, disconnect, clearLogs };
}
