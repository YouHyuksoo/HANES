# AI 채팅 — 출처 표시 및 좋아요/싫어요/복사 기능 설계

- 작성일: 2026-07-01
- 관련 대화: `apps/frontend/src/components/ai/AiChatPanel.tsx`, `apps/backend/src/modules/ai/ai-sql.service.ts`, `apps/backend/src/modules/ai-knowledge/`
- 배경: AI 채팅이 RAG 지식검색 결과를 답변 생성에 사용하고 있지만(2026-07-01 `ai-knowledge.service.ts` bm25 점수 역전 버그 수정 완료), 어떤 문서를 근거로 답했는지 프론트에서 구조적으로 확인할 방법이 없다. 또한 응답 품질을 사용자가 직접 평가(좋아요/싫어요)하고 복사할 수 있는 UI가 없다.

## 목표

1. AI 답변 하단에 실제로 참조한 지식 청크(출처)를 인라인 확장 목록으로 보여주고, 클릭하면 도움말 패널이 해당 문서/섹션으로 열리게 한다.
2. 모든 assistant 응답 하단에 복사·좋아요·싫어요 버튼을 추가한다. 좋아요/싫어요는 DB에 저장해 추후 답변 품질 분석에 쓴다.

## 범위 밖

- 저장된 피드백을 조회/분석하는 대시보드 UI (이번엔 저장까지만, 조회 화면은 별도 요청 시 진행)
- 채팅 히스토리 자체의 영속화(세션 메모리 유지 정책은 그대로 유지)
- 출처가 없는 경우(순수 일반 대화, SQL 조회 결과 분석 등)의 별도 처리 — 출처가 없으면 출처 목록 UI 자체를 표시하지 않는다.

## 1. 출처(Sources) 표시

### 1.1 백엔드

`AiSqlService.process()`는 이미 최상단에서 `knowledge.search()`로 `knowledgeChunks`를 얻어 `knowledgePrompt` 문자열(LLM 프롬프트 삽입용)로만 사용하고 버린다. 이 배열을 응답에도 실어 보낸다.

- `knowledgeChunks`(`KnowledgeSearchResult[]`)를 요약 DTO로 변환하는 헬퍼 `toSourceSummaries(chunks)` 추가: `{ chunkId, title, heading, sourcePath, menuCode, audience, score }`.
- `process()` 내부의 여러 `return` 지점(일반대화 폴백, 페이지 도구 제안, SQL 승인 대기, SQL 분석 완료, 보안 위반 등)을 개별 수정하는 대신, 함수 본문을 그대로 두고 **모든 반환값을 감싸는 단일 지점**에서 `sources`를 병합한다:
  - 현재 함수를 `processInner(...)`로 이름만 바꾸고 로직은 그대로 유지.
  - 새 `process(...)`는 `const chunks = await this.searchKnowledge(...); const result = await this.processInner(messages, pageToolContext, knowledgeContext, chunks); return chunks.length ? { ...result, sources: toSourceSummaries(chunks) } : result;` 형태로 감싼다.
  - `processInner`는 기존 `knowledgePrompt` 계산 로직(검색 자체)을 그대로 갖되, 검색 결과를 인자로 받도록 시그니처만 조정.
- `AiSqlResult` 타입에 `sources?: AiKnowledgeSourceDto[]` 필드 추가.
- 응답 DTO(`ai-chat.dto.ts` 또는 result 타입 정의 위치)에 `AiKnowledgeSourceDto` 추가.

### 1.2 프론트엔드 — 출처 목록

- `AiChatMessage`(`aiChatStore.ts`)에 `sources?: AiKnowledgeSource[]` 추가.
- `AiChatPanel.tsx`의 assistant 메시지 렌더링 하단에 `sources`가 있을 때만 `[출처 N건 ▾]` 토글 버튼 표시. 펼치면 각 항목에 `title > heading` + `menuCode`(뱃지)를 보여주는 리스트.
- 각 항목 클릭 시 도움말 패널을 해당 문서로 강제 오픈.

### 1.3 프론트엔드 — 도움말 패널 딥링크

- `helpStore`에 오버라이드 상태 추가:
  ```ts
  overrideMenuCode?: string;
  overrideTab?: HelpTab;
  overrideHeading?: string; // rehype-slug 규칙과 동일한 slug 문자열
  openHelpFor: (menuCode: string, tab: HelpTab, heading?: string) => void; // isOpen=true + override 설정
  closeHelp: () => void; // 기존 로직 유지 + override 클리어
  ```
- `HelpPanel.tsx`: `const menuCode = overrideMenuCode ?? findMenuCodeByPath(pathname);`, `tab`도 override 있으면 우선. `content` 로드 완료 후 `overrideHeading`이 있으면 해당 id 엘리먼트로 `scrollIntoView`.
- `MarkdownRenderer.tsx`에 `rehype-slug` 플러그인 추가(헤딩에 `id` 자동 부여, github-slugger 규칙 — 한글 포함 그대로 유지됨). 지식 청크의 `heading` 텍스트를 동일한 slug 규칙으로 변환하는 작은 유틸(`slugify`)을 프론트에 추가해 `overrideHeading`에 넘긴다.
- 실패(섹션을 못 찾음) 시 그냥 문서 맨 위로 열리는 것으로 충분 — 별도 에러 처리 불필요.

## 2. 좋아요/싫어요 (DB 저장)

### 2.1 데이터 모델

새 테이블 `AI_CHAT_FEEDBACKS` (Oracle):

