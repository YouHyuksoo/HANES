# HANES MES 프로젝트 설정

## 패키지 매니저

**이 프로젝트는 pnpm을 사용함!**

```json
"packageManager": "pnpm@10.28.1"
```

- npm 사용 금지, 반드시 pnpm 사용
- 명령어: `pnpm install`, `pnpm dev`, `pnpm build`
- Turborepo + pnpm 모노레포 구조

---

## Supabase 연결 체크리스트

**연결 실패 시 반드시 이 순서로 확인할 것!**

### 1. Pooler 주소 확인 (가장 중요!)
- `aws-0` vs `aws-1` 등 숫자가 리전마다 다름
- **절대 추정하지 말고** Supabase Dashboard에서 직접 복사할 것
- Dashboard 경로: Settings > Database > Connection string

### 2. 올바른 연결 문자열 형식
```env
# Transaction pooler (포트 6543) - 일반 쿼리용
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-[N]-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Session pooler (포트 5432) - Migration/Introspection용
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-[N]-[REGION].pooler.supabase.com:5432/postgres"
```

### 3. 체크 포인트
| 항목 | 확인 내용 |
|------|----------|
| aws-N | Dashboard에서 정확한 숫자 확인 (0, 1, 2 등) |
| 리전 | 프로젝트 리전과 일치하는지 (ap-northeast-2 등) |
| 포트 | Transaction=6543, Session=5432 |
| pgbouncer | Transaction pooler는 `?pgbouncer=true` 필수 |

### 4. 현재 프로젝트 정보
- **Project ID**: `YOUR_PROJECT_REF`
- **Project Name**: `hanes-mes`
- **Region**: `ap-northeast-2`
- **Pooler 주소**: `YOUR_POOLER_HOST`

---

## Prisma 작업 순서

```bash
# 1. 스키마 가져오기 (Supabase에서)
npx prisma db pull

# 2. Client 생성 (필수!)
npx prisma generate

# 3. 서버 재시작
pnpm dev
```
