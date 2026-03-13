# PDA 모바일 앱 설계서

**작성일**: 2026-03-13
**참조**: `docs/07-PDA-역질문서 [답변 V1].docx`
**UI 참조**: SMMEX_SMT_PDA 프로젝트 (lucide-react 아이콘, 세로 리스트/2열 그리드 패턴)

## 1. 개요

HANES MES의 안드로이드 PDA(Zebra TC21)용 모바일 화면. 기존 PWA 인프라(`/pda/` 라우트)를 확장하여 7개 프로그램 + 프레임워크를 구현한다. 별도 APK 패키징 없이 웹 URL로 접근한다.

## 2. 프레임워크 확정 사항

| 항목 | 결정 |
|------|------|
| 플랫폼 | 기존 Next.js PWA 확장 (웹 URL 접근) |
| PDA 기종 | Zebra TC21 (DataWedge — 키보드 웨지/HID 모드) |
| 로그인 | ID/PW + 작업자 QR 스캔 (QR로 작업자 전환, 로그아웃 없이) |
| 세션 | 자동 로그아웃 없음 (수동만), QR로 교대 전환 |
| 권한 | PDA 전용 권한 체계 (PC MES와 별도) |
| 바코드 | 연속 스캔 + 유형 자동 구분, 수동 입력 허용 |
| 네트워크 | Wi-Fi 전용, 오프라인 시 작업 차단 |
| 다국어 | 한/영/중/베 (react-i18next) |

## 3. 로그인 + 작업자 전환

### 3.1 최초 로그인 (ID/PW)

기존 PDA 로그인 화면 유지. 회사/사업장 선택 → 이메일/비밀번호 → 로그인 → 메인 메뉴.

### 3.2 작업자 QR 전환

- PdaHeader에 현재 작업자명 표시 + QR 전환 버튼
- QR 전환 버튼 클릭 → ScanInput 모달 → 작업자 QR 스캔
- QR 스캔 → `GET /api/master/workers/by-qr/{qrCode}` → 작업자 정보 조회
- 성공 시 `authStore.currentWorker` 업데이트 (세션/토큰 유지, 작업자만 교체)
- 모든 PDA 트랜잭션에 `currentWorker.id` 기록

### 3.3 PDA 전용 권한

- 백엔드: `PDA_ROLE`, `PDA_ROLE_MENU` 테이블 추가
- 로그인 응답에 `pdaAllowedMenus: string[]` 추가
- PDA 메뉴 렌더링 시 `pdaAllowedMenus` 기준으로 필터링

## 4. 메뉴 구조

### 4.1 메인 메뉴

SMMEX 스타일 세로 리스트 버튼. lucide-react 아이콘 + 색상별 border.

| 메뉴 | 아이콘 | 색상 | 동작 |
|------|--------|------|------|
| 자재관리 | `Package` | blue | → 서브메뉴 (4개) |
| 출하등록 | `Truck` | green | → 기능 페이지 직접 |
| 설비 일상점검 | `Wrench` | orange | → 기능 페이지 직접 |
| 제품 재고실사 | `ClipboardCheck` | purple | → 기능 페이지 직접 |
| 로그아웃 | `LogOut` | red | → 로그아웃 → 로그인 |

버튼 스타일: `h-16`, `bg-white dark:bg-slate-800`, `border-2 border-{color}-200 dark:border-{color}-800`, `active:scale-[0.98]`

### 4.2 자재관리 서브메뉴

SMMEX 스타일 2열 그리드. PageHeader(파랑) + 뒤로가기.

| 메뉴 | 아이콘 | 색상 | 경로 |
|------|--------|------|------|
| 입고 | `Download` | blue | `/pda/material/receiving` |
| 불출 | `Upload` | purple | `/pda/material/issuing` |
| 보정 | `Settings2` | green | `/pda/material/adjustment` |
| 실사 | `FileSearch` | cyan | `/pda/material/inventory-count` |

버튼 스타일: `h-20`, 2열 그리드, `active:scale-[0.97]`

## 5. 기능 페이지 워크플로우

### 5.1 자재입고

**경로**: `/pda/material/receiving`
**우선순위**: 1순위

**흐름**:
1. 제조사 바코드 스캔 → 매핑 테이블 조회(`vendor_barcode_mapping`) → MES 자재코드 변환
2. 입하/발주 정보 표시 (품목, 수량, 공급업체)
3. IQC 체크:
   - 미합격 → "IQC 미합격 자재입니다. 입고 불가" 차단
   - 무검사(iqcYn=N) → 바로 허용
