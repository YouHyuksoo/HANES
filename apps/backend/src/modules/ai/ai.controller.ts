/**
 * @file src/modules/ai/ai.controller.ts
 * @description AI 채팅 컨트롤러
 * - GET  /ai/status      : 활성화/provider/model/키설정여부
 * - POST /ai/chat         : 데이터 질의(text-to-SQL) 통합 — 일반대화 폴백
 * - POST /ai/execute-sql  : 승인된 INSERT/UPDATE 실행
 */
import { Controller, Get, Post, Put, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSqlService } from './ai-sql.service';
import { AiCatalogService } from './ai-catalog.service';
import { SchemaInfoService } from './schema-info.service';
import { EmbeddingService } from '../ai-knowledge/embedding.service';
import { AiChatDto, AiExecuteSqlDto, AiTestDto, AiEmbeddingTestDto, AiCatalogSaveDto, AiCatalogTablesDto } from './dto/ai-chat.dto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiSqlService: AiSqlService,
    private readonly aiCatalogService: AiCatalogService,
    private readonly schemaInfoService: SchemaInfoService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiSqlService.process(dto.messages, dto.pageToolContext, dto.knowledgeContext);
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

  /** AI 테이블 카탈로그 md 원문 조회 */
  @Get('catalog')
  async getCatalog() {
    return { content: await this.aiCatalogService.readRaw() };
  }

  /** AI 테이블 카탈로그 md 저장 */
  @Put('catalog')
  async saveCatalog(@Body() dto: AiCatalogSaveDto) {
    await this.aiCatalogService.saveRaw(dto.content);
    return { ok: true };
  }

  /** 실제 DB 테이블과 동기화(누락 테이블 추가, 큐레이션 보존) */
  @Post('catalog/sync')
  syncCatalog() {
    return this.aiCatalogService.syncFromDb();
  }

  /** 카탈로그 구조화 조회 (편집 UI용) */
  @Get('catalog/tables')
  async getCatalogTables() {
    return { tables: await this.aiCatalogService.getTables() };
  }

  /** 카탈로그 구조화 저장 */
  @Put('catalog/tables')
  async saveCatalogTables(@Body() dto: AiCatalogTablesDto) {
    await this.aiCatalogService.saveTables(dto.tables);
    return { ok: true };
  }

  /** 전체 테이블 컬럼맵 (관계 편집 드롭다운용) */
  @Get('catalog/columns')
  async getCatalogColumns() {
    return { columns: await this.schemaInfoService.getAllColumnsByTable() };
  }
}
