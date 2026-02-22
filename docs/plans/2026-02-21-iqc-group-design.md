# IQC 검사그룹 관리 기능 설계

## 개요
IQC 검사항목을 묶어서 검사그룹으로 관리하는 기능. 1개 부품에 대해 여러 검사항목을 조합하여 검사하며, 그룹 내 모든 항목을 합격해야 통과.

## DB 테이블

### IQC_GROUPS (검사그룹 마스터)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | UUID, PK | 고유 식별자 |
| GROUP_CODE | VARCHAR(20), UNIQUE | 그룹코드 (IGR-001) |
| GROUP_NAME | VARCHAR(100) | 그룹명 |
| INSPECT_METHOD | VARCHAR(20) | 검사형태 (FULL/SAMPLE/SKIP) |
| SAMPLE_QTY | INT, nullable | 샘플 수량 (SAMPLE일 때만) |
| USE_YN | VARCHAR(1), default 'Y' | 사용여부 |
| COMPANY | VARCHAR(10) | 회사코드 |
| PLANT_CD | VARCHAR(10) | 공장코드 |
| CREATED_BY, UPDATED_BY | VARCHAR(50) | 작성/수정자 |
| CREATED_AT, UPDATED_AT | TIMESTAMP | 타임스탬프 |
| DELETED_AT | TIMESTAMP, nullable | 소프트 삭제 |

### IQC_GROUP_ITEMS (그룹-항목 매핑)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | UUID, PK | 고유 식별자 |
| GROUP_ID | UUID, FK → IQC_GROUPS | 그룹 ID |
| ITEM_ID | UUID, FK → IQC_ITEM_MASTERS | 항목 ID |
| SEQ | INT | 검사순서 |
| UNIQUE(GROUP_ID, ITEM_ID) | | 중복 방지 |

## 백엔드 API

```
GET    /master/iqc-groups          - 목록 조회 (필터: search, inspectMethod, useYn)
GET    /master/iqc-groups/:id      - 상세 조회 (항목 포함)
POST   /master/iqc-groups          - 생성 (항목 매핑 포함)
PUT    /master/iqc-groups/:id      - 수정 (항목 매핑 포함)
DELETE /master/iqc-groups/:id      - 소프트 삭제
```

## 프론트엔드 UI

### 탭 구조
- 탭 1: 검사항목 관리 (기존 유지)
- 탭 2: 검사그룹 관리 (신규)

### 그룹 탭
- 상단: 검색 + 검사형태 필터 + 추가 버튼
- DataGrid: 그룹코드 | 그룹명 | 검사형태(배지) | 샘플수량 | 항목수 | 수정/삭제

### 그룹 추가/수정 모달 (size="xl")
- 좌측: 그룹코드, 그룹명, 검사형태, 샘플수량
- 우측: 검사항목 선택 (체크박스 + 순서)
