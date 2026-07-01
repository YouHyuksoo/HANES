/**
 * @file src/modules/ai-knowledge/ai-knowledge.module.ts
 * @description SQLite/sqlite-vec 기반 AI 문서 지식 검색 모듈.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysConfig } from '../../entities/sys-config.entity';
import { AiKnowledgeController } from './ai-knowledge.controller';
import { AiKnowledgeService } from './ai-knowledge.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [TypeOrmModule.forFeature([SysConfig])],
  controllers: [AiKnowledgeController],
  providers: [AiKnowledgeService, EmbeddingService],
  exports: [AiKnowledgeService, EmbeddingService],
})
export class AiKnowledgeModule {}
