import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseUtil } from '../../common/dto/response.dto';
import { AiScenariosService } from './ai-scenarios.service';

/**
 * 시나리오 조회 API.
 *
 *   GET /ai/scenarios      목록 — AI 가 자연어에서 어떤 절차인지 고를 때 읽는다(steps 제외)
 *   GET /ai/scenarios/:id  본문 — 인앱 드라이버가 실행할 절차
 */
@ApiTags('AI - 시나리오')
@Controller('ai/scenarios')
export class AiScenariosController {
  constructor(private readonly service: AiScenariosService) {}

  @Get()
  @ApiOperation({ summary: '시나리오 목록 (AI 선택용, steps 제외)' })
  list() {
    return ResponseUtil.success(this.service.list());
  }

  @Get(':id')
  @ApiOperation({ summary: '시나리오 본문 (드라이버 실행용)' })
  get(@Param('id') id: string) {
    return ResponseUtil.success(this.service.get(id));
  }
}
