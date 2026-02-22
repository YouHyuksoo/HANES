/**
 * @file src/stores/serialStore.ts
 * @description 글로벌 시리얼(바코드 스캐너) 연결 상태 관리
 *
 * 초보자 가이드:
 * 1. 앱 전체에서 단 하나의 시리얼 연결을 유지 (페이지 이동해도 끊기지 않음)
 * 2. connect() → 브라우저 포트 선택 다이얼로그 → 수신 루프 시작
 * 3. onScan(callback) → 바코드 스캔 이벤트 구독 (구독 해제 함수 반환)
 * 4. disconnect() → 수신 루프 중지 → 포트 닫기
 */
import { create } from "zustand";

/** 스캔 이벤트 리스너 타입 */
type ScanListener = (data: string) => void;

interface SerialState {
  /** 연결 여부 */
  connected: boolean;
  /** 연결된 포트 정보 */
  portInfo: { vendorId?: number; productId?: number } | null;
  /** 마지막 스캔 데이터 */
  lastScanned: string | null;
  /** 에러 메시지 */
  error: string | null;

  /** 포트 연결 (baudRate 지정 가능, 기본 9600) */
  connect: (baudRate?: number) => Promise<void>;
  /** 이전 승인 포트가 있으면 자동 연결 (다이얼로그 없이) */
  autoConnect: (baudRate?: number) => Promise<void>;
  /** 연결 해제 */
  disconnect: () => Promise<void>;
  /** 스캔 이벤트 구독 — 구독 해제 함수 반환 */
  onScan: (callback: ScanListener) => () => void;
  /** 에러 초기화 */
  clearError: () => void;
}

/* ── 내부 상태 (Zustand 외부, subscribe 불필요) ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _port: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _reader: any = null;
let _reading = false;
let _scanBuffer = "";
let _scanTimer: ReturnType<typeof setTimeout> | undefined;
const _listeners = new Set<ScanListener>();

/** 수신 루프 — 포트에서 데이터를 계속 읽으며 리스너에 브로드캐스트 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readLoop(port: any, set: (partial: Partial<SerialState>) => void) {
  while (port.readable && _reading) {
    const reader = port.readable.getReader();
    _reader = reader;
    try {
      while (_reading) {
        const { value, done } = await reader.read();
        if (done || !value) break;

        const bytes = value as Uint8Array;
        const ascii = Array.from(bytes)
          .map((b: number) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ""))
          .join("");

        if (!ascii) continue;

        /* 바코드 버퍼링: 150ms 내에 추가 데이터가 없으면 완성된 스캔으로 간주 */
        _scanBuffer += ascii;
        if (_scanTimer) clearTimeout(_scanTimer);
        _scanTimer = setTimeout(() => {
          const scanned = _scanBuffer.trim();
          if (scanned) {
            set({ lastScanned: scanned });

            /* 포커스된 input/textarea가 있으면 거기에 값 입력 */
            const el = document.activeElement;
            if (
              el instanceof HTMLInputElement &&
              !el.disabled &&
              !el.readOnly &&
              ["text", "search", "url", "tel", "password", "number", ""].includes(el.type)
            ) {
              /* React 상태 동기화를 위해 네이티브 input 이벤트 트리거 */
              const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
              nativeSet?.call(el, scanned);
              el.dispatchEvent(new Event("input", { bubbles: true }));
            } else if (
              el instanceof HTMLTextAreaElement &&
              !el.disabled &&
              !el.readOnly
            ) {
              const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
              nativeSet?.call(el, scanned);
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }

            /* 리스너에도 브로드캐스트 (추가 처리가 필요한 경우) */
            _listeners.forEach((fn) => fn(scanned));
          }
          _scanBuffer = "";
        }, 150);
      }
    } catch {
      /* reader cancelled — 정상 종료 */
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
      _reader = null;
    }
  }
}

export const useSerialStore = create<SerialState>()((set, get) => ({
  connected: false,
  portInfo: null,
  lastScanned: null,
  error: null,

  connect: async (baudRate = 9600) => {
    /* 이미 연결 중이면 무시 */
    if (get().connected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    if (!serial) {
      set({ error: "Web Serial API를 지원하지 않는 브라우저입니다. Chrome/Edge를 사용하세요." });
      return;
    }

    const openOptions = {
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
    };

    try {
      /* 이전 승인 포트가 하나면 자동 연결, 아니면 선택 다이얼로그 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grantedPorts: any[] = await serial.getPorts();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let port: any;

      if (grantedPorts.length === 1) {
        port = grantedPorts[0];
      } else {
        port = await serial.requestPort();
      }

      await port.open(openOptions);

      _port = port;
      const info = port.getInfo?.() ?? {};
      set({
        connected: true,
        portInfo: { vendorId: info.usbVendorId, productId: info.usbProductId },
        error: null,
      });

      /* disconnect 이벤트 감지 */
      port.addEventListener?.("disconnect", () => {
        _reading = false;
        _port = null;
        set({ connected: false, portInfo: null });
      });

      /* 수신 루프 시작 */
      _reading = true;
      readLoop(port, set);
    } catch (err: any) {
      if (err.name === "NotFoundError") return; // 사용자가 취소
      set({ error: err.message || "연결 실패" });
    }
  },

  autoConnect: async (baudRate = 9600) => {
    if (get().connected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    if (!serial) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grantedPorts: any[] = await serial.getPorts();
      /* 이전 승인 포트가 정확히 1개일 때만 자동 연결 */
      if (grantedPorts.length !== 1) return;

      const port = grantedPorts[0];
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      _port = port;
      const info = port.getInfo?.() ?? {};
      set({
        connected: true,
        portInfo: { vendorId: info.usbVendorId, productId: info.usbProductId },
        error: null,
      });

      port.addEventListener?.("disconnect", () => {
        _reading = false;
        _port = null;
        set({ connected: false, portInfo: null });
      });

      _reading = true;
      readLoop(port, set);
    } catch {
      /* 자동 연결 실패는 조용히 무시 (사용자가 수동으로 연결 가능) */
    }
  },

  disconnect: async () => {
    _reading = false;

    if (_reader) {
      try { await _reader.cancel(); } catch { /* noop */ }
      try { _reader.releaseLock(); } catch { /* noop */ }
      _reader = null;
    }

    if (_port) {
      try { await _port.close(); } catch { /* noop */ }
      _port = null;
    }

    set({ connected: false, portInfo: null });
  },

  onScan: (callback: ScanListener) => {
    _listeners.add(callback);
    return () => {
      _listeners.delete(callback);
    };
  },

  clearError: () => set({ error: null }),
}));
