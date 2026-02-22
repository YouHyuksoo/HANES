/**
 * @file src/stores/serialStore.ts
 * @description 글로벌 시리얼(바코드 스캐너) 연결 상태 관리
 *
 * 초보자 가이드:
 * 1. 앱 전체에서 단 하나의 시리얼 연결을 유지 (페이지 이동해도 끊기지 않음)
 * 2. fetchConfigs() → DB에서 SERIAL 설정 목록 로드
 * 3. setSelectedConfig(id) → PC별 설정 선택 (localStorage에 저장)
 * 4. connect() → 선택된 설정의 프로토콜로 포트 연결
 * 5. 스캔 데이터는 포커스된 input/textarea에 자동 입력
 */
import { create } from "zustand";
import api from "@/services/api";

const LS_KEY = "hanes_serial_config_id";

/** 스캔 이벤트 리스너 타입 */
type ScanListener = (data: string) => void;

/** DB에서 가져온 SERIAL 설정 요약 */
export interface SerialConfig {
  id: string;
  configName: string;
  baudRate: number;
  dataBits: number;
  stopBits: string;
  parity: string;
  flowControl: string;
}

/** 실제 포트에 적용할 프로토콜 */
interface SerialProtocol {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  flowControl: string;
}

interface SerialState {
  /** 연결 여부 */
  connected: boolean;
  /** 연결된 포트 정보 */
  portInfo: { vendorId?: number; productId?: number } | null;
  /** 마지막 스캔 데이터 */
  lastScanned: string | null;
  /** 에러 메시지 */
  error: string | null;
  /** 현재 적용된 프로토콜 설정 */
  protocol: SerialProtocol | null;
  /** DB에서 로드한 SERIAL 설정 목록 */
  configs: SerialConfig[];
  /** 현재 PC에서 선택된 설정 ID (localStorage 연동) */
  selectedConfigId: string | null;

  /** DB에서 SERIAL 설정 목록 로드 */
  fetchConfigs: () => Promise<void>;
  /** 설정 선택 (localStorage에 저장) */
  setSelectedConfig: (configId: string) => void;
  /** 포트 연결 (선택된 설정 사용) */
  connect: () => Promise<void>;
  /** 이전 승인 포트가 있으면 자동 연결 (다이얼로그 없이) */
  autoConnect: () => Promise<void>;
  /** 연결 해제 */
  disconnect: () => Promise<void>;
  /** 연결 해제 후 재접속 */
  reconnect: () => Promise<void>;
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

/** 기본 프로토콜 (설정이 없을 때) */
const DEFAULTS: SerialProtocol = {
  baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none",
};

/** SerialConfig → SerialProtocol 변환 */
function configToProtocol(cfg: SerialConfig): SerialProtocol {
  return {
    baudRate: cfg.baudRate || DEFAULTS.baudRate,
    dataBits: cfg.dataBits || DEFAULTS.dataBits,
    stopBits: cfg.stopBits === "2" ? 2 : cfg.stopBits === "1.5" ? 1 : 1,
    parity: ["even", "odd"].includes(cfg.parity?.toLowerCase()) ? cfg.parity.toLowerCase() : "none",
    flowControl: cfg.flowControl === "RTSCTS" ? "hardware" : "none",
  };
}

/** 포트 열기 공통 로직 (이미 열린 포트도 처리) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openPort(port: any, protocol: SerialProtocol, set: (partial: Partial<SerialState>) => void) {
  /* 기존 reader/port 내부 상태 정리 (HMR 등으로 모듈이 다시 로드된 경우 대비) */
  if (_reader) {
    try { await _reader.cancel(); } catch { /* noop */ }
    try { _reader.releaseLock(); } catch { /* noop */ }
    _reader = null;
  }
  _reading = false;

  /* HMR/리로드 후 브라우저가 포트를 유지하는 경우 port.readable이 이미 존재 */
  if (!port.readable) {
    await port.open({
      baudRate: protocol.baudRate,
      dataBits: protocol.dataBits,
      stopBits: protocol.stopBits,
      parity: protocol.parity,
      flowControl: protocol.flowControl,
    });
  }

