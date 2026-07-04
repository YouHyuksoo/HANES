# AI RAG golden 질문 평가 세트

- 작성일: 2026-07-04
- 대상: AI RAG 파이프라인 v2 (질의이해→RRF→그래프확장→리랭크, `docs/superpowers/specs/2026-07-04-ai-rag-pipeline-v2-design.md`)
- 평가 방법: `POST /api/v1/ai/chat`에 페르소나별 질문 실행, 답변이 기대 근거를 인용하고 단편적이지 않은지 확인.
- 트레이스: `apps/backend/data/ai-knowledge/pipeline-trace.jsonl` (질의이해/메뉴매핑/최종청크 기록)

## 질문 세트와 2026-07-04 실측 결과

### 화면 사용법 (persona: user)
| # | 질문 | 기대 근거 | 결과 |
|---|---|---|---|
| 1 | 박스입고는 어떻게 해? | PROD_RECEIVE 사용자 도움말 | **O** — 스캔→창고선택→입고 절차 + 입고불가 안내 |
| 2 | 작업지시는 어디서 등록해? | PROD_ORDER 도움말 | **O** — 계획 확정→발행 흐름·잔여수량 통제까지 정확 |
| 3 | 불량 등록 방법 알려줘 | 불량관리 도움말 | **O** — QC_DEFECT 절차(바코드/유형/수량/저장, WAIT 상태) 정확 |

### 워크플로우 전후관계 (persona: user)
| # | 질문 | 기대 근거 | 결과 |
|---|---|---|---|
| 4 | 작업지시 내리고 나면 다음에 뭐 해야 돼? | production-flow 후행 단계 | **O** — 계획→작업지시→입력키오스크 순서로 답변, 워크플로우 문서 인용 |
| 5 | 박스입고 하기 전에 뭘 먼저 해야 해? | 선행 조건(SHIP_PACK) | **O** — "선행 메뉴: SHIP_PACK → 현재: PROD_RECEIVE" 구조로 답변 |
| 6 | 생산계획부터 입고까지 전체 순서를 알려줘 | production-flow 전체 | **O** — production-flow.md 인용, 단계 순서·상태 전이 포함 |

### 문제 해결 (persona: operator)
| # | 질문 | 기대 근거 | 결과 |
|---|---|---|---|
| 7 | 라벨 발행이 안 되는데 왜? | troubleshooting 증상 매칭 | **O** — 증상별(입하라벨/SG라벨/화면 미표시) 원인 후보→조치 구조로 답변 |
| 8 | 입고가 안 돼요 | 선행 조건 미충족 후보 | **O** — 증상별 원인·확인 방법(FG_LABELS.INVENTORY_STATE 등) |
| 9 | 실적 취소는 어떻게 하고 재고는 어떻게 돼? | 운영자 도움말 | **△** — 질의 모호("실적"→입하실적으로 해석, 답변 자체는 정확). 실사용 시 화면 menuCode 컨텍스트로 해소 |

### 엔지니어 (persona: engineer)
| # | 질문 | 기대 근거 | 결과 |
|---|---|---|---|
| 10 | 박스입고 저장하면 어떤 테이블이 바뀌어? | business-logics PROD_RECEIVE | **O** — PRODUCT_STOCKS·FG_LABELS 정답 (아래 수정 3건 반영 후) |
| 11 | 작업지시 상태 전이 규칙 알려줘 | WAITING/RUNNING/... | **O** — 5개 상태 전이+조건(실적 없을 때만 취소 등) 정확 |
| 12 | 생산실적 삭제 시 역분개 로직 설명해줘 | business-logics PROD_RESULT | **O** — API/서비스/테이블 영향(PROD_RESULTS·PRODUCT_STOCKS·WIP_MAT_STOCKS 복원) 정확 |

## 평가 중 발견·수정한 결함 (Task 9)

1. **기본 청킹 대상에 `docs/business-logics` 누락** (`abc6cefa`) — engineer 페르소나의 근거 문서 163개가 기본 인덱스에 없었음. 기본 타깃에 추가.
2. **business-logics 문서 menu_code NULL** (`6307f234`) — frontmatter가 없어 메뉴 연결이 끊겨 있었음(기존 engineer 부스트도 사실상 미동작). 파일명(=메뉴코드) 기반 보강 + engineer 의도 시 business-logics 청크 강제 포함(스펙 6장 [3] 구현 누락 보완).
3. **질의이해 LLM이 메뉴코드를 알 수 없음** (`7e21289f`) — "박스입고"(사용자 용어)→PROD_RECEIVE(공식 코드) 매핑 불가. 질의이해 프롬프트에 메뉴 사전(menuCode=화면명, 도움말 인덱스에서 생성) 주입. 수정 후 질의 재작성("제품입고 저장 시 변경되는 테이블")과 메뉴 매핑이 정확해짐.
4. **관찰 가능성 부재** (`d7f021a4`) — 파이프라인 트레이스(jsonl) 추가. 이후 검색 품질 튜닝은 이 트레이스 기준으로 진행.

## 재인덱싱 실측

- 문서 485개 → 청크 5,794개, 그래프 엣지 87개, workflowErrors/Warnings 0
- 임베딩: OpenAI(text-embedding-3-small), 변경 청크만 재임베딩(캐시 재사용 확인)

## 최종 결과 (2026-07-04 전수 실측)

- **12문항 중 11 O, 1 △** (문항 9: menuCode 컨텍스트 없는 모호 질의 — 실사용 화면 컨텍스트에서 해소, 답변 내용 자체는 근거 정확)
- 후속 처리 완료: SHIP_PALLET_SHIP 실구현 확인(page.tsx + POST :id/ship-pallets) 후 shipping-flow 편입(그래프 87→90엣지); getBusinessLogicChunks 입력 우선순위 배분; 그래프 확장 볼륨 트림(출처 과다 완화)
