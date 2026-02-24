# NotebookLM - HANES MES 프로젝트 전용 설정

## 프로젝트 Notebook ID

| 노트북 | ID | 용도 |
|--------|-----|------|
| HANES MES 지식 베이스 | `66443db6-3c90-4b35-9c71-542716c7b1e2` | 프로젝트 아키텍처, 비즈니스 로직, API 명세, 의사결정 기록 |
| HANES MES 디버깅 노트북 | `51b44d0d-3265-4493-9b68-862c2863ee5b` | 이슈 해결 패턴, 트러블슈팅 가이드, 알려진 버그 및 해결책 |
| HANES MES 보안 핸드북 | `e49ed7a9-fc4e-4c10-93af-86e0611c1316` | 보안 체크리스트, 인증/권한 정책, 데이터 암호화 규칙 |

## 프로젝트별 활용 가이드

### 1. MES 도메인 지식 관리
- 하네스 제조 공정 용어, BOM 구조, 생산 흐름 등을 NotebookLM에 문서화
- 신규 개발자 온보딩 시 NotebookLM 쿼리로 빠른 학습 지원

### 2. API 명세 및 데이터 모델
- Prisma 스키마 변경 시 NotebookLM에 변경 이력 기록
- API 엔드포인트 추가 시 즉시 문서화

### 3. 비즈니스 로직 결정 사항
- "왜 이렇게 구현했는가?"에 대한 답을 NotebookLM에 기록
- 공통코드 추가/변경 시 사유와 영향 범위 문서화

### 설정 완료 후 확인 사항

```bash
nlm notebook query 66443db6-3c90-4b35-9c71-542716c7b1e2 "HANES MES 프로젝트의 주요 기술 스택은?"
# 예상 답변: Next.js 14, NestJS, Prisma, Supabase, Turborepo, pnpm
```
