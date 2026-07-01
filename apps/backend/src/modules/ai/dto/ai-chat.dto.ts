/**
 * @file src/modules/ai/dto/ai-chat.dto.ts
 * @description AI 채팅 요청 DTO
 */
import { IsArray, IsString, IsIn, ValidateNested, ArrayNotEmpty, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AiChatMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content: string;
}

export class AiPageToolContextToolDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsString()
  description: string;

  @IsString()
  riskLevel: string;

  @IsString()
  source: string;

  @IsOptional()
  @IsBoolean()
  neverPersists?: boolean;

  @IsOptional()
  @IsString()
  confirmationPolicy?: string;
}

export class AiPageToolContextDto {
  @IsString()
  pageId: string;

  @IsString()
  executionLevel: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiPageToolContextToolDto)
  tools: AiPageToolContextToolDto[];
}

export class AiKnowledgeContextDto {
  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  menuCode?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class AiChatDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages: AiChatMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AiPageToolContextDto)
  pageToolContext?: AiPageToolContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiKnowledgeContextDto)
  knowledgeContext?: AiKnowledgeContextDto;
}

/** 승인된 INSERT/UPDATE 실행 요청 */
export class AiExecuteSqlDto {
  @IsString()
  @MaxLength(8000)
  sql: string;
}

/** AI 테이블 카탈로그 저장 요청 (md 원문) */
export class AiCatalogSaveDto {
  @IsString()
  @MaxLength(500000)
  content: string;
}

export class CatalogRelationDto {
  @IsString()
  @MaxLength(128)
  column: string;

  @IsString()
  @MaxLength(256)
  target: string;
}

export class CatalogTableDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsArray()
  @IsString({ each: true })
  synonyms: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogRelationDto)
  relations: CatalogRelationDto[];
}

/** AI 테이블 카탈로그 구조화 저장 요청 */
export class AiCatalogTablesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogTableDto)
  tables: CatalogTableDto[];
}

export class AiEmbeddingTestDto {
  @IsString()
  provider: string;

  @IsString()
  model: string;

  @IsString()
  dims: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiKey?: string;
}

/** AI provider 연결 테스트 요청 */
export class AiTestDto {
  @IsString()
  provider: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;
}
