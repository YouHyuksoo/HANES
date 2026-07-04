# 설비 마스터 (EQUIP_MASTER) — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요

| 항목 | 내용 |
|---|---|
| 메뉴 코드 | EQUIP_MASTER |
| 페이지 경로 | `/master/equip` |
| 화면 제목 | 설비 관리 (Equip Master) |
| 주요 기능 | 설비 CRUD, 이미지 업로드/삭제, 설비 BOM 관리, 통신 설정 (TCP/MQTT/Serial) |
| 데이터 소스 | Oracle EQUIP_MASTERS |

## 2. 화면 구성

```mermaid
graph TD
    A[EquipPage] --> B[EquipMasterTab]
    B --> C[Header: 타이틀 + 새로고침/설비추가 버튼]
    B --> D[DataGrid: 설비 목록]
    B --> E[우측 슬라이드 패널: 설비 폼]
    B --> F[EquipBomPanel: 설비 BOM 관리]
    D --> G[Search Input + EQUIP_TYPE Select + LineSelect + COMM_TYPE Select]
    E --> H[기본정보: equipCode, equipName, equipType, commType, lineCode]
    E --> I[통신설정: ipAddress, port, mqttTopic (commType 조건부)]
    E --> J[제조정보: maker, modelName]
    E --> K[사진 업로드/삭제]
    F --> L[설비별 소모품/BOM 품목 관리]
```

### 컴포넌트 목록

| 파일 | 역할 |
|---|---|
| `page.tsx` | EquipMasterTab 단일 컴포넌트 래핑 |
| `components/EquipMasterTab.tsx` | 전체 CRUD UI + 폼 패널 인라인 |
| `components/EquipBomPanel.tsx` | 설비 BOM (소모품) 관리 패널 |
| `components/EquipFieldHelp.tsx` | 폼 필드 헬퍼 |

### 버튼 목록

| 버튼 | 동작 | API |
|---|---|---|
| 새로고침 | 목록 재조회 | `GET /equipment/equips` |
| + 설비 추가 | 우측 패널 열기 (create) | — |
| 행 편집 아이콘 | 우측 패널 열기 (edit) | — |
| BOM 아이콘 | EquipBomPanel 열기 | `GET /master/equip-bom/equip/:equipCode` |
| 행 삭제 아이콘 | 삭제 확인 → `DELETE` | `DELETE /equipment/equips/:equipCode` |
| 이미지 업로드 | 파일 선택 | `POST /equipment/equips/:id/image` |
| 이미지 삭제 | 확인 → 삭제 | `DELETE /equipment/equips/:id/image` |

## 3. API 호출

| 엔드포인트 | 컨트롤러 | 설명 |
|---|---|---|
| `GET /equipment/equips` | `EquipMasterController.findAll` | 설비 목록 (페이징, 필터) |
| `GET /equipment/equips/:id` | `EquipMasterController.findById` | 단건 조회 |
| `POST /equipment/equips` | `EquipMasterController.create` | 생성 |
| `PUT /equipment/equips/:id` | `EquipMasterController.update` | 수정 |
| `DELETE /equipment/equips/:id` | `EquipMasterController.delete` | 삭제 |
| `POST /equipment/equips/:id/image` | `EquipMasterController.uploadImage` | 이미지 업로드 |
| `DELETE /equipment/equips/:id/image` | `EquipMasterController.removeImage` | 이미지 삭제 |
| `PATCH /equipment/equips/:id/status` | `EquipMasterController.changeStatus` | 상태 변경 |
| `GET /master/equip-bom/equip/:equipCode` | `EquipBomController.getEquipBomList` | 설비 BOM 목록 |
| `POST /master/equip-bom/rels` | `EquipBomController.createRel` | 설비-BOM 연결 생성 |
| `DELETE /master/equip-bom/rels/:equipCode/:bomItemCode` | `EquipBomController.deleteRel` | 설비-BOM 연결 삭제 |

## 4. DB 테이블 영향

| 테이블 | 작업 |
|---|---|
| `EQUIP_MASTERS` | SELECT/INSERT/UPDATE/DELETE |
| `EQUIP_BOM_ITEMS` | SELECT (설비 BOM 품목) |
| `EQUIP_BOM_RELS` | SELECT/INSERT/DELETE (설비-BOM 연결) |

주요 필드: `EQUIP_CODE(PK)`, `EQUIP_NAME`, `EQUIP_TYPE`, `COMM_TYPE`, `LINE_CODE`, `IP_ADDRESS`, `PORT`, `MAKER`, `MODEL_NAME`, `IMAGE_URL`, `STATUS`, `USE_YN`

## 5. 공통코드

| 코드 그룹 | 사용처 |
|---|---|
| `EQUIP_TYPE` | 설비 유형 (SINGLE_CUT 등) |
| `COMM_TYPE` | 통신 방식 (NONE/TCP/MQTT/SERIAL) |
| `EQUIP_STATUS` | 설비 상태 (ComCodeBadge 표시) |
| `LINE_TYPE` | 라인 구분 |

## 6. 처리 규칙

- commType=TCP/MQTT일 때 IP/포트 입력 필드 표시
- commType=SERIAL일 때 시리얼 포트/Baud Rate 필드 표시
- 설비코드는 수정 불가
- 이미지 저장 경로: `./uploads/equips/`
- 설비 BOM은 EquipBomPanel에서 별도 관리 (설비별 소모품/부품)
