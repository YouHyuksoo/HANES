/**
 * @file src/modules/ai/ai.controller.ts
 * @description AI 채팅 컨트롤러
 * - GET  /ai/status : 활성화/provider/model/키설정여부
 * - POST /ai/chat   : 일반 대화
 */
import { Controller, Get, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto.messages);
  }
}
