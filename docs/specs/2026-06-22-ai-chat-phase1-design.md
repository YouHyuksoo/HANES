# AI 채팅 1단계 설계 (Mistral 연동 + 일반 대화)

작성일: 2026-06-22
상태: 설계 확정 (구현 대기)

## 목표

HANES MES에 AI 채팅 기능을 추가한다. 우하단 FAB의 "AI 채팅" 액션으로 우측 슬라이드 패널을 열어 Mistral 모델과 대화한다. `/system/config`에 AI 설정 탭을 추가해 provider/model/활성화를 관리한다. (참조: `C:\project\wbsmaster` 의 `src/lib/llm/index.ts` — MistralClient 패턴)

## 범위 (단계 분해)

- **1단계 (이 spec)**: AI 설정 탭 + Mistral 백엔드 연동 + 일반 대화 채팅 패널. **한 번에 구현**(설정 Part A + 채팅 Part B).
- **2단계 (후속 별도 spec)**: MES 데이터 질의(Oracle text-to-SQL), 대화 이력 DB 저장, 스트리밍 응답.

## 아키텍처

```
프론트(AiChatPanel) ──POST /ai/chat──▶ NestJS AiService ──▶ @mistralai/mistralai ──▶ Mistral API
                                          (키: 백엔드 .env MISTRAL_API_KEY)
config 탭(provider/model/활성화) ──▶ sys-configs(AI 그룹, 키 아님 평문)
```

원칙: **LLM 호출과 API 키는 NestJS 백엔드에만**. 프론트로 키가 절대 노출되지 않는다.

## 백엔드 — 신규 `apps/backend/src/modules/ai/`

- 의존성: `@mistralai/mistralai` 추가 (pnpm, backend workspace)
- API 키: `process.env.MISTRAL_API_KEY` — DB 저장 안 함. **wbsmaster `.env`의 `MISTRAL_API_KEY` 값을 HANES `apps/backend/.env`로 복사**(.env는 gitignore, 커밋 금지).
- provider/model/활성화: `sys-configs`의 새 `AI` 그룹
  - `AI_PROVIDER` = `mistral`
  - `AI_MODEL` = `mistral-small-latest`
  - `AI_ENABLED` = `Y`
- 구성: `ai.module.ts`, `ai.controller.ts`, `ai.service.ts`
- 엔드포인트:
  - `GET /ai/status` → `{ enabled, provider, model, keyConfigured: boolean }`
    - sys-config(enabled/provider/model) + `!!process.env.MISTRAL_API_KEY`. config 탭 상태/연결 표시용. 키 원문은 반환하지 않는다.
  - `POST /ai/chat` → body `{ messages: [{ role: 'system'|'user'|'assistant', content: string }] }`
    - AI_ENABLED='Y' + 키 존재 확인 → Mistral `chat.complete({ model, messages })` → `{ content }`
    - 1단계 system 프롬프트(서버에서 선두 주입): "당신은 HANES MES 운영을 돕는 AI 비서입니다. 한국어로 간결하게 답합니다." (text-to-SQL 없음)
    - 비활성/키 없음 → 400과 안내 메시지

## 프론트

### config 탭 (`system/config/page.tsx`)
- `CONFIG_GROUPS`에 `{ key: 'AI', label: 'system.config.group.AI', icon: Sparkles }` 추가
- `AI_PROVIDER/AI_MODEL/AI_ENABLED` 3개 sys-config를 `AI` 그룹으로 seed → 기존 `ConfigItemRow`로 편집
- 탭 상단에 `GET /ai/status` 결과로 **키 설정 여부 + 연결 상태** 배너 표시(키 미설정 시 .env 안내)

### 채팅 패널 (`components/ai/AiChatPanel.tsx`)
- 우측 슬라이드 패널(`w-[420px]` 내외, `animate-slide-in-right`) — 기존 패널 패턴 일치
- 구성: 헤더(제목+닫기) / 메시지 목록(user·assistant 말풍선) / 입력창(Enter 전송)
- 상태: 메시지 배열(세션 메모리, DB 저장 안 함), 전송 중 로딩
- `POST /ai/chat`에 누적 messages 전달 → 응답 append
- 전역 store(`stores/aiChatStore.ts`): `isOpen`, open/close. MainLayout에 패널 마운트.

### FAB 연결 (`components/improvement/ImprovementFAB.tsx`)
- AI채팅 액션 onClick: 현재 안내 toast → `aiChatStore.open()` 으로 교체

## 데이터 흐름

사용자 입력 → 패널이 messages에 append → `POST /ai/chat {messages}` → AiService가 AI_ENABLED·키 확인 → system 프롬프트 주입 → Mistral 호출 → `{content}` → 패널이 assistant 메시지 append.

## 결정사항 / YAGNI (1단계 제외)

- 대화 이력 DB 저장 안 함 → 세션 메모리만 (패널 닫으면 초기화)
- 스트리밍 없음 → 단순 요청-응답
- text-to-SQL(MES 질의) 없음 → 2단계
- provider는 `mistral` 고정(추상화는 두되 1단계는 Mistral만 구현)

## i18n

신규 라벨(채팅 패널, config AI 그룹, 상태 배너)은 ko/en/zh/vi 4파일 등록. (`scripts/find_missing_i18n.js` 로 누락 점검 후 `apply_missing_i18n.js`)

## 구현 순서

1. 백엔드: `@mistralai/mistralai` 설치, `ai` 모듈(status·chat), .env 키 복사
2. sys-config `AI` 그룹 seed(provider/model/enabled)
3. 프론트: `aiChatStore` + `AiChatPanel` + MainLayout 마운트 + FAB 연결
4. config 탭 AI 그룹 + 상태 배너
5. i18n 4파일, 타입 체크, 연결 검증
