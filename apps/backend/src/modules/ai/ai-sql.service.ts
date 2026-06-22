/**
 * @file src/modules/ai/ai-sql.service.ts
 * @description text-to-SQL 파이프라인 (2단계: MES 데이터 질의)
 *
 * 흐름: 테이블 선택(LLM) → SQL 생성(LLM) → 검증 → SELECT 실행+분석 / INSERT·UPDATE 승인대기
 * LLM 호출은 AiService.complete(Mistral)를 재사용한다.
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiService } from './ai.service';
import { SchemaInfoService } from './schema-info.service';
import { SqlValidatorService } from './sql-validator.service';
import { AiChatMessageDto } from './dto/ai-chat.dto';

export interface AiSqlResult {
  content: string;
  sql?: string;
  executed?: boolean;
  rowCount?: number;
  requiresApproval?: boolean;
}

const TABLE_SELECT_PROMPT = `당신은 사용자 질문에 필요한 DB 테이블을 고르는 도우미입니다.
규칙:
1. 아래 테이블 목록에서 질문에 필요한 테이블만 고릅니다(최대 6개).
2. 반드시 JSON 배열로만 응답합니다. 예: ["PROD_RESULTS","JOB_ORDERS"]
3. 데이터 조회/변경이 전혀 불필요한 일반 대화면 빈 배열 []을 응답합니다.
다른 설명 없이 JSON 배열만 출력하세요.`;

const SQL_GEN_PROMPT = `당신은 Oracle SQL 생성 AI입니다.
규칙:
- Oracle 문법. 식별자는 대문자(따옴표 없이).
- 멀티테넌시 필터는 메인(FROM) 테이블에만 한 번 적용: WHERE <메인별칭>.COMPANY='40' AND <메인별칭>.PLANT_CD='1000'.
  JOIN된 테이블에는 동일 조건을 중복으로 넣지 마세요. JOIN ON 절에서 COMPANY/PLANT_CD를 연결했다면 그것으로 충분합니다.
- 컬럼 의미는 각 컬럼 뒤 주석(-- 설명)으로 판단하고, 질문 속 단어를 의미가 맞는 컬럼에 매핑하세요.
  (예: "대표/사장"은 대표자명 컬럼, "회사/업체/거래처"는 회사명·거래처명 컬럼) 조건 컬럼을 임의로 고르지 마세요.
- 이름·명칭 등 텍스트 검색은 정확일치(=) 대신 LIKE '%값%'를 사용하세요.
- 검색값에서 한국어 조사(은/는/이/가/을/를/에/의/와/과/도)를 제거하고 핵심 단어만 사용하세요. 예: "정의선이" → "정의선".
- 조회는 SELECT. 등록은 INSERT, 수정은 UPDATE(UPDATE는 WHERE 필수). DELETE/DDL 절대 금지.
- 단일 쿼리만. 세미콜론으로 여러 쿼리를 연결하지 마세요.
- 데이터 작업이 불필요한 일반 대화면 "NO_SQL"만 응답.
- SQL만 출력(코드블록·설명 없이). 또는 "NO_SQL".`;

const ANALYSIS_PROMPT = `당신은 HANES MES 데이터 분석 AI입니다. 한국어 마크다운으로 답합니다.
규칙:
- 핵심 요약을 먼저, 데이터는 마크다운 표로 정리하세요.
- 결과가 0건이면 "조회 결과가 없습니다"라고만 답하고 표를 만들지 마세요(환각 금지).
- 결과에 없는 데이터를 지어내지 마세요.`;

const GENERAL_PROMPT =
  '당신은 HANES MES(제조실행시스템) 운영을 돕는 AI 비서입니다. 한국어로 간결하고 정확하게 답합니다.';

@Injectable()
export class AiSqlService {
  private readonly logger = new Logger(AiSqlService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly schemaInfo: SchemaInfoService,
    private readonly validator: SqlValidatorService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async process(messages: AiChatMessageDto[]): Promise<AiSqlResult> {
    const userMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    if (!userMessage.trim()) return { content: '질문을 입력해 주세요.' };

    // [1단계] 관련 테이블 선택 (없으면 일반 대화)
    const tables = await this.selectTables(userMessage);
    if (tables.length === 0) return this.generalChat(messages);

    // [2단계] SQL 생성
    const schemaText = await this.schemaInfo.getSchemaText(tables);
    const rawSql = await this.generateSql(userMessage, schemaText);
    if (!rawSql) return this.generalChat(messages);

    // [검증]
    const v = this.validator.validate(rawSql);
    const sql = this.validator.stripFences(rawSql);
    if (!v.valid) {
      return { content: `생성된 SQL이 보안 정책에 위배됩니다: ${v.error}`, sql };
    }

    // 쓰기: 승인 대기 (실행하지 않음)
    if (v.kind === 'write') {
      return {
        content: '아래 데이터 변경 작업을 검토하고, 실행하려면 승인해 주세요.',
        sql,
        requiresApproval: true,
      };
    }

    // 조회: 즉시 실행 + 분석
    try {
      const rows = await this.runSelect(sql);
      const analysis = await this.analyze(userMessage, sql, rows);
      return { content: analysis, sql, executed: true, rowCount: rows.length };
    } catch (error: unknown) {
      this.logger.error(
        `SELECT 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        content: `조회 실행 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없음'}`,
        sql,
      };
    }
  }

  /** 승인된 INSERT/UPDATE 실행 (재검증 필수) */
  async executeApproved(rawSql: string): Promise<AiSqlResult> {
    const v = this.validator.validate(rawSql);
    if (!v.valid) throw new BadRequestException(`SQL 검증 실패: ${v.error}`);
    if (v.kind !== 'write') {
      throw new BadRequestException('승인 실행은 INSERT/UPDATE 문만 가능합니다.');
    }
    const sql = this.validator.stripFences(rawSql);
    try {
      const result = await this.dataSource.query(sql);
      const affected = Array.isArray(result) ? result.length : (result?.affectedRows ?? 0);
      return { content: `실행이 완료되었습니다. (영향받은 행: ${affected})`, sql, executed: true };
    } catch (error: unknown) {
      this.logger.error(
        `승인 SQL 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        `실행 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없음'}`,
      );
    }
  }

  private async selectTables(userMessage: string): Promise<string[]> {
    const summaries = await this.schemaInfo.getTableSummaries();
    const list = summaries.map((s) => (s.comment ? `${s.table}: ${s.comment}` : s.table)).join('\n');
    const res = await this.aiService.complete([
      { role: 'system', content: TABLE_SELECT_PROMPT },
      { role: 'user', content: `## 테이블 목록\n${list}\n\n## 질문\n${userMessage}` },
    ]);
    const valid = new Set(summaries.map((s) => s.table.toUpperCase()));
    try {
      const start = res.indexOf('[');
      const end = res.lastIndexOf(']');
      if (start === -1 || end === -1) return [];
      const arr = JSON.parse(res.slice(start, end + 1)) as unknown[];
      if (!Array.isArray(arr)) return [];
      return arr
        .map((t) => String(t).toUpperCase())
        .filter((t) => valid.has(t))
        .slice(0, 6);
    } catch {
      return [];
    }
  }

  private async generateSql(userMessage: string, schemaText: string): Promise<string | null> {
    const res = await this.aiService.complete([
      { role: 'system', content: SQL_GEN_PROMPT },
      {
        role: 'user',
        content: `## 테이블 스키마\n${schemaText}\n\n## 질문\n${userMessage}\n\nOracle SQL 한 개를 생성하세요. 데이터 작업이 불필요하면 NO_SQL.`,
      },
    ]);
    const trimmed = res.trim();
    if (!trimmed || /^NO_SQL/i.test(this.validator.stripFences(trimmed))) return null;
    return trimmed;
  }

  private async runSelect(sql: string): Promise<Record<string, unknown>[]> {
    const base = sql.replace(/;\s*$/, '');
    const limited = /\bROWNUM\b|\bFETCH\s+FIRST\b/i.test(base)
      ? base
      : `SELECT * FROM (${base}) WHERE ROWNUM <= 100`;
    const qr = this.dataSource.createQueryRunner();
    try {
      await qr.connect();
      await qr.query('SET TRANSACTION READ ONLY');
      return (await qr.query(limited)) as Record<string, unknown>[];
    } finally {
      try {
        await qr.query('COMMIT');
      } catch {
        /* read-only 트랜잭션 종료 */
      }
      await qr.release();
    }
  }

  private async analyze(
    userMessage: string,
    sql: string,
    rows: Record<string, unknown>[],
  ): Promise<string> {
    const json = JSON.stringify(rows).slice(0, 9000);
    return this.aiService.complete([
      { role: 'system', content: ANALYSIS_PROMPT },
      {
        role: 'user',
        content: `## 질문\n${userMessage}\n\n## 실행 SQL\n${sql}\n\n## 결과(JSON, 최대 100행)\n${json}\n\n위 결과를 분석해 한국어 마크다운으로 답하세요.`,
      },
    ]);
  }

  private async generalChat(messages: AiChatMessageDto[]): Promise<AiSqlResult> {
    const content = await this.aiService.complete([
      { role: 'system', content: GENERAL_PROMPT },
      ...messages,
    ]);
    return { content };
  }
}
