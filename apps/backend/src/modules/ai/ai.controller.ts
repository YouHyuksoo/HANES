/**
 * @file src/modules/ai/ai.controller.ts
 * @description AI 채팅 컨트롤러
 * - GET  /ai/status      : 활성화/provider/model/키설정여부
 * - POST /ai/chat         : 데이터 질의(text-to-SQL) 통합 — 일반대화 폴백
 * - POST /ai/execute-sql  : 승인된 INSERT/UPDATE 실행
 */
import { Controller, Get, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSqlService } from './ai-sql.service';
import { AiChatDto, AiExecuteSqlDto, AiTestDto } from './dto/ai-chat.dto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiSqlService: AiSqlService,
  ) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiSqlService.process(dto.messages, dto.pageToolContext);
  }

  @Post('execute-sql')
  executeSql(@Body() dto: AiExecuteSqlDto) {
    return this.aiSqlService.executeApproved(dto.sql);
  }

  @Post('test')
  test(@Body() dto: AiTestDto) {
    return this.aiService.test(dto.provider, dto.model ?? '', dto.apiKey);
  }
}
