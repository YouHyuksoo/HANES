# AGENTS.md - HANES MES 프로젝트 가이드

## ⚠️ Corrections & Learnings (실수 방지 기록)

### 2025-02-24

#### 1. 도구 식별 명확화
- **실수**: 사용자가 Claude Code CLI임을 명시했음에도 Kimi Code CLI 관련 설명으로 혼란을 줄 수 있었음
- **교훈**: 
  - 사용자가 사용하는 도구(Claude Code CLI)와 내가 동일하지 않음을 명확히 인지
  - 스킬/설정 경로는 사용자의 환경(`.claude/`)과 내 환경(`.agents/skills/`)이 다름
  - 사용자 환경 정보는 직접 물어보거나 명시적 확인 필요

#### 2. 스킬 경로 구분
- **사실 확인**:
  - **Claude Code CLI**: `~/.claude/skills/` 또는 프로젝트 내 `.claude/`
  - **Kimi Code CLI**: `~/.agents/skills/`
- **교훈**: 두 시스템은 완전히 분리되어 있음. 교차 참조하지 않도록 주의

---

## 📝 프로젝트 컨텍스트

### 프로젝트 정보
- **이름**: HANES MES (Manufacturing Execution System)
- **스택**: NestJS + TypeORM + Oracle Database
- **구조**: Turborepo 모노레포
- **DB 사이트**: JSHANES (10.1.10.35:1527/JSHNSMES)

### 주의사항
- TypeORM CLI는 ES Module 이슈로 직접 사용 불가 → Raw SQL via oracle-db Python connector 사용
- 마이그레이션 파일은 `apps/backend/src/migrations/`에 보관
