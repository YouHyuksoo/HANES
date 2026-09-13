/**
 * @file src/modules/ai/ai.controller.ts
 * @description AI 채팅 컨트롤러
 * - GET  /ai/status      : 활성화/provider/model/키설정여부
 * - POST /ai/chat         : 데이터 질의(text-to-SQL) 통합 — 일반대화 폴백
 * - POST /ai/execute-sql  : 승인된 INSERT/UPDATE 실행
 * - POST /ai/chat/feedback   : 응답 좋아요/싫어요 저장
 * - DELETE /ai/chat/feedback/:id : 좋아요/싫어요 취소
 * - GET  /ai/oauth/status     : OpenAI 계정 연결 상태
 * - POST /ai/oauth/start      : OAuth 로그인 시작 (authorize URL 반환)
 * - GET  /ai/oauth/callback   : OAuth 콜백 (code → 토큰 교환·저장)
 * - DELETE /ai/oauth          : 연결 해제
 */
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AiService } from './ai.service';
import { AiOauthService } from './ai-oauth.service';
import { AiSqlService } from './ai-sql.service';
import { AiCatalogService } from './ai-catalog.service';
import { AiFeedbackService } from './ai-feedback.service';
import { EmbeddingService } from '../ai-knowledge/embedding.service';
import { AiChatDto, AiExecuteSqlDto, AiTestDto, AiEmbeddingTestDto, AiChatFeedbackDto } from './dto/ai-chat.dto';
import { getRequestUser } from '../../common/utils/request-user.util';
import { Company, Plant } from '../../common/decorators/tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { getHeaderString } from '../../common/utils/header-value.util';
import { WorkflowKnowledgeInterpretDto } from './dto/workflow-knowledge.dto';
import { WorkflowKnowledgeInterpreterService } from './workflow-knowledge-interpreter.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiSqlService: AiSqlService,
    private readonly aiCatalogService: AiCatalogService,
    private readonly embeddingService: EmbeddingService,
    private readonly aiFeedbackService: AiFeedbackService,
    private readonly workflowKnowledgeInterpreter: WorkflowKnowledgeInterpreterService,
    private readonly aiOauthService: AiOauthService,
  ) {}

  // ── OpenAI 계정 연결 (OAuth) ─────────────────────────────────────────────
  //
  // API 키 대신 ChatGPT 계정으로 붙는 경로다. 관리자가 1회 로그인하면
  // 토큰이 저장되고, 이후 만료 임박 시 refresh_token 으로 자동 갱신된다.

  @Get('oauth/status')
  oauthStatus(@Company() company: string, @Plant() plant: string) {
    return this.aiOauthService.getStatus(company, plant);
  }

  @Post('oauth/start')
  oauthStart(@Req() req: Request) {
    // 콜백은 요청이 들어온 호스트 기준으로 만든다.
    // 로컬(localhost:3003)과 배포서버가 각자 자기 주소를 쓰게 하려는 것이다.
    // 실측(2026-09-13): OpenAI 는 임의 도메인 redirect_uri 를 받아들인다.
    const proto = getHeaderString(req.headers['x-forwarded-proto']) ?? req.protocol;
    const host = getHeaderString(req.headers['x-forwarded-host']) ?? req.get('host');
    const redirectUri = `${proto}://${host}/api/v1/ai/oauth/callback`;
    return this.aiOauthService.start(redirectUri);
  }

  /**
   * OAuth 콜백. OpenAI 가 브라우저를 이리로 되돌려 보낸다.
   * 로그인 세션이 없는 상태로 도착하므로 인증을 걸지 않는다 —
   * 대신 state 로 진행 중인 요청인지 검증한다(서버 메모리에만 있다).
   */
  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const close = (message: string) =>
      res.send(
        `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px">
         <p>${message}</p><p>이 창을 닫아 주세요.</p>
         <script>setTimeout(()=>window.close(),1500)</script></body>`,
      );
    if (error) return close(`연결이 취소되었습니다: ${error}`);
    if (!code || !state) return close('필요한 값이 없어 연결하지 못했습니다.');
    try {
      // 콜백에는 로그인 세션이 없으므로 회사/사업장은 기본값으로 저장한다.
      const saved = await this.aiOauthService.handleCallback(code, state, '40', '1000');
      return close(`OpenAI 계정(${saved.accountEmail ?? '연결됨'})이 연결되었습니다.`);
    } catch (e: unknown) {
      return close(`연결에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  @Delete('oauth')
  async oauthDisconnect(@Company() company: string, @Plant() plant: string) {
    await this.aiOauthService.disconnect(company, plant);
    return { disconnected: true };
  }

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiSqlService.process(dto.messages, dto.pageToolContext, dto.knowledgeContext);
  }

  @Post('workflow-knowledge/interpret')
  interpretWorkflowKnowledge(@Body() dto: WorkflowKnowledgeInterpretDto) {
    return this.workflowKnowledgeInterpreter.interpret(dto.query);
  }

  @Post('chat/feedback')
  async createFeedback(@Body() dto: AiChatFeedbackDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    if (!company || !plant) {
      throw new BadRequestException('회사/사업장 정보가 없습니다.');
    }
    const createdBy = getRequestUser(req)?.id ?? 'unknown';
    return this.aiFeedbackService.create(dto, company, plant, createdBy);
  }

  @Delete('chat/feedback/:id')
  async deleteFeedback(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    if (!company || !plant) {
      throw new BadRequestException('회사/사업장 정보가 없습니다.');
    }
    return this.aiFeedbackService.remove(id, company, plant);
  }

  private tenant(req: Request) {
    const user = getRequestUser(req) ?? {};
    return {
      company: getHeaderString(req.headers['x-company']) || user.company,
      plant: getHeaderString(req.headers['x-plant']) || user.plant,
    };
  }

  @Post('execute-sql')
  executeSql(@Body() dto: AiExecuteSqlDto) {
    return this.aiSqlService.executeApproved(dto.sql);
  }

  @Post('test')
  test(@Body() dto: AiTestDto) {
    return this.aiService.test(dto.provider, dto.model ?? '', dto.apiKey);
  }

  @Post('embedding/test')
  testEmbedding(@Body() dto: AiEmbeddingTestDto) {
    return this.embeddingService.test(dto.provider, dto.model, Number(dto.dims), dto.apiKey);
  }

  /** 테이블 카탈로그(docs/database/table-catalog.md)를 실제 DB와 동기화 — 누락 테이블 추가, 사람이 쓴 설명/관계 보존.
   *  카탈로그는 docs 문서라 편집은 git/에디터로 하고, 스키마 변경 시 이 엔드포인트로 새 테이블만 채운다. */
  @Post('catalog/sync')
  syncCatalog() {
    return this.aiCatalogService.syncFromDb();
  }
}
