# AI 채팅 2단계 설계 (MES 데이터 질의 — text-to-SQL)

작성일: 2026-06-22
상태: 설계 확정 (구현 대기)
선행: 1단계(2026-06-22-ai-chat-phase1-design.md, Mistral 일반 대화)

## 목표

AI 채팅에서 자연어로 MES 데이터를 질의한다. 자연어 → 테이블 선택 → Oracle SQL 생성 → 검증 → 조회/승인실행 → 분석(마크다운 표). 참조: `C:\project\wbsmaster` 의 `src/lib/llm/index.ts`(generateSQL/validateSQL/processChatMessage 2단계 파이프라인)를 HANES(NestJS+Oracle+TypeORM)로 변환.

## 결정사항 (확정)

- **SQL 범위**: 조회(SELECT)는 자유 실행, 쓰기(INSERT/UPDATE)는 생성 SQL을 사용자에게 보여주고 **승인 후 실행**. DELETE/DDL 차단.
- **스키마 노출**: 전체 테이블. wbsmaster식 2단계 파이프라인(테이블 요약 → LLM 선택 → 선택 테이블 스키마로 SQL 생성)으로 토큰 관리.
- **응답 형식**: 텍스트 + 표(마크다운). 차트/마인드맵 없음.
- **구현**: 2a(조회) + 2b(쓰기 승인) 한 번에.

## 흐름 (`POST /ai/chat` 확장)

모든 메시지를 데이터 질의로 시도하고, SQL이 안 나오면(NO_SQL) 1단계 일반 대화로 폴백:

1. **테이블 선택**: 전체 테이블 요약(테이블명+설명) → LLM → 관련 테이블 JSON 배열
2. **SQL 생성**: 선택 테이블 컬럼 스키마 + `company='40'/plant_cd='1000'` 컨텍스트 → LLM → Oracle SQL (또는 NO_SQL)
3. **검증**(SqlValidator):
   - 허용: SELECT/INSERT/UPDATE/WITH. 차단: DELETE/DROP/TRUNCATE/ALTER/GRANT/REVOKE/EXEC/다중쿼리(;)
   - UPDATE는 WHERE 필수
   - **SELECT** → 즉시 실행(읽기전용, ROWNUM≤100)
   - **INSERT/UPDATE** → 실행 안 함, 승인 대기 플래그
4. **분석**: SELECT 결과 JSON → LLM → 마크다운(표 포함)
5. **쓰기 승인**: INSERT/UPDATE면 `{ content(설명), sql, requiresApproval: true }` 반환 → 프론트 승인 카드 → `POST /ai/execute-sql { sql }` → 재검증 후 실행 → 결과

## 백엔드 (ai 모듈 확장, 단위 분리)

- **SchemaInfoService** (`schema-info.service.ts`)
  - `getTableSummaries()`: TypeORM `dataSource.entityMetadatas` → `[{ table, columns수, 주요컬럼 }]` 요약(1단계 테이블 선택용)
  - `getTableSchemas(tables: string[])`: 선택 테이블의 컬럼명/타입(2단계 SQL 생성용)
  - 민감 테이블(USER_AUTH, USER, ROLE 등)은 요약/스키마에서 제외
- **SqlValidatorService** (`sql-validator.service.ts`)
  - `validate(sql)`: `{ valid, error?, kind: 'select'|'write' }`. Oracle 문법 기준 차단/허용/단일쿼리/WHERE 검사
- **AiSqlService** (`ai-sql.service.ts`)
  - `process(messages)`: 테이블선택 → SQL생성 → 검증 → SELECT 실행+분석 / 쓰기 승인대기. LLM 호출은 AiService(Mistral) 재사용
  - `executeApproved(sql)`: 재검증(write만) → 실행
  - 실행: `dataSource.query(sql)` (SELECT는 READ ONLY 트랜잭션 + 타임아웃, 행수 100 제한)
- **AiController**: `POST /ai/chat`(데이터질의 통합), `POST /ai/execute-sql`(승인 실행)
- LLM 호출: 1단계 AiService의 Mistral 클라이언트 재사용(공통화)

## 프론트

- **react-markdown** 설치 → `AiChatPanel`의 assistant 메시지를 마크다운 렌더(표/목록/강조)
- **쓰기 승인 카드**: `requiresApproval` 응답 시 생성 SQL(코드블록) + [실행]/[취소] 버튼 → `POST /ai/execute-sql`
- 응답 메타: `sql`(실행된 쿼리, 접기), `executed`/`rowCount` 표시

## 보안 안전장치

- 차단: DELETE/DROP/TRUNCATE/ALTER/GRANT/REVOKE/EXEC/CREATE/다중쿼리/시스템객체(`SYS_`, `DBMS_`)
- SELECT: READ ONLY 트랜잭션(자동 롤백), 쿼리 타임아웃, ROWNUM≤100
- INSERT/UPDATE: 승인 후 실행, `execute-sql`에서 재검증(write kind만 허용)
- company/plant 스코프: 프롬프트로 강제(`WHERE COMPANY='40' AND PLANT_CD='1000'`)
- 민감 테이블 스키마 미노출
- LLM 응답의 SQL 코드블록/마크다운 펜스 제거 후 검증

## YAGNI (제외)

차트·마인드맵·대화이력 DB저장·SQL 자동수정 루프 없음.

## 구현 순서

1. react-markdown 설치(frontend)
2. SchemaInfoService(entityMetadatas → 요약/스키마, 민감테이블 제외)
3. SqlValidatorService(Oracle 검증)
4. AiSqlService(파이프라인) + AiService LLM 공통화
5. AiController 확장(/ai/chat 데이터질의, /ai/execute-sql)
6. AiChatPanel 마크다운 + 승인 카드
7. i18n, 타입 체크, 검증
