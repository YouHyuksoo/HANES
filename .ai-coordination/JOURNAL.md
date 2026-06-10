# JOURNAL

## 2026-06-10

### 완료: workflow 문서 전체 구조화
- 입하→IQC→입고→재고→출고요청→출고처리 워크플로우 점검
- 엔티티-DB 불일치 6건, 상태값-공통코드 불일치 8건 발견/수정
- COM_CODES 마이그레이션 적용 (JUDGE_YN, INSPECT_TYPE)
- 엔티티 4건 수정 (mat-arrival, iqc-log, mat-issue, mat-lot)
- docs/ 불필요 파일 10개 삭제
- docs/reports/db-schema-erd.md 갱신
- domain-workflows.md 전면 갱신 (209→321행)
- 표준 템플릿 docs/workflows/_template.md 작성
- workflow 문서 9개 전체 작성 완료:
  - material/wf-material-receipt.md (입하/입고/LOT 9화면)
  - material/wf-material-issue.md (출고/재고/조정 10화면)
  - production/wf-production.md (생산 15화면)
  - quality/wf-quality.md (품질 19화면)
  - shipping/wf-shipping.md (출하 8화면)
  - equipment/wf-equipment.md (설비 11화면)
  - master/wf-master.md (기준정보 15화면)
  - system/wf-system.md (시스템 11화면)
  - system/wf-others.md (기타 16+화면 요약)
- domain-workflows.md → 메인 인덱스 전환 완료

### 다음 세션 작업 제안
- workflow 문서 품질 검토 (각 subagent 생성 결과 확인)
- 실제 테스트로 문서와 구현 간 불일치 재확인
