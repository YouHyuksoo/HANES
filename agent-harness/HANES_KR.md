# HANES MES — CLI Harness SOP

## 개요 (Overview)

HANES MES (HARNESS Manufacturing Execution System)는 와이어 하네스 제조를 위한 웹 기반 MES로, Oracle DB를 기반으로 NestJS(백엔드)와 Next.js(프론트엔드)로 구축되었습니다.

CLI Harness는 REST API(`http://localhost:3003/api/v1`)를 래핑하여 AI 에이전트와 파워 유저가 브라우저 없이 MES를 운영할 수 있도록 합니다.

## 소프트웨어 종속성 (Software Dependency)

- **HANES MES 백엔드**는 `localhost:3003`(또는 설정된 URL)에서 실행 중이어야 합니다.
- 시작 방법: `cd apps/backend && pnpm dev` 또는 `pm2 start ecosystem.config.js`
- API 문서 위치: `http://localhost:3003/api/docs` (Swagger)

## 아키텍처 (Architecture)

```
CLI (Click + REPL)
  └── hanes_backend.py (HTTP 클라이언트)
        └── HANES MES Backend API (NestJS, 포트 3003)
              └── Oracle Database
```

## 인증 (Authentication)

- Bearer 토큰 = 사용자 이메일
- 헤더: `Authorization: Bearer <이메일>`, `X-Company: <코드>`, `X-Plant: <코드>`
- 로그인: `POST /api/v1/auth/login { email, password }`

## 명령어 그룹 (Command Groups)

| 그룹 (Group)    | API 접두사 (API Prefix)  | 작업 (Operations)                                  |
|-----------------|--------------------------|----------------------------------------------------|
| auth            | /auth                    | 로그인, 내 정보, 가입(register)                    |
| master          | /master                  | 부품(parts), 공정(processes), bom, 라우팅(routing) |
| material        | /material                | 입고(arrivals), 로트(lots), 재고(stocks), 수령(receiving) |
| production      | /production              | 작업 지시(job-orders), 실적(results), 계획(plans)  |
| quality         | /quality                 | 검사(inspects), 재작업(reworks), 불량(defects)     |
| inventory       | /inventory               | 재고(stocks), 트랜잭션(transactions), 창고(warehouses) |
| equipment       | /equipment               | 설비(equips), 검사(inspects), 예방보전계획(pm-plans) |
| consumables     | /consumables             | 재고(stocks), 불출(issuing), 수령(receiving)       |
| shipping        | /shipping                | 주문(orders), 출하(shipments), 반품(returns)       |
| dashboard       | /dashboard               | KPI, 요약 통계(summaries)                          |

## 상태 모델 (State Model)

세션 상태(JSON으로 지속됨):
- `base_url`: API 엔드포인트 (기본값: http://localhost:3003/api/v1)
- `token`: Bearer 토큰 (이메일)
- `company`: 활성 회사 코드
- `plant`: 활성 공장 코드
- `last_login`: 타임스탬프

## 출력 모드 (Output Modes)

- **Human**: 색상이 포함된 형식화된 테이블 (기본값)
- **JSON**: 원시 API 응답 (`--json` 플래그)
