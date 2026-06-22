/**
 * @file src/modules/ai/dto/ai-chat.dto.ts
 * @description AI 채팅 요청 DTO
 */
import { IsArray, IsString, IsIn, ValidateNested, ArrayNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AiChatMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content: string;
}

export class AiChatDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages: AiChatMessageDto[];
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
