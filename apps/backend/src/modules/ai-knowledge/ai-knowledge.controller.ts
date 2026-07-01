/**
 * @file src/modules/ai-knowledge/ai-knowledge.controller.ts
 * @description AI 문서 RAG 인덱스 관리/검색 API.
 */
import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AiKnowledgeService, KnowledgeSearchContext } from './ai-knowledge.service';

class KnowledgeSearchDto implements KnowledgeSearchContext {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  menuCode?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  topK?: number;
}

@Controller('ai/knowledge')
export class AiKnowledgeController {
  constructor(private readonly knowledge: AiKnowledgeService) {}

  @Get('status')
  status() {
    return this.knowledge.status();
  }

  @Post('reindex')
  reindex() {
    return this.knowledge.reindex();
  }

  @Post('search')
  search(@Body() dto: KnowledgeSearchDto) {
    return this.knowledge.search(dto.query, dto, dto.topK ?? 6);
  }
}
