# 미완료 작업 기록: 기준정보 개선 10건

- 작성시각: 2026-09-08 21:55 KST
- 작성자: codex
- 작업 범위: 기준정보10건 및 동일 원시시각 추가점검
- 현재 상태: 검증대기

## 완료한 것
- 10건 코드반영, 실제API 필터/작업지도서JOIN 확인. FE/BE tsc, backend32/frontend23 테스트 통과.
- 전체 결과: [기준정보10건](../2026-09-08-master-ten-improvements.md).

## 미완료 / 남은 것
- localhost3002 페이지 진입timeout 이후 실제 UI 렌더/필터선택/작업지도서폼 검증.
- 커밋·push·배포는 이번 변경에서 수행하지 않음.
- 미사용 과거 작업지도서1건의 매칭 마스터 부재는 운영데이터 그대로 보존.

## 변경 파일
- 전체보고서 영향 지도와 git diff 참고. master iqc/warehouse/equip/work-instruction, quality defect-code, 추가 날짜표시7파일 및 관련backend/test/docs.

## 검증 상태
- 실행함: 실제GET 및 DB읽기, FE/BE tsc, backend32/frontend23, diffcheck.
- 실행 못함: browser goto domcontentloaded15~20초 timeout. 신규 업무등록/수정/삭제/출력은 미실행.

## 중단 사유
- 코드반영과 API조회 검증 완료. localhost 페이지 응답지연으로 실제 렌더QA 미완료.

## 다음 작업자가 바로 할 일
1. localhost3002 현재프로세스/로그를 확인하고 페이지 응답 정상화 후 대상화면 QA.
2. 사용여부 기본값, IQC있음/없음, 공정선택/수정읽기전용, 이름/시각 표시 확인.
3. commit/push/deploy 요청시 기존PDA/equipment/product-physical-inv/sample-inspect/이미지 dirty를 제외하고 해당변경만 포함.

## 주의사항
- 업무DB 쓰기·schema변경 없음. 창고규칙API/데이터는 유지하고 탭만숨김.
- 보고서 API 결과를 브라우저 전수PASS로 오인하지 말 것.
