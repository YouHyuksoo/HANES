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
}

/** 승인된 INSERT/UPDATE 실행 요청 */
export class AiExecuteSqlDto {
  @IsString()
  @MaxLength(8000)
  sql: string;
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
