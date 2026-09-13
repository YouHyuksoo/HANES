# 미완료 작업 기록: THN 관리계획서 vs HANES 대조

- 작성시각: 2026-09-14 14:00 KST
- 작성자: grok
- 작업 범위: THN 관리계획서 PDF 대조, QC_CONTROL_PLAN 이관은 미실시
- 현재 상태: 검증대기

## 완료한 것

- 20페이지 스캔 PDF를 시계방향 회전 후 공정 흐름 판독
- HANES 메뉴/엔티티/공정상수와 대조
- 결과: `docs/reports/2026-09-14-thn-control-plan-hanes-gap.md`
- PDF 텍스트화: `docs/guides/thn-control-plan.md`
- RAG 기본 대상에 `docs/guides` 추가 (백엔드 DEFAULT_KNOWLEDGE_TARGETS + AiEmbeddingPanel)

## 미완료 / 남은 것

- 청킹+임베딩 재생성 실행 (시스템설정 Embedding 탭 또는 reindex-knowledge.ts)
- 검색 테스트: "크림프하이트 공차", "기밀 0.3bar"
- CONTROL_PLANS/IQC 마스터 시드는 지식검색 이후 별도

## 변경 파일

- `docs/reports/2026-09-14-thn-control-plan-hanes-gap.md`: 대조표
- 본 미완료 기록

## 검증 상태

- 코드 변경 없음. 브라우저/DB 미실시.

## 재개 방법

- 품목코드(또는 대표 전장품번)와 이관 축(Control Plan / IQC / 압착SPC / 검사프로토콜)을 정하면 시드 SQL + 화면 확인부터.