  _port = port;
  const info = port.getInfo?.() ?? {};
  set({
    connected: true,
    portInfo: { vendorId: info.usbVendorId, productId: info.usbProductId },
    protocol,
    error: null,
  });

  port.addEventListener?.("disconnect", () => {
    _reading = false;
    _port = null;
    set({ connected: false, portInfo: null });
  });

  _reading = true;
  readLoop(port, set);
}

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

/** 연결 해제 내부 로직 */
async function doDisconnect(set: (partial: Partial<SerialState>) => void) {
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
}

/** localStorage에서 저장된 configId 읽기 */
function getSavedConfigId(): string | null {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}

export const useSerialStore = create<SerialState>()((set, get) => ({
  connected: false,
  portInfo: null,
  lastScanned: null,
  error: null,
  protocol: null,
  configs: [],
  selectedConfigId: getSavedConfigId(),

  fetchConfigs: async () => {
    try {
      const res = await api.get("/system/comm-configs", { params: { commType: "SERIAL", useYn: "Y" } });
      const list = res.data?.data ?? res.data ?? [];
      const configs: SerialConfig[] = (Array.isArray(list) ? list : []).map((c: any) => ({
        id: c.id,
        configName: c.configName,
        baudRate: c.baudRate || 9600,
        dataBits: c.dataBits || 8,
        stopBits: c.stopBits || "1",
        parity: c.parity || "NONE",
        flowControl: c.flowControl || "NONE",
      }));
      set({ configs });

      /* 저장된 configId가 목록에 없으면 첫 번째 항목으로 폴백 */
      const saved = get().selectedConfigId;
      if (configs.length > 0 && (!saved || !configs.find((c) => c.id === saved))) {
        const fallbackId = configs[0].id;
        set({ selectedConfigId: fallbackId });
        try { localStorage.setItem(LS_KEY, fallbackId); } catch { /* noop */ }
      }
    } catch {
      /* 설정 로드 실패는 무시 — 기본값으로 동작 */
    }
  },

  setSelectedConfig: (configId: string) => {
    set({ selectedConfigId: configId });
    try { localStorage.setItem(LS_KEY, configId); } catch { /* noop */ }
  },

  connect: async () => {
    if (get().connected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    if (!serial) {
      set({ error: "Web Serial API를 지원하지 않는 브라우저입니다. Chrome/Edge를 사용하세요." });
      return;
    }

    try {
      /* 선택된 설정에서 프로토콜 결정 */
      const { configs, selectedConfigId } = get();
      const cfg = configs.find((c) => c.id === selectedConfigId);
      const protocol = cfg ? configToProtocol(cfg) : DEFAULTS;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grantedPorts: any[] = await serial.getPorts();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let port: any;

      if (grantedPorts.length === 1) {
        port = grantedPorts[0];
      } else {
        port = await serial.requestPort();
      }

      await openPort(port, protocol, set);
    } catch (err: any) {
      if (err.name === "NotFoundError") return;
      set({ error: err.message || "연결 실패" });
    }
  },

  autoConnect: async () => {
    if (get().connected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    if (!serial) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grantedPorts: any[] = await serial.getPorts();
      if (grantedPorts.length !== 1) return;

      /* 설정 목록이 아직 로드 안 됐으면 먼저 로드 */
      if (get().configs.length === 0) {
        await get().fetchConfigs();
      }

      const { configs, selectedConfigId } = get();
      const cfg = configs.find((c) => c.id === selectedConfigId);
      const protocol = cfg ? configToProtocol(cfg) : DEFAULTS;

      await openPort(grantedPorts[0], protocol, set);
    } catch {
      /* 자동 연결 실패는 조용히 무시 */
    }
  },

  disconnect: async () => {
    await doDisconnect(set);
  },

  reconnect: async () => {
    await doDisconnect(set);
    /* 약간의 딜레이 후 재연결 (포트 해제 완료 대기) */
    await new Promise((r) => setTimeout(r, 300));
    await get().connect();
  },

  onScan: (callback: ScanListener) => {
    _listeners.add(callback);
    return () => { _listeners.delete(callback); };
  },

  clearError: () => set({ error: null }),
}));
