/**
 * @file crimp-inspect.controller.ts
 * @description 절압물검사 API (화면: INSP_TERMINAL_RESULT /inspection/terminal-result)
 *
 * 초보자 가이드:
 * 1. GET  /quality/crimp-inspect/job-orders          — 진행/대기 압착 작업지시
 * 2. GET  /quality/crimp-inspect/context?orderNo=    — 단자 사이드별 압착 규격 + 외관 판정 항목
 * 3. GET  /quality/crimp-inspect/history?orderNo=    — 작업지시의 절압물검사 이력
 * 4. POST /quality/crimp-inspect                     — 실측값·외관 판정 등록(합/불은 서버 판정)
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { CrimpInspectService } from '../services/crimp-inspect.service';
import { CreateCrimpInspectDto } from '../dto/crimp-inspect.dto';

@ApiTags('품질관리 - 절압물검사')
@Controller('quality/crimp-inspect')
export class CrimpInspectController {
  constructor(private readonly service: CrimpInspectService) {}

  @Get('job-orders')
  @ApiOperation({ summary: '절압물검사 대상 압착 작업지시 (RUNNING/WAITING)' })
  async findJobOrders(@Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findJobOrders(company, plant));
  }

  @Get('context')
  @ApiOperation({ summary: '작업지시 단자 사이드별 압착 규격 + 외관 판정 항목' })
  @ApiQuery({ name: 'orderNo', required: true })
  async getContext(@Query('orderNo') orderNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.getContext(orderNo, company, plant));
  }

  @Get('history')
  @ApiOperation({ summary: '작업지시 절압물검사 이력' })
  @ApiQuery({ name: 'orderNo', required: true })
  async findHistory(@Query('orderNo') orderNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findHistory(orderNo, company, plant));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '절압물검사 등록 (단자별 실측값을 압착 규격으로 서버 판정)' })
  async create(
    @Body() dto: CreateCrimpInspectDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(
      data,
      data.passYn === 'Y' ? '절압물검사 합격으로 등록했습니다.' : '절압물검사 불합격으로 등록했습니다.',
    );
  }
}