| 컬럼 | 타입 | 설명 |
|---|---|---|
| FEEDBACK_ID | NUMBER PK | `AI_CHAT_FEEDBACK_SEQ` 채번 |
| COMPANY | VARCHAR2(10) | 헤더(X-Company)에서 추출 |
| PLANT_CD | VARCHAR2(10) | 헤더(X-Plant)에서 추출 |
| ROUTE | VARCHAR2(200) NULL | 질문 당시 프론트 경로 |
| MENU_CODE | VARCHAR2(50) NULL | 질문 당시 메뉴 코드 |
| QUESTION | CLOB | 마지막 사용자 질문 |
| ANSWER | CLOB | assistant 응답 원문(markdown) |
| SOURCES_JSON | CLOB NULL | 해당 응답의 `sources` 스냅샷(JSON) |
| RATING | VARCHAR2(10) | `LIKE` \| `DISLIKE` |
| CREATED_BY | VARCHAR2(50) | 로그인 사용자 |
| CREATED_AT | TIMESTAMP DEFAULT SYSTIMESTAMP | |

마이그레이션 파일: `apps/backend/src/migrations/2026-07-01_ai_chat_feedbacks.sql` (CREATE TABLE + SEQUENCE, 실행은 oracle-db 커넥터로 적용).

### 2.2 백엔드 API

`AiController`에 추가:
- `POST /ai/chat/feedback` — body: `{ question, answer, sources?, route?, menuCode?, rating: 'LIKE'|'DISLIKE' }` → INSERT 후 `{ id }` 반환.
- `DELETE /ai/chat/feedback/:id` — 토글 해제/철회.

새 `AiFeedbackService`(`ai-feedback.service.ts`)가 레포지토리 CRUD 담당. `CREATED_BY`/`COMPANY`/`PLANT_CD`는 `activity-log.controller.ts`가 쓰는 것과 동일한 패턴 — `@Req() req: Request`에서 `getRequestUser(req)`(`common/utils/request-user.util.ts`)로 `user.id`, `getHeaderString(req.headers['x-company']/['x-plant'])`(또는 `user.company`/`user.plant` 폴백)로 테넌트를 추출한다.

### 2.3 프론트엔드

- `AiChatMessage`에 `feedbackId?: number`, `rating?: 'LIKE' | 'DISLIKE'` 추가.
- 메시지 하단 액션 줄: `[복사] [👍] [👎]`.
- 클릭 동작:
  - 처음 클릭 → `POST /ai/chat/feedback` 호출, 성공 시 메시지 상태에 `feedbackId`, `rating` 저장하고 버튼 강조.
  - 같은 버튼 다시 클릭(토글 해제) → `DELETE /ai/chat/feedback/:feedbackId`, 상태 초기화.
  - 반대 버튼 클릭(👍 상태에서 👎 클릭) → 기존 것 DELETE 후 새로 POST, 상태 갱신.
- 모든 assistant 메시지에 노출(출처 유무와 무관).

## 3. 복사 버튼

- `navigator.clipboard.writeText(message.content)` — 마크다운 원문 그대로 복사. 성공 시 아이콘을 잠깐 체크 아이콘으로 바꿔 피드백(토스트 불필요).

## 4. 변경 파일 목록 (예상)

**백엔드**
- `apps/backend/src/entities/ai-chat-feedback.entity.ts` (신규)
- `apps/backend/src/migrations/2026-07-01_ai_chat_feedbacks.sql` (신규)
- `apps/backend/src/modules/ai/services/ai-feedback.service.ts` (신규) 또는 `ai-sql.service.ts` 옆에 배치
- `apps/backend/src/modules/ai/ai-sql.service.ts` (process 래핑, sources 병합)
- `apps/backend/src/modules/ai/ai.controller.ts` (feedback 엔드포인트 2개)
- `apps/backend/src/modules/ai/ai.module.ts` (신규 서비스/엔티티 등록)
- `apps/backend/src/modules/ai/dto/ai-chat.dto.ts` (`AiKnowledgeSourceDto`, `AiChatFeedbackDto`)

**프론트엔드**
- `apps/frontend/src/stores/aiChatStore.ts` (`sources`, `feedbackId`, `rating` 필드)
- `apps/frontend/src/stores/helpStore.ts` (`openHelpFor` 오버라이드)
- `apps/frontend/src/components/help/HelpPanel.tsx` (오버라이드 우선 사용 + 스크롤)
- `apps/frontend/src/components/help/MarkdownRenderer.tsx` (`rehype-slug`)
- `apps/frontend/src/components/ai/AiChatPanel.tsx` (출처 목록 + 액션 버튼 UI, feedback API 연동)
- (신규 유틸) heading → slug 변환 함수 — 프론트 공용 위치(`@/lib/help.ts` 등)

## 5. 검증 계획

- `pnpm --filter @harness/backend exec tsc --noEmit`
- `pnpm --filter @harness/frontend exec tsc --noEmit`
- 마이그레이션은 oracle-db 커넥터로 적용 후 `DESC AI_CHAT_FEEDBACKS`로 확인
- 브라우저에서 실제로: (1) SHIP_ORDER 관련 질문 → 출처 목록 노출 → 클릭 → 도움말 패널이 해당 섹션으로 스크롤되는지, (2) 좋아요 클릭 → DB에 행 생성 확인 → 다시 클릭(토글 해제) → 행 삭제 확인, (3) 복사 버튼 동작 확인
