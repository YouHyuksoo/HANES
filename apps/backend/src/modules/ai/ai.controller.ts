/**
 * @file src/modules/ai/ai.controller.ts
 * @description AI 채팅 컨트롤러
 * - GET  /ai/status      : 활성화/provider/model/키설정여부
 * - POST /ai/chat         : 데이터 질의(text-to-SQL) 통합 — 일반대화 폴백
 * - POST /ai/execute-sql  : 승인된 INSERT/UPDATE 실행
 * - POST /ai/chat/feedback   : 응답 좋아요/싫어요 저장
 * - DELETE /ai/chat/feedback/:id : 좋아요/싫어요 취소
 */
import { Controller, Get, Post, Put, Delete, Body, Param, Req, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AiService } from './ai.service';
import { AiSqlService } from './ai-sql.service';
import { AiCatalogService } from './ai-catalog.service';
import { AiFeedbackService } from './ai-feedback.service';
import { EmbeddingService } from '../ai-knowledge/embedding.service';
import { AiChatDto, AiExecuteSqlDto, AiTestDto, AiEmbeddingTestDto, AiChatFeedbackDto } from './dto/ai-chat.dto';
import { getRequestUser } from '../../common/utils/request-user.util';
import { getHeaderString } from '../../common/utils/header-value.util';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiSqlService: AiSqlService,
    private readonly aiCatalogService: AiCatalogService,
    private readonly embeddingService: EmbeddingService,
    private readonly aiFeedbackService: AiFeedbackService,
  ) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiSqlService.process(dto.messages, dto.pageToolContext, dto.knowledgeContext);
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
