# 시리얼 통신 글로벌 연결 아키텍처 개선안

## 📋 개요

### 현재 문제
현재 시스템은 각 화면/컴포넌트에서 `useSerialTest` 훅을 독립적으로 사용하여 시리얼 포트를 관리하고 있습니다.

```typescript
// 현재: 각 화면에서 독립적 연결
function PageA() {
  const { connected, connect } = useSerialTest(config);
  // PageA에서 연결
}

function PageB() {
  const { connected, connect } = useSerialTest(config);
  // PageB에서 다시 연결 필요 (PageA 연결 끊김)
}
```

### 문제점
- **페이지 이동 시 연결 끊김**: A→B→C 이동 시 매번 포트 재선택
- **반복적인 사용자 액션**: 공장 환경에서 "포트 선택" 다이얼로그 반복은 비효율적
- **스캔 데이터 누락**: 페이지 이동 중 바코드 스캔 시 처리 불가
- **USB 핸드셰이크 지연**: 매 연결마다 물리적 초기화 시간 소요

---

## 🎯 개선 목표

글로벌(앱 레벨)에서 시리얼 연결을 관리하여:
1. 페이지 이동 시에도 연결 유지
2. 어디서든 바코드 스캔 데이터 수신 가능
3. 연결 상태를 한 곳에서 관리 및 표시
4. 사용자 경험(UX) 향상

---

## 📐 제안 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    App Layout (Root)                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │           SerialProvider (Context)              │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │  • portRef (전역 싱글톤)                │    │    │
│  │  │  • connected (전역 상태)                │    │    │
│  │  │  • scannedDataQueue (수신 데이터)       │    │    │
│  │  │  • connect() / disconnect()             │    │    │
│  │  │  • onScan(callback) - 구독 패턴          │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                               │
│     ┌───────────────────┼───────────────────┐           │
│     ▼                   ▼                   ▼           │
│ ┌─────────┐       ┌─────────┐       ┌─────────────┐     │
│ │ Page A  │       │ Page B  │       │ SerialBar   │     │
│ │(useSerial)│     │(useSerial)│     │ (하단 고정)  │     │
│ └─────────┘       └─────────┘       └─────────────┘     │
│     │                   │                               │
│     └───────────┬───────┘                               │
│                 ▼                                       │
│         스캔 데이터 공유                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ 구현 상세

### 1. SerialContext 생성

**파일**: `apps/frontend/src/contexts/SerialContext.tsx`

```typescript
import { 
  createContext, 
  useContext, 
  useRef, 
  useState, 
  useCallback, 
  useEffect,
  ReactNode 
} from 'react';

interface SerialContextType {
  // 상태
  connected: boolean;
  portInfo: { vendorId?: number; productId?: number } | null;
  lastScanned: string | null;
  error: string | null;
  
  // 액션
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  
  // 구독
  onScan: (callback: (data: string) => void) => () => void;
  clearLastScanned: () => void;
}

const SerialContext = createContext<SerialContextType | null>(null);

// 싱글톤 ref (앱 전역에서 1개만 존재)
const globalPortRef = { current: null as any };
const globalReaderRef = { current: null as any };

export function SerialProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [portInfo, setPortInfo] = useState<{ vendorId?: number; productId?: number } | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const readingRef = useRef(false);
  const listenersRef = useRef<Set<(data: string) => void>>(new Set());
  const scanBufferRef = useRef(''); // 바코드 버퍼링

  // 스캔 데이터 브로드캐스트
  const broadcast = useCallback((data: string) => {
    setLastScanned(data);
    listenersRef.current.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('Scan listener error:', e);
      }
    });
  }, []);

  // 데이터 구독
  const onScan = useCallback((callback: (data: string) => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  // 데이터 포맷 변환
  const formatData = (arr: Uint8Array) => {
    return Array.from(arr)
      .map(b => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ''))
      .join('');
  };

  // 수신 루프
  const readLoop = useCallback(async () => {
    const port = globalPortRef.current;
    if (!port) return;

    readingRef.current = true;

    while (port.readable && readingRef.current) {
      const reader = port.readable.getReader();
      globalReaderRef.current = reader;

      try {
        while (readingRef.current) {
          const { value, done } = await reader.read();
          if (done || !value) break;

          const text = formatData(value as Uint8Array);
          
          // 바코드 스캐너 데이터 처리 (개행 기준)
          scanBufferRef.current += text;
          const lines = scanBufferRef.current.split(/\r\n|\r|\n/);
          
          // 완성된 라인들 브로드캐스트
          while (lines.length > 1) {
            const line = lines.shift()?.trim();
            if (line) {
              broadcast(line);
            }
          }
          
          // 마지막 불완전 라인은 버퍼에 유지
          scanBufferRef.current = lines[0] || '';
        }
      } catch (err) {
        console.error('Read error:', err);
      } finally {
        try {
          reader.releaseLock();
        } catch {}
        globalReaderRef.current = null;
      }
    }
  }, [broadcast]);

  // 연결
  const connect = useCallback(async () => {
    setError(null);

    const serial = (navigator as any).serial;
    if (!serial) {
      setError('Web Serial API 미지원 브라우저입니다. Chrome/Edge를 사용하세요.');
      return;
    }

    try {
      // 이미 연결된 경우
      if (globalPortRef.current?.readable) {
        setConnected(true);
        return;
      }

      // 기존 승인 포트 확인
      const grantedPorts: any[] = await serial.getPorts();
      let port: any;

      if (grantedPorts.length === 1) {
        port = grantedPorts[0];
      } else {
        port = await serial.requestPort();
      }

      // 포트 열기 (바코드 스캐너 기본 설정)
      await port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      globalPortRef.current = port;
      setPortInfo(port.getInfo?.() || null);
      setConnected(true);

      // 수신 시작
      readLoop();
    } catch (err: any) {
      if (err.name === 'NotFoundError') return; // 사용자 취소
      setError(err.message || '연결 실패');
      setConnected(false);
    }
  }, [readLoop]);

  // 연결 해제
  const disconnect = useCallback(async () => {
    readingRef.current = false;

    // Reader 정리
    if (globalReaderRef.current) {
      try {
        await globalReaderRef.current.cancel();
      } catch {}
      try {
        globalReaderRef.current.releaseLock();
      } catch {}
      globalReaderRef.current = null;
    }

    // Port 정리
    if (globalPortRef.current) {
      try {
        await globalPortRef.current.close();
      } catch {}
      globalPortRef.current = null;
    }

    setConnected(false);
    setPortInfo(null);
    scanBufferRef.current = '';
  }, []);

  // 재연결
  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // 연결 상태 주기적 체크
  useEffect(() => {
    const interval = setInterval(() => {
      const isActuallyConnected = !!globalPortRef.current?.readable;
      if (connected !== isActuallyConnected) {
        setConnected(isActuallyConnected);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connected]);

  const value: SerialContextType = {
    connected,
    portInfo,
    lastScanned,
    error,
    connect,
    disconnect,
    reconnect,
    onScan,
    clearLastScanned: () => setLastScanned(null),
  };

  return <SerialContext.Provider value={value}>{children}</SerialContext.Provider>;
}

// 커스텀 훅
export function useSerial() {
  const context = useContext(SerialContext);
  if (!context) {
    throw new Error('useSerial must be used within SerialProvider');
  }
  return context;
}
```