4. 창고 선택 + 로케이션 바코드 스캔
5. 입고 확인 → LOT 생성 → 이력 누적
6. 취소는 PC에서만 가능

**API**:
- `GET /api/material/arrival/by-vendor-barcode/{barcode}` — 제조사 바코드 매핑 조회
- `POST /api/material/receiving` — 입고 처리

### 5.2 자재불출 (출고/이동)

**경로**: `/pda/material/issuing`
**우선순위**: 1순위

**흐름**:
1. 작업지시 바코드 스캔 → BOM 기반 필요자재 목록 표시
2. 자재 LOT 바코드 하나씩 스캔 → 목록에서 체크 처리 (피킹+불출 동시)
3. 과불출 시 ConfirmModal: "요청 수량 초과입니다. 계속하시겠습니까?"
4. 출고유형 선택: 생산불출 / 창고이동 / 반품
5. 불출 확인 → 재고 차감
6. 반납 없음 (생산현장 내 자재보관 로케이션 구성)

**API**:
- `GET /api/production/job-orders/by-barcode/{barcode}` — 작업지시 + BOM 조회
- `POST /api/material/issues/scan` — 불출 처리

### 5.3 자재재고보정

**경로**: `/pda/material/adjustment`
**우선순위**: 1순위

**흐름**:
1. 자재 바코드 스캔 → 현재 재고 표시
2. 실재고 수량 입력 → 차이 자동 계산 (증가=초록, 감소=빨강)
3. 최초 재고보다 많은 재고로 보정 불가 → 차단
4. 사유 필수 선택: 파손 / 분실 / 계량오차 / 기타
5. "보정 요청" → **승인 대기 상태**로 저장
6. PC에서 관리자가 승인/반려 처리

**API**:
- `GET /api/material/lots/by-uid/{matUid}` — LOT 재고 조회
- `POST /api/material/adjustment` — 보정 요청 (status: PENDING)

**백엔드 추가**: 보정 승인 워크플로우 (`adjustment_status`: PENDING → APPROVED/REJECTED)

### 5.4 자재재고실사

**경로**: `/pda/material/inventory-count`
**우선순위**: 1순위

**흐름**:
1. PDA 진입 시 PC에서 개시한 진행 중 실사 자동 로드
2. 실사 없으면 → "진행 중인 실사가 없습니다" 안내
3. 로케이션 QR 스캔 → 해당 위치 포커스
4. 자재 바코드 연속 스캔 → 자동 카운트 +1
5. 실사 중 전체 창고 모든 자재 트랜잭션 차단 (백엔드 처리)
6. 확정은 PC에서 관리자가 차이 확인 후 보정

**API**:
- `GET /api/material/physical-inv/active` — 진행 중 실사 조회
- `POST /api/material/physical-inv/count` — 스캔 카운트 저장

**백엔드 추가**: 실사 중 트랜잭션 차단 미들웨어/가드

### 5.5 출하실적 등록

**경로**: `/pda/shipping`
**우선순위**: 1순위

**흐름**:
1. 출하지시 바코드 스캔 → 출하 정보 표시 (지시No, 고객, 품목, 수량)
2. 작업자 QR 스캔 → 작업자 확인
3. 제품 바코드 다건 스캔:
   - 개별 포장 박스 단위 스캔
   - 팔레트 바코드 스캔 → 하위 박스 일괄 처리
4. 검증:
   - 다른 품목 스캔 → 차단
   - 초과 스캔 → 차단
5. 부분출하 허용 (수량 미만이어도 확정 가능)
6. 취소는 PC에서만

**API**:
- `GET /api/shipping/orders/by-barcode/{barcode}` — 출하지시 조회
- `POST /api/shipping/register` — 출하 등록

### 5.6 설비 일상점검

**경로**: `/pda/equip-inspect`
**우선순위**: 2순위

**흐름**:
1. 설비 QR 스캔 → 점검항목 표시
2. 이미 점검 완료 설비 → "이미 점검 완료된 설비입니다" 안내 + 추가 기록 허용 (이력 누적)
3. 각 항목 OK/NG 체크
4. NG 선택 시:
   - 사유 코드 선택 (파손/탈락/노후화 등 — ComCode 관리)
   - 직접입력도 가능 (비고 필드)
