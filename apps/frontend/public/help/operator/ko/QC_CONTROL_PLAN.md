---
menuCode: QC_CONTROL_PLAN
audience: operator
title: 관리계획 통합 문서 운영 가이드
summary: QREKA-PR-025 문서의 Revision, 검증, 출력과 JSHANES 운영 상태를 점검합니다.
tags: [품질관리, 운영, Revision, QREKA-PR-025]
keywords: [QUALITY_PLAN_PACKAGES, QUALITY_PLAN_REVISIONS, 검증, 발행, SUPERSEDED]
related: []
---

# 관리계획 통합 문서 운영 가이드

## 핵심 데이터

- 패키지/문서/Revision: `QUALITY_PLAN_PACKAGES`, `QUALITY_PLAN_DOCUMENTS`, `QUALITY_PLAN_REVISIONS`
- 행: `QUALITY_PROCESS_FLOW_ROWS`, `QUALITY_PFMEA_ROWS`, `QUALITY_CONTROL_PLAN_ROWS`
- 감사: `QUALITY_PLAN_VALIDATIONS`, `QUALITY_PLAN_EVENTS`, `QUALITY_PLAN_PARTICIPANTS`
- 모든 조회·변경은 `COMPANY`, `PLANT_CD` tenant 범위를 포함합니다.

## 상태 점검

- 문서마다 활성 `DRAFT`는 최대 1개입니다.
- 발행 전 검증 오류가 있으면 상태가 바뀌지 않아야 합니다.
- 행이 없는 문서는 발행할 수 없고, 최초 발행 후 패키지 공통 기본정보는 고정됩니다.
- 새 발행본이 생기면 이전 `PUBLISHED`는 `SUPERSEDED`여야 합니다.
- PFMEA/Control Plan의 참조 Revision과 행 FK가 같은 tenant인지 확인합니다.
- PFMEA의 CFT 참여자는 해당 DRAFT Revision에만 생성·삭제할 수 있고 새 Revision 생성 시 복제됩니다.
- PFMEA 목표일·완료일은 날짜 전용 값으로 보존되며 조치 후 S/O/D와 `ACTION_RPN`도 Revision snapshot에 포함됩니다.
- trace 조회는 신규 `QUALITY_CONTROL_PLAN_ROWS`의 최신 발행본을 사용합니다.
- 같은 문서의 두 Revision 비교와 미리보기·다운로드·인쇄 감사이력을 확인할 수 있습니다.

## 출력 장애

- 한글 깨짐: `/fonts/NotoSansKR-Regular.ttf`, `NotoSansKR-Bold.ttf` 응답과 CID `Identity-H` 등록을 확인합니다.
- 내용 불일치: 출력 API가 `PUBLISHED` snapshot만 반환하는지 확인합니다.
- 인쇄 실패: 브라우저의 Blob URL 및 인쇄 팝업 정책을 확인합니다. 화면 DOM 캡처는 사용하지 않습니다.

## DB 적용 확인

마이그레이션은 등록된 `oracle-db` connector의 `JSHANES` 사이트로만 실행합니다. 적용 후 테이블 9개, Sequence 12개, 공통코드 16개, 고아 FK 0건, 중복 DRAFT 0건을 확인합니다.