---

### 2. Provider 적용

**파일**: `apps/frontend/src/app/layout.tsx`

```typescript
import { SerialProvider } from '@/contexts/SerialContext';
import { SerialStatusBar } from '@/components/layout/SerialStatusBar';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SerialProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
          {/* 전역 연결 상태 표시 */}
          <SerialStatusBar />
        </SerialProvider>
      </body>
    </html>
  );
}
```

---

### 3. 연결 상태 표시 컴포넌트

**파일**: `apps/frontend/src/components/layout/SerialStatusBar.tsx`

```typescript
'use client';

import { useSerial } from '@/contexts/SerialContext';
import { Usb, UsbOff, RefreshCw } from 'lucide-react';

export function SerialStatusBar() {
  const { connected, portInfo, connect, disconnect, lastScanned } = useSerial();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-gray-900 text-white 
                    flex items-center justify-between px-4 z-50">
      {/* 왼쪽: 연결 상태 */}
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <Usb className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400">
              바코드스캐너 연결됨
            </span>
            {portInfo && (
              <span className="text-xs text-gray-500">
                (VID:{portInfo.vendorId?.toString(16)} PID:{portInfo.productId?.toString(16)})
              </span>
            )}
          </>
        ) : (
          <>
            <UsbOff className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">바코드스캐너 연결 안됨</span>
          </>
        )}
      </div>

      {/* 중앙: 마지막 스캔 데이터 */}
      <div className="flex-1 mx-4 text-center">
        {lastScanned && (
          <span className="text-xs text-yellow-400 font-mono">
            마지막 스캔: {lastScanned}
          </span>
        )}
      </div>

      {/* 오른쪽: 액션 버튼 */}
      <div className="flex items-center gap-2">
        {connected ? (
          <button
            onClick={disconnect}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded"
          >
            연결 끊기
          </button>
        ) : (
          <button
            onClick={connect}
            className="flex items-center gap-1 text-xs text-green-400 
                       hover:text-green-300 px-2 py-1 rounded"
          >
            <RefreshCw className="w-3 h-3" />
            연결하기
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### 4. 페이지에서 사용

#### 방법 A: 구독 패턴 (권장)

**파일**: 예시 - `apps/frontend/src/app/(authenticated)/material/issue/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSerial } from '@/contexts/SerialContext';

