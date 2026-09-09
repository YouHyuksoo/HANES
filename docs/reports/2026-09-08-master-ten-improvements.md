# 기준정보 개선 10건 반영 및 검증

2026-09-08, HEAD c98ed7b2 이후 작업트리 기준. 코드 반영 및 API 검증 상태이며 커밋·배포 전이다.

## 항목별 결과

| 번호 | 결과 |
| --- | --- |
| 01 | 메뉴·화면 헤더·제목을 검사항목마스터(IQC전용)으로 변경. menuConfig QC_IQC_ITEM의 기존 번역키를 유지하고 ko 3개 문구 수정. 메뉴 신설/권한변경 없음 |
| 02 | 품목별 IQC 좌측 사용여부/항목유무 필터, 기본 사용+있음. 새 GET /master/iqc-part-specs/parts에서 검색·필터·집계·페이징. 기존 검사기준 일부만 읽어 잘못 계산하던 항목수 문제 제거 |
| 03 | WAREHOUSE_TRANSFER_RULES 참조는 master/AI CRUD와 기준정보검증이며 실제 재고이동 검증에는 사용되지 않음. 창고이동규칙 탭만 숨김. 기존 API/DB 보존 |
| 04 | 창고·위치 탭에 공유 사용여부 조건 기본Y. 위치는 소속창고 사용여부 기준. 기존 warehouseCode를 서버가 warehouseId로만 받던 필터 불일치도 수정, warehouseId 호환 유지 |
| 05 | 설비목록 공통 UseYnSelect 기본Y, /equipment/equips useYn 전달 |
| 06 | 작업지도서 공정명 컬럼, 등록 공정선택, 미리보기 코드(공정명). 수정시 복합키인 공정은 기존 불변정책 유지하며 코드(공정명) 읽기전용 표시. 미사용 공정도 기존 문서의 명칭은 확인 가능 |
| 07 | 작업지도서 목록·상세에 회사/사업장 범위 ItemMaster/ProcessMaster JOIN, 품목명·공정명 평탄화 응답. 품목명 검색 추가 |
| 08 | 작업지도서 UseYnSelect 기본Y 및 useYn API 전달 |
| 09 | 작업지도서 목록/미리보기 수정일 한국시간 YYYY-MM-DD HH:mm. 추가 원시값 점검 후 팔레트목록·라벨미리보기, 인터페이스로그목록·상세·대시보드, 반제품/제품재고 수정일, 출하이력 등록일도 공용 formatter 적용 |
| 10 | 불량코드목록 UseYnSelect 기본Y 및 기존 API useYn 연결 |

사용여부 조건은 모두 기존 components/shared/UseYnSelect를 재사용한다. 전체 선택은 빈 파라미터를 보내는 대신 useYn 자체를 생략한다.

IQC 항목유무는 기존 resolveItems 기준에 맞춰 USE_YN=Y인 배정 상세행과 실제 IQC_ITEM_POOL 연결 존재를 센다. 기존 IQC 판정 정책을 바꾸지 않는다. 서버 필터 후 페이지 처리하며 검사기준 저장 후 목록·항목수·선택 상태를 재조회한다.

추가 보완: 작업지도서 수정폼이 content를 항상 빈값으로 초기화하던 결함을 수정하여 기존 본문 보존. 신규 등록 API는 선택 공정이 같은 회사/사업장의 사용 공정인지 검증한다.

## 실제 조회 결과

로그인 저장상태 사용, localhost3002/api, 회사40/사업장1000, 업무데이터 변경 없이 GET으로 확인했다.

| 대상 | 확인값 |
| --- | --- |
| 설비 | 사용22 / 미사용42, 각 응답 useYn 일치 |
| 불량코드 | 사용12 / 미사용0 |
| 창고 | 사용13 / 미사용5 / 전체18 |
| 창고위치 | 사용창고32 / 미사용창고3 / 전체35, 소속창고 범위 밖0, 없는 warehouseCode 조회0 |
| IQC품목 | 사용+있음28 / 사용+없음6 / 미사용+있음0 / 미사용+없음3 / 전체37. API·JSHANES 집계일치. 검색 및 페이지 경계 확인 |
| 작업지도서 | 사용11 / 미사용2 / 전체13. 사용11건 모두 품목명·공정명 반환 |
| 작업지도서 검색/상세 | 품목명 HNS A'ssy 검색1건. MAG_EAD65942601/MASSY 상세에서 HNS A'ssy/조립 확인 |

미사용 작업지도서 1건은 현재 품목/공정 마스터와 매칭되지 않아 명칭이 null이다. 원본 마스터가 없는 과거 데이터의 명칭을 임의 생성하지 않았다.

## 검증

- FE/BE tsc --noEmit --pretty false 통과.
- backend work-instruction, iqc-part-spec, warehouse-location: 3suites32tests 통과.
- frontend 작업지도서/품목별IQC/설비/불량코드 구조 및 KST formatter:23tests 통과.
- git diff --check 통과.
- work-instruction 시험코드의 페이지 DTO 및 nullable content 타입 충돌은 최종 수정 후 재검증 완료.
- 브라우저 /master/iqc-item, /master/equip, /quality/defect-code 진입20초 timeout. 창고 페이지도15초 timeout. 화면 렌더·필터 클릭·폼저장 전수검증은 미완료이며, API 조회 검증과 구분한다.
- 실제 등록/수정/삭제 업무 시나리오 및 프린터 출력은 실행하지 않음.

## 영향 지도와 배포

- IQC: master/iqc-part-spec page → ItemListPanel/IqcSpecPanel → iqc-part-spec controller/dto/service.
- 창고: warehouse page/WarehouseList/LocationList → inventory warehouse-location controller/service.
- 작업지도서: page/columns/form/preview → master work-instruction service. 상세는 docs/business-logics/MST_WORK_INST.md.
- 메뉴/필터: ko.json, EquipMasterTab, quality/defect-code page. 공통 UseYnSelect 원본 변경 없음.
- 시각: utils/dateTimeKst.ts 기존 공용 함수를 사용. 날짜 전용 표시·이미 포맷된 모니터링 시계까지 일괄 치환하지 않음.
- DB schema/메뉴코드/역할권한 변경 없음. migration 적용이나 ERD 재생성 대상 아님.
- 커밋·push·운영배포는 이번 요청에서 수행하지 않음. DONE 증거(수정SHA/테스트/배포SHA) 미완성.
