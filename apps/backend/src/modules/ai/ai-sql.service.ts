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
import { AiCatalogService } from './ai-catalog.service';
import { SchemaInfoService } from './schema-info.service';
import { SqlValidatorService } from './sql-validator.service';
import { AiChatMessageDto, AiPageToolContextDto } from './dto/ai-chat.dto';

export interface AiSqlResult {
  content: string;
  sql?: string;
  executed?: boolean;
  rowCount?: number;
  requiresApproval?: boolean;
}

const TABLE_SELECT_PROMPT = `당신은 HANES MES 데이터베이스에서 사용자 질문에 답할 테이블을 고르는 도우미입니다.
규칙:
1. 아래 테이블 목록에서 질문에 답하는 데 필요한 테이블을 고릅니다(최대 6개).
2. 회사·거래처·인물(대표/담당자/작업자/검사자)·품목·생산·재고·출하·품질·설비 등 MES에 저장된 정보를 묻는 질문이면, 일반 상식으로 답할 수 있어 보여도 반드시 관련 테이블을 선택하세요. (예: 사람 이름으로 소속·대표 여부를 묻는 질문은 회사·거래처 마스터의 대표자명 등으로 조회)
3. 같은 성격의 정보가 여러 테이블에 나뉘어 있을 수 있으면(예: 자사 정보와 거래처 정보, 자재와 제품) 코멘트를 보고 후보 테이블을 모두 선택하세요. 단어 하나(예: "회사")만 보고 한 테이블로 단정하지 마세요.
4. 인사·잡담 등 데이터와 전혀 무관한 경우에만 빈 배열 []을 응답합니다.
5. 반드시 JSON 배열로만 응답합니다. 예: ["PARTNER_MASTERS","COMPANY_MASTERS"]
다른 설명 없이 JSON 배열만 출력하세요.`;

const SQL_GEN_PROMPT = `당신은 Oracle SQL 생성 AI입니다.
규칙:
- 반드시 아래 '테이블 스키마'에 제시된 테이블·컬럼만 사용하세요. 목록에 없는 테이블/뷰/컬럼을 추측하거나 만들어내지 마세요. 필요한 데이터가 스키마에 없으면 NO_SQL로 응답하세요.
- Oracle 문법. 식별자는 대문자(따옴표 없이).
- 멀티테넌시 필터는 메인(FROM) 테이블에만 한 번 적용: WHERE <메인별칭>.COMPANY='40' AND <메인별칭>.PLANT_CD='1000'.
  JOIN된 테이블에는 동일 조건을 중복으로 넣지 마세요. JOIN ON 절에서 COMPANY/PLANT_CD를 연결했다면 그것으로 충분합니다.
- 컬럼 의미는 각 컬럼 뒤 주석(-- 설명)으로 판단하고, 질문 속 단어를 의미가 맞는 컬럼에 매핑하세요.
  (예: "대표/사장"은 대표자명 컬럼, "회사/업체/거래처"는 회사명·거래처명 컬럼) 조건 컬럼을 임의로 고르지 마세요.
- JOIN이 필요하면 '테이블 관계(JOIN 키)' 섹션에 제시된 키로 연결하세요. 관계 섹션에 없는 임의 컬럼으로 JOIN을 추측하지 마세요.
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
  '당신은 HANES MES(제조실행시스템) 운영을 돕는 AI 비서입니다. 한국어로 간결하고 정확하게 답합니다. ' +
  '회사·거래처·인물·품목·생산·재고 등 MES에 있을 법한 정보는 학습된 일반 지식으로 추측해 답하지 마세요. ' +
  'MES 데이터로 확인이 필요한 질문이면 "MES 데이터에서 확인이 필요합니다"라고 안내하세요.';

const PAGE_WORKFLOW_KEYWORDS = [
  '등록',
  '생성',
  '만들',
  '작성',
  '초안',
  '반영',
  '처리',
  '실행',
  '추가',
];

@Injectable()
export class AiSqlService {
  private readonly logger = new Logger(AiSqlService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly catalog: AiCatalogService,
    private readonly schemaInfo: SchemaInfoService,
    private readonly validator: SqlValidatorService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async process(
    messages: AiChatMessageDto[],
    pageToolContext?: AiPageToolContextDto,
  ): Promise<AiSqlResult> {
    const userMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    if (!userMessage.trim()) return { content: '질문을 입력해 주세요.' };

    if (pageToolContext && this.looksLikePageWorkflowRequest(userMessage)) {
      return this.generalChat(messages, pageToolContext);
    }

    // [1단계] 관련 테이블 선택 (없으면 일반 대화)
    const tables = await this.selectTables(userMessage);
    if (tables.length === 0) return this.generalChat(messages, pageToolContext);

    // [2단계] SQL 생성 (스키마 + 카탈로그 관계(JOIN 키) 주입)
    const schemaText = await this.schemaInfo.getSchemaText(tables);
    const relations = await this.catalog.getRelationsText(tables);
    const rawSql = await this.generateSql(userMessage, relations ? `${schemaText}\n\n${relations}` : schemaText);
    if (!rawSql) return this.generalChat(messages, pageToolContext);

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
    // 카탈로그 파일(큐레이션) 우선, 없으면 DB 폴백
    const { catalog, tables } =
      (await this.catalog.getSelectionCatalog()) ?? (await this.schemaInfo.getSelectionCatalog());
    const res = await this.aiService.complete([
      { role: 'system', content: TABLE_SELECT_PROMPT },
      { role: 'user', content: `## 테이블 카탈로그 (형식: 테이블명: 설명)\n${catalog}\n\n## 질문\n${userMessage}` },
    ]);
    const valid = new Set(tables.map((t) => t.toUpperCase()));
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

  private looksLikePageWorkflowRequest(userMessage: string): boolean {
    return PAGE_WORKFLOW_KEYWORDS.some((keyword) => userMessage.includes(keyword));
  }

  private formatPageToolContext(pageToolContext?: AiPageToolContextDto): string {
    if (!pageToolContext) return '';
    const tools = pageToolContext.tools
      .map((tool) => {
        const persistRule = tool.neverPersists ? '저장 안 함' : '저장 가능성 확인 필요';
        return `- ${tool.name} (${tool.label}): ${tool.description} / 위험도=${tool.riskLevel} / 출처=${tool.source} / ${persistRule} / 확인=${tool.confirmationPolicy ?? '명시 없음'}`;
      })
      .join('\n');
    return [
      '현재 사용자가 보고 있는 페이지에는 아래 도구가 노출되어 있습니다.',
      `pageId=${pageToolContext.pageId}, executionLevel=${pageToolContext.executionLevel}`,
      tools,
      '등록/생성/작성 요청은 DB SQL을 직접 만들지 말고, 이 도구 절차 기준으로 필요한 입력값을 확인하고 초안 반영 방식으로 안내하세요.',
      '필수 정보가 부족하면 품목, 수량, 계획일, 라인/공정/설비 등 필요한 값을 먼저 질문하세요.',
    ].join('\n');
  }

  private async generalChat(
    messages: AiChatMessageDto[],
    pageToolContext?: AiPageToolContextDto,
  ): Promise<AiSqlResult> {
    const pageToolPrompt = this.formatPageToolContext(pageToolContext);
    const content = await this.aiService.complete([
      { role: 'system', content: pageToolPrompt ? `${GENERAL_PROMPT}\n\n${pageToolPrompt}` : GENERAL_PROMPT },
      ...messages,
    ]);
    return { content };
  }
}
