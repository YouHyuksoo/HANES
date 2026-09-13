/**
 * @file src/modules/ai/ai.controller.ts
 * @description AI 채팅 컨트롤러
 * - GET  /ai/status      : 활성화/provider/model/키설정여부
 * - POST /ai/chat         : 데이터 질의(text-to-SQL) 통합 — 일반대화 폴백
 * - POST /ai/chat/stream  : 같은 처리 + 진행 상황 SSE(meta/delta/done)
 * - POST /ai/execute-sql  : 승인된 INSERT/UPDATE 실행
 * - POST /ai/scenario-diagnose : 시나리오 실행 실패 원인 분석
 * - POST /ai/chat/feedback   : 응답 좋아요/싫어요 저장
 * - DELETE /ai/chat/feedback/:id : 좋아요/싫어요 취소
 * - GET  /ai/oauth/status     : OpenAI 계정 연결 상태
 * - POST /ai/oauth/start      : OAuth 로그인 시작 (authorize URL + 루프백 리스너)
 * - POST /ai/oauth/exchange   : code 수동 입력 교환 (리스너를 못 쓰는 환경)
 * - DELETE /ai/oauth          : 연결 해제
 */
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res, ParseIntPipe, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AiService } from './ai.service';
import { AiOauthService } from './ai-oauth.service';
import { AiSqlService } from './ai-sql.service';
import { ScenarioDiagnoseService } from './scenario-diagnose.service';
import { ScenarioDiagnoseDto } from './dto/scenario-diagnose.dto';
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
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly aiSqlService: AiSqlService,
    private readonly aiCatalogService: AiCatalogService,
    private readonly embeddingService: EmbeddingService,
    private readonly aiFeedbackService: AiFeedbackService,
    private readonly workflowKnowledgeInterpreter: WorkflowKnowledgeInterpreterService,
    private readonly aiOauthService: AiOauthService,
    private readonly scenarioDiagnoseService: ScenarioDiagnoseService,
  ) {}

  /**
   * 시나리오가 멈춘 원인을 묻는다.
   * 일반 채팅을 쓰지 않는 이유는 scenario-diagnose.service.ts 머리말에 적었다 —
   * 근거가 도움말 문서가 아니라 그 순간의 화면 상태라서 프롬프트가 다르다.
   */
  @Post('scenario-diagnose')
  scenarioDiagnose(@Body() dto: ScenarioDiagnoseDto) {
    return this.scenarioDiagnoseService.diagnose(dto);
  }

  // ── OpenAI 계정 연결 (OAuth) ─────────────────────────────────────────────
  //
  // API 키 대신 ChatGPT 계정으로 붙는 경로다. 관리자가 1회 로그인하면
  // 토큰이 저장되고, 이후 만료 임박 시 refresh_token 으로 자동 갱신된다.

  @Get('oauth/status')
  oauthStatus(@Company() company: string, @Plant() plant: string) {
    return this.aiOauthService.getStatus(company, plant);
  }

  /**
   * 로그인 시작.
   * 콜백 주소는 고를 수 없다 — 이 client 는 http://localhost:<포트>/auth/callback 만 받는다
   * (실측 2026-09-13: 다른 경로나 외부 도메인은 로그인 화면에 가기도 전에 unknown_error).
   *
   * 그래서 백엔드가 루프백 리스너를 띄운다. 백엔드와 브라우저가 같은 장비면 그대로 끝난다.
   * 배포 서버처럼 다른 장비면 listening=false 로 내려가고, 화면이 code 수동 입력을 안내한다.
   */
  @Post('oauth/start')
  oauthStart(
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: Request,
    @Body('port') port?: number,
  ) {
    return this.aiOauthService.startWithListener(
      Number(port) || 1455,
      company,
      plant,
      getRequestUser(req)?.email ?? getRequestUser(req)?.id,
    );
  }

  /** code 수동 교환 — 브라우저 주소창에 남은 code/state 를 받아 토큰으로 바꾼다 */
  @Post('oauth/exchange')
  oauthExchange(
    @Body('code') code: string,
    @Body('state') state: string,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: Request,
  ) {
    if (!code?.trim() || !state?.trim()) {
      throw new BadRequestException('code 와 state 가 모두 필요합니다.');
    }
    return this.aiOauthService.exchangeCode(code.trim(), state.trim(), company, plant, getRequestUser(req)?.email ?? getRequestUser(req)?.id);
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

  /**
   * POST /ai/chat/stream — /ai/chat 과 같은 처리를 하되 진행 상황을 흘려보낸다.
   *
   * 답변 생성이 30초 안팎이라 다 끝날 때까지 화면이 비어 있었다. 내용은 같고
   * 도착 시점만 앞당긴다. 이벤트는 셋이다.
   *   stage : 지금 하는 일(키). 화면이 "질문 이해 중 / 문서 찾는 중"처럼 보여준다.
   *   meta  : 출처 목록 (검색 직후 — 답변보다 먼저 온다)
   *   delta : 답변 조각. 시나리오 제안처럼 델타가 없는 분기도 있다.
   *   done  : 최종 결과 전체. /ai/chat 응답과 같은 모양이라 화면은 이걸로 메시지를 만든다.
   *
   * @Res() 를 쓰는 이유: 전역 TransformInterceptor 가 {success,data} 로 감싸 버리면
   * SSE 가 아니게 된다. 응답을 직접 쓰면 그 경로를 타지 않는다.
   */
  @Post('chat/stream')
  async chatStream(@Body() dto: AiChatDto, @Res() res: Response, @Req() req: Request): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // 리버스 프록시가 버퍼링하면 조각이 모였다가 한꺼번에 간다 — 스트리밍한 의미가 없어진다.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 사용자가 창을 닫거나 취소하면 더 쓰지 않는다. 끊긴 소켓에 쓰면 EPIPE 가 난다.
    let closed = false;
    req.on('close', () => {
      closed = true;
    });
    const send = (event: string, data: unknown): void => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await this.aiSqlService.process(dto.messages, dto.pageToolContext, dto.knowledgeContext, {
        onStage: (stage) => send('stage', { stage }),
        onMeta: (sources) => send('meta', { sources }),
        onDelta: (chunk) => send('delta', { chunk }),
      });
      send('done', result);
    } catch (error: unknown) {
      // 이미 헤더를 보낸 뒤라 예외 필터가 상태코드를 바꿀 수 없다. 스트림 안에서 알린다.
      const message = error instanceof Error ? error.message : 'AI 응답 생성에 실패했습니다.';
      this.logger.error(`채팅 스트림 실패: ${message}`);
      send('error', { message });
    } finally {
      if (!closed && !res.writableEnded) res.end();
    }
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