5. NG 있으면 → **설비 인터락 발동** (백엔드에서 설비 상태를 INTERLOCK으로 변경)
6. 정기점검은 PC에서만 수행
7. 소모품 관리는 PC에서만, PDA 점검과 무관

**API**:
- `GET /api/equipment/equips/code/{code}` — 설비 조회
- `GET /api/master/equip-inspect-items?equipCode={code}&inspectType=DAILY` — 점검항목
- `POST /api/equipment/daily-inspect` — 점검 결과 저장 + 인터락 처리

**백엔드 추가**: NG 시 설비 상태 INTERLOCK 전환 로직

### 5.7 제품 재고실사

**경로**: `/pda/product/inventory-count`
**우선순위**: 1순위

자재실사와 **동일 UI/UX** 구조. 차이점:

| 항목 | 자재실사 | 제품실사 |
|------|---------|---------|
| 대상 | 자재 LOT | 완제품 (반제품 제외) |
| 스캔 | 로케이션 → 자재 | 개별 제품 바코드 |
| API | material 엔드포인트 | inventory/products 엔드포인트 |
| 트랜잭션 차단 | 자재 트랜잭션 | 제품 트랜잭션 |

**API**:
- `GET /api/inventory/products/physical-inv/active` — 진행 중 실사
- `POST /api/inventory/products/count` — 스캔 카운트

## 6. 공용 컴포넌트 변경

### 6.1 PdaHeader 수정

- 현재 작업자명 상시 표시
- QR 전환 버튼 추가
- SMMEX `PageHeader` 스타일 적용: accent color + 라인/작업자 표시

### 6.2 ScanInput (기존 유지)

- inputMode 트릭 (SMMEX 패턴과 동일)
- Zebra TC21 DataWedge는 키보드 웨지(HID) 모드로 동작 → 기존 ScanInput이 처리
- 연속 스캔: 한 필드에서 Enter → 다음 필드로 포커스 이동 (SMMEX ScanInputs 패턴)

### 6.3 신규 — NG 사유 선택 컴포넌트

- 설비점검 NG 사유 / 보정 사유 등에서 재사용
- ComCode 기반 드롭다운 + "기타" 선택 시 직접입력 필드 표시

### 6.4 신규 — BomCheckList 컴포넌트

- 자재불출에서 BOM 필요자재 목록 표시
- 체크/미체크 상태, 수량 표시, 스캔 시 자동 체크

## 7. 상태 관리 변경

### 7.1 authStore 확장

```typescript
// 추가 필드
currentWorker: { id: string; name: string; code: string } | null;
pdaAllowedMenus: string[];

// 추가 메서드
setCurrentWorker(worker): void;
```

### 7.2 pdaStore (기존 유지)

`scanDelay`, `soundEnabled`, `keyboardVisible` — 변경 없음.

## 8. 백엔드 추가 작업

| 작업 | 설명 |
|------|------|
| PDA 권한 테이블 | `PDA_ROLE`, `PDA_ROLE_MENU` 엔티티/CRUD |
| 작업자 QR 조회 | `GET /api/master/workers/by-qr/{qrCode}` |
| 보정 승인 워크플로우 | `adjustment_status` 필드 + 승인/반려 API |
| 실사 트랜잭션 차단 | 실사 진행 중 입고/불출/이동 차단 가드 |
| 설비 인터락 | NG 시 설비 상태 INTERLOCK 전환 |
| 제조사 바코드 매핑 조회 | 기존 `vendor_barcode_mapping` 활용 |

## 9. 라우트 구조 (최종)

```
/pda/
├── login/                          # 로그인 (기존)
├── menu/                           # 메인 메뉴 (수정: SMMEX 스타일)
├── settings/                       # 설정 (기존)
├── material/
│   ├── menu/                       # 자재 서브메뉴 (수정: 2열 그리드)
│   ├── receiving/                  # 자재입고 (수정: 제조사 바코드 매핑 + IQC 체크)
│   ├── issuing/                    # 자재불출 (수정: 작업지시 스캔 → BOM 피킹)
│   ├── adjustment/                 # 재고보정 (수정: 승인 워크플로우)
│   └── inventory-count/            # 자재실사 (수정: PC 개시 실사 연동)
├── shipping/                       # 출하등록 (수정: 작업자 QR + 팔레트)
├── equip-inspect/                  # 설비점검 (수정: NG 사유코드 + 인터락)
└── product/
    └── inventory-count/            # 제품실사 (수정: 자재실사와 UI 통일)
```