export default function MaterialIssuePage() {
  const { onScan, connected } = useSerial();
  const [scannedLotNo, setScannedLotNo] = useState('');

  useEffect(() => {
    // 글로벌 스캔 이벤트 구독
    const unsubscribe = onScan((barcodeData) => {
      console.log('스캔됨:', barcodeData);
      setScannedLotNo(barcodeData);
      // LOT 조회 API 호출 등...
      handleLotSearch(barcodeData);
    });

    return () => {
      unsubscribe(); // 구독 해제
    };
  }, [onScan]);

  return (
    <div className="p-4 pb-12"> {/* pb-12는 SerialStatusBar 높이 */}
      <h1>자재 출고</h1>
      
      {/* 연결 상태 표시 */}
      {!connected && (
        <div className="bg-yellow-100 text-yellow-800 p-2 rounded mb-4">
          ⚠️ 바코드 스캐너가 연결되지 않았습니다.
        </div>
      )}

      {/* 스캔된 데이터 표시 */}
      <div className="mt-4">
        <label>LOT 번호</label>
        <input 
          type="text" 
          value={scannedLotNo}
          onChange={(e) => setScannedLotNo(e.target.value)}
          className="border p-2 w-full"
          placeholder={connected ? '바코드를 스캔하세요' : '수동 입력 또는 스캐너 연결 필요'}
        />
      </div>
    </div>
  );
}
```

#### 방법 B: Hook 래퍼 (기존 코드 마이그레이션용)

**파일**: `apps/frontend/src/hooks/useGlobalSerial.ts`

```typescript
import { useSerial } from '@/contexts/SerialContext';
import { useEffect, useState } from 'react';

// 기존 useSerialTest와 유사한 인터페이스
export function useGlobalSerial() {
  const { 
    connected, 
    connect, 
    disconnect, 
    onScan, 
    lastScanned,
    error 
  } = useSerial();

  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    // 스캔 데이터를 로그 형태로 변환 (기존 호환성)
    if (lastScanned) {
      setLogs(prev => [...prev, {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        direction: 'RX',
        ascii: lastScanned,
        hex: lastScanned.split('').map(c => c.charCodeAt(0).toString(16)).join(' '),
        bytes: lastScanned.length,
      }]);
    }
  }, [lastScanned]);

  return {
    connected,
    logs,
    error,
    connect,
    disconnect,
    clearLogs: () => setLogs([]),
  };
}
```

---

## 🔧 마이그레이션 가이드

### 기존 코드 → 새 코드

| 기존 (로컬) | 새 (글로벌) |
|------------|------------|
| `useSerialTest(config)` | `useSerial()` |
| `useEffect(() => { onData }, [])` | `useEffect(() => onScan(cb), [])` |
| `const { connected } = useSerialTest()` | `const { connected } = useSerial()` |
| 모달에서만 연결 | 앱 전역에서 연결 유지 |

---

## ⚠️ 주의사항

### 1. 페이지 여백 확보
```css
/* SerialStatusBar 높이(32px)만큼 하단 여백 확보 */
.main-content {
  padding-bottom: 32px;
}
```

### 2. 연결 권한 유지
- Web Serial API는 사용자가 포트 선택 후 브라우저가 권한을 유지함
- `serial.getPorts()`로 재접속 시 다이얼로그 없이 연결 가능

### 3. 데이터 버퍼링
- 바코드 스캐너는 개행(CR/LF)으로 데이터 구분
- Context 내부에서 버퍼링 후 완성된 데이터만 브로드캐스트

### 4. 에러 처리
```typescript
// 연결 끊김 감지 시 자동 재연결 시도
useEffect(() => {
  if (!connected && !error) {
    // 사용자가 의도적으로 끊은 게 아니라면 재연결
    const timer = setTimeout(() => reconnect(), 1000);
    return () => clearTimeout(timer);
  }
}, [connected, error, reconnect]);
```

---

## 📊 비교 표

| 항목 | 기존 (로컬) | 새 (글로벌) |
|------|-----------|-----------|
| **페이지 이동** | 연결 끊김 | 연결 유지 |
| **포트 선택** | 매 화면 반복 | 최초 1회 |
| **스캔 데이터** | 화면 내에서만 유효 | 어디서든 수신 |
| **코드 복잡도** | 단순 | Context 추가로 복잡도 ↑ |
| **디버깅** | 용이 | 전역 상태 추적 필요 |
| **테스트** | 독립적 | Provider wrapping 필요 |

---

## ✅ 완료 체크리스트

- [ ] `SerialContext.tsx` 생성
- [ ] `layout.tsx`에 Provider 적용
- [ ] `SerialStatusBar.tsx` 생성 및 하단 고정
- [ ] 기존 `useSerialTest` 사용 페이지 마이그레이션
- [ ] 페이지 하단 여백 확보 (StatusBar 높이)
- [ ] 연결 권한 유지 확인 (재접속 시 다이얼로그 안 뜨는지)
- [ ] 여러 페이지에서 동시 스캔 테스트
- [ ] 연결 끊김/재연결 테스트

---

## 🎓 참고

- **Web Serial API**: Chrome 89+, Edge 89+ 지원
- **보안**: HTTPS 환경에서만 동작 (localhost 예외)
- **사용자 권한**: 포트 접근 시 브라우저 권한 요청 필요
