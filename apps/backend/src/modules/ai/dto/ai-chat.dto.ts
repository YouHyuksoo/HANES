/**
 * @file src/modules/ai/dto/ai-chat.dto.ts
 * @description AI 채팅 요청 DTO
 */
import { IsArray, IsString, IsIn, IsNumber, ValidateNested, ArrayNotEmpty, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AiChatAttachmentDto {
  @IsIn(['image'])
  type: 'image';

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(100)
  mimeType: string;

  @IsString()
  @MaxLength(7000000)
  dataUrl: string;
}

export class AiChatMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatAttachmentDto)
  attachments?: AiChatAttachmentDto[];
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

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsIn(['user', 'operator', 'engineer'])
  persona?: 'user' | 'operator' | 'engineer';
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

/** RAG 지식 청크 출처 요약 — 채팅 응답(sources)과 피드백 요청(sources) 양쪽에서 사용 */
export class AiKnowledgeSourceDto {
  @IsString()
  chunkId: string;

  @IsString()
  sourcePath: string;

  @IsOptional()
  @IsString()
  menuCode?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsNumber()
  score?: number;
}

/** 좋아요/싫어요 피드백 등록 요청 */
export class AiChatFeedbackDto {
  @IsString()
  @MaxLength(4000)
  question: string;

  @IsString()
  @MaxLength(50000)
  answer: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiKnowledgeSourceDto)
  sources?: AiKnowledgeSourceDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  menuCode?: string;

  @IsIn(['LIKE', 'DISLIKE'])
  rating: 'LIKE' | 'DISLIKE';
}
