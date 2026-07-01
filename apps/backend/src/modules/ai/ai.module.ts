/**
 * @file src/modules/ai/ai.module.ts
 * @description AI 채팅 모듈 (Mistral 연동 + text-to-SQL)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysConfig } from '../../entities/sys-config.entity';
import { AiPageToolsModule } from '../ai-page-tools/ai-page-tools.module';
import { AiKnowledgeModule } from '../ai-knowledge/ai-knowledge.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiSqlService } from './ai-sql.service';
import { AiCatalogService } from './ai-catalog.service';
import { SchemaInfoService } from './schema-info.service';
import { SqlValidatorService } from './sql-validator.service';

@Module({
  imports: [TypeOrmModule.forFeature([SysConfig]), AiPageToolsModule, AiKnowledgeModule],
  controllers: [AiController],
  providers: [AiService, AiSqlService, AiCatalogService, SchemaInfoService, SqlValidatorService],
})
export class AiModule {}
