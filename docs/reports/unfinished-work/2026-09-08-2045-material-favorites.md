# 미완료 작업 기록: 자재 38건 및 즐겨찾기 폴더 최종 반영

- 작성시각: 2026-09-08 20:45 KST
- 작성자: codex
- 작업 범위: 자재 개선 38건·즐겨찾기 폴더
- 현재 상태: 검증대기

## 완료한 것

- 구현, JSHANES 메뉴/폴더 migration 적용, ERD, 타입검사 및 focused tests 완료.
- 실제 즐겨찾기 생성/이동/이름변경 및 GET 저장 지속성 확인. 테스트폴더 삭제 후 기존13개 메뉴와 순서 복원 확인.
- 상세 결과: [38건 보고서](../2026-09-08-material-improvements.md).

## 미완료 / 남은 것

- localhost3002 페이지 응답 timeout 해소 후 즐겨찾기 reload 렌더 및 폴더 삭제 UI 재검증.
- PO현황 우측 합계 등 실UI 미실측 항목 추가 확인.
- 새 작업의 커밋·배포는 요청되지 않아 수행하지 않음. 배포 SHA 없음.
- 문의11의 재발행 제한을 의도한 업무 정책인지는 승인 근거 확인 필요. 현행 제한 및 안내를 유지함.

## 변경 파일

- `apps/frontend/src/components/layout/`, `hooks/useMenuFavorite*.ts`: 폴더 UI 및 서버 상태.
- `apps/backend/src/modules/menu-favorites/`, 관련 entities/migrations: 폴더 저장 및 격리.
- 공통 DataGrid, material 컬럼/화면/공유표, receiving/lot-split 서비스, ko.json: 38건 보고서 참조.
- `docs/database/schema-erd.md`: 적용 DB 구조 재생성.

## 검증 상태

- 실행함: FE/BE tsc, backend5 suites43tests, Node8tests, diff check 통과. 실제 로그인 일부 화면·API·JSHANES 확인.
- 실행 못함: 최종 페이지 reload60초/새 탭30초/HTTP10초 timeout으로 reload와 삭제버튼 UI 확인. API 삭제 및 원상복원은 성공.

## 중단 사유

- 개발서버3002 API는 응답하지만 페이지 요청 timeout. 임의 서버 교체·재시작하지 않음. 앱 커밋·배포 요청 없음.

## 다음 작업자가 바로 할 일

1. 현재 dirty와 localhost3002 소유프로세스(검사 당시35392)·로그를 확인하고 페이지 timeout 재현 및 원인 진단.
2. 테스트 폴더 생성→이동→이름변경→새로고침→삭제를 실제 UI로 검증하고 생성 데이터만 정리.
3. 커밋/배포 지시 시 의도한 파일만 stage하고 검증/배포 SHA를 기록. DONE 증거가 모이기 전 IN_PROGRESS 유지.

## 주의사항

- 테스트폴더 id1은 삭제 완료. 폴더0, 기존즐겨찾기13, 모든 folderId null, 순서 동일.
- PDA/equipment/product-physical-inv/sample-inspect/기존 migration/이미지 등 타 작업 dirty를 포함하거나 되돌리지 않는다. ko.json 공유 변경은 hunk 확인.
- DB migration은 이미 JSHANES에 적용됨. SQL 파일만 미적용 상태로 오인하지 않는다.
