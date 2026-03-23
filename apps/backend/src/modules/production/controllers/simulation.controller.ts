/**
 * @file src/modules/production/controllers/simulation.controller.ts
 * @description 생산계획 시뮬레이션 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: POST /api/v1/production/prod-plans/simulate
 * 2. **요청 본문**: { month: "YYYY-MM" }
 * 3. **응답**: 계획별 시작/종료/납기준수, 일자별 스케줄, 요약 정보
 * 4. 월력(WorkCalendar) + CAPA(ProcessCapa) + 수주(CustomerOrder)를 기반으로
 *    생산계획을 작업일에 배분하여 납기 준수 여부를 사전 검증한다.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { SimulationService } from '../services/simulation.service';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('생산관리 - 시뮬레이션')
@UseGuards(JwtAuthGuard)
@Controller('production/prod-plans')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '생산계획 시뮬레이션',
    description: '납기/CAPA/월력 기반 일자별 스케줄 시뮬레이션',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', example: '2026-04' },
        strategy: { type: 'string', enum: ['DUE_DATE', 'MIN_SETUP'], example: 'DUE_DATE' },
      },
      required: ['month'],
    },
  })
  @ApiResponse({ status: 200, description: '시뮬레이션 성공' })
  async simulate(
    @Body() body: { month: string; strategy?: 'DUE_DATE' | 'MIN_SETUP' },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.simulationService.simulate(
      body.month,
      company,
      plant,
      body.strategy || 'DUE_DATE',
    );
    return ResponseUtil.success(data);
  }
}
