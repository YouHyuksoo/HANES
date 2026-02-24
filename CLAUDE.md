# HARNESS MES 프로젝트 설정

## 패키지 매니저

- **pnpm 전용** (`pnpm@10.28.1`) — npm 사용 금지
- Turborepo + pnpm 모노레포 구조
- 명령어: `pnpm install`, `pnpm dev`, `pnpm build`

## Supabase

- 연결 실패 시 → [docs/supabase-connection.md](docs/supabase-connection.md) 참조
- Pooler 주소는 **절대 추정 금지**, Dashboard에서 직접 복사

## UI 규칙

- `alert()`, `confirm()`, `prompt()` 사용 금지 — Modal/ConfirmModal 사용
- 통계 카드는 `StatCard` 컴포넌트(`@/components/ui`) 사용

## 공통코드(ComCode)

- 코드값 컬럼은 반드시 `ComCodeBadge` + `useComCodeOptions` 사용
- 하드코딩된 한국어 라벨/색상 **절대 금지**
- 상세 사용법 → [docs/comcode-guide.md](docs/comcode-guide.md) 참조

## NotebookLM

- 지식 베이스: `66443db6-3c90-4b35-9c71-542716c7b1e2`
- 디버깅: `51b44d0d-3265-4493-9b68-862c2863ee5b`
- 보안: `e49ed7a9-fc4e-4c10-93af-86e0611c1316`
- 상세 설정 → [docs/notebooklm-setup.md](docs/notebooklm-setup.md) 참조
