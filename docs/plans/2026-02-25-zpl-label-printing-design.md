# ZPL 라벨 인쇄 시스템 디자인

**날짜:** 2026-02-25
**상태:** 승인됨

## 목적

입고 라벨 발행 시 외부 디자이너(Zebra Designer 등)에서 만든 ZPL 템플릿을 등록하고, Zebra 프린터로 직접 출력하는 기능을 추가한다. 기존 브라우저 인쇄와 병행 운영한다.

## 접근 방식

- **1순위**: PC에 USB 직접 연결된 Zebra 프린터 → Zebra Browser Print 에이전트 활용
- **2순위 (옵션)**: TCP/IP 네트워크 프린터 → 백엔드 `net.Socket` 전송
- **적용 범위**: 자재롯트(mat_lot) 카테고리만 우선 적용, 나머지 카테고리는 추후 확장
- **ZPL 템플릿**: 외부 디자이너에서 만든 ZPL 코드를 복사/붙여넣기로 등록, 변수 플레이스홀더 치환

## 전체 흐름

```
[외부 ZPL 디자이너] → ZPL 코드 복사
       ↓
[라벨 템플릿 관리] → ZPL 코드 등록 (플레이스홀더 포함)
       ↓
[입고 라벨 발행] → LOT 선택 → 출력 방식 선택
       ↓                          ↓
  ┌────┴────┐              ┌──────┴──────┐
  │ 브라우저  │              │   ZPL 출력   │
  │ print()  │              │             │
  │(기존방식) │              │ 1순위: USB   │
  └─────────┘              │(Browser Print)│
                           │ 2순위: TCP/IP │
                           │(백엔드 전송)   │
                           └──────────────┘
       ↓
[발행 이력 저장] → LABEL_PRINT_LOGS 테이블
```

## 데이터 구조

### 기존 테이블 변경 — LABEL_TEMPLATES

| 추가 컬럼 | 타입 | 설명 |
|-----------|------|------|
| `ZPL_CODE` | CLOB | 외부 디자이너에서 만든 ZPL 코드 (변수 플레이스홀더 포함) |
| `PRINT_MODE` | VARCHAR(20) | 인쇄 모드: `BROWSER`, `ZPL`, `BOTH` |
| `PRINTER_ID` | UUID, nullable | 기본 프린터 (EQUIP_MASTERS FK, 옵션) |

### 새 테이블 — LABEL_PRINT_LOGS

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `ID` | UUID PK | 자동 생성 |
| `TEMPLATE_ID` | UUID FK | 사용된 템플릿 |
| `CATEGORY` | VARCHAR(20) | `mat_lot` 등 |
| `PRINT_MODE` | VARCHAR(20) | `BROWSER` / `ZPL_USB` / `ZPL_TCP` |
| `PRINTER_NAME` | VARCHAR(100) | 출력된 프린터명 |
| `LOT_IDS` | CLOB (JSON) | 발행 대상 LOT ID 배열 |
| `LABEL_COUNT` | NUMBER | 출력 매수 |
| `WORKER_ID` | VARCHAR(50) | 발행자 |
| `PRINTED_AT` | TIMESTAMP | 발행 일시 |
| `STATUS` | VARCHAR(20) | `SUCCESS` / `FAILED` |
| `ERROR_MSG` | VARCHAR(500) | 실패 시 에러 메시지 |
| `COMPANY` | VARCHAR(50) | 회사 |
| `PLANT_CD` | VARCHAR(50) | 공장 |

### ZPL 변수 플레이스홀더

**기본 세트:**

| 변수 | 설명 | 예시 |
|------|------|------|
| `{{lotNo}}` | LOT 번호 | L20260222-1HMX |
| `{{partCode}}` | 품목코드 | 1020 |
| `{{partName}}` | 품목명 | NUT |
| `{{qty}}` | 수량 | 300 |
| `{{unit}}` | 단위 | EA |
| `{{vendor}}` | 공급업체 | ABC Corp |
| `{{recvDate}}` | 입하일 | 2026-02-22 |
| `{{barcode}}` | 바코드 데이터 (=lotNo) | L20260222-1HMX |

**커스텀 필드:** `{{custom1}}` ~ `{{custom5}}` (사용자 자유 정의)

## 백엔드 변경

### Entity 변경
- `label-template.entity.ts`: `zplCode`, `printMode`, `printerId` 컬럼 추가

### 새 Entity
- `label-print-log.entity.ts`: LABEL_PRINT_LOGS 테이블 매핑

### 새 Service
- `label-print.service.ts`:
  - `replaceVariables(zpl, lotData)`: ZPL 변수 치환
  - `printViaTcp(printerIp, port, zplData)`: TCP/IP 전송 (옵션)
  - `logPrint(dto)`: 발행 이력 저장
  - `findLogs(query)`: 발행 이력 조회

### 새 Controller
- `label-print.controller.ts`:
  - `POST /material/label-print/generate`: ZPL 생성 (변수 치환 결과 반환)
  - `POST /material/label-print/tcp`: TCP/IP로 프린터 전송 (옵션)
  - `POST /material/label-print/log`: 발행 이력 저장
  - `GET /material/label-print/logs`: 발행 이력 조회

### DTO
- `label-print.dto.ts`: GenerateZplDto, TcpPrintDto, PrintLogDto, PrintLogQueryDto

## 프론트엔드 변경

### 1. 라벨 관리 페이지 (기준정보)

기존 라벨 디자이너 옆에 **"ZPL 코드"** 탭 추가:
- **ZPL 코드 에디터**: 모노스페이스 textarea (외부 디자이너에서 복사/붙여넣기)
- **변수 도우미**: 사용 가능한 플레이스홀더 목록 + 클릭 시 커서 위치에 삽입
- **인쇄 모드 선택**: `브라우저` / `ZPL` / `둘 다`
- **ZPL 미리보기**: Labelary API로 ZPL → 이미지 변환 미리보기

### 2. 입고 라벨 발행 페이지

기존 "라벨 발행" 버튼 옆에 출력 방식 드롭다운:
- **브라우저 인쇄** (기존 방식)
- **ZPL - USB 프린터** (Zebra Browser Print)
- **ZPL - 네트워크** (TCP/IP, 옵션)

ZPL 선택 시:
1. Zebra Browser Print 에이전트 연결 상태 표시
2. 감지된 프린터 목록에서 선택
3. 변수 치환 → ZPL 전송 → 발행 이력 저장

### 3. Zebra Browser Print 연동 유틸리티

- `hooks/useZebraPrinter.ts`:
  - `isAgentConnected`: 에이전트 연결 상태
  - `printers`: 감지된 프린터 목록
  - `selectedPrinter`: 선택된 프린터
  - `sendZpl(zplData)`: ZPL 전송
  - `getStatus()`: 프린터 상태 조회

### 4. 발행 이력 조회

입고 라벨 발행 페이지 하단 또는 별도 탭:
- DataGrid: 발행일시, 발행자, 템플릿명, 출력방식, 매수, 상태
- 필터: 기간, 출력방식, 상태

## i18n

ko, en, zh, vi 4개 파일에 관련 키 추가:
- `label.zplCode`, `label.printMode`, `label.variableHelper`
- `label.print.browserPrint`, `label.print.zplUsb`, `label.print.zplTcp`
- `label.print.agentConnected`, `label.print.agentDisconnected`
- `label.print.selectPrinter`, `label.print.printHistory`
- `label.print.logStatus.success`, `label.print.logStatus.failed`
