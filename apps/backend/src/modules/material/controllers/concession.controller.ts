/**
 * @file src/modules/material/controllers/concession.controller.ts
 * @description 특채처리(특별채택) API 컨트롤러
 *              - IQC 불합격(FAIL) LOT을 특채 승인하여 양품입고를 허용
 */

import { Controller, Get, Post, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConcessionService } from '../services/concession.service';
import { ConcessionTargetQueryDto, ApplyConcessionDto } from '../dto/concession.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 특채처리')
@Controller('material/concession')
export class ConcessionController {
  constructor(private readonly concessionService: ConcessionService) {}

  @Get('targets')
  @ApiOperation({ summary: '특채 대상 목록 (불합격 입하+품목 그룹)' })
  async findTargets(@Query() query: ConcessionTargetQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.concessionService.findTargets(query, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '특채 처리 (그룹 FAIL 시리얼 전체 특채 승인)' })
  async apply(@Body() dto: ApplyConcessionDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.concessionService.apply(dto, company, plant);
    return ResponseUtil.success(data, '특채 처리되었습니다.');
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '특채 취소 (SPECIAL_ACCEPT_YN 복원)' })
  async cancel(@Body() dto: ApplyConcessionDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.concessionService.cancel(dto, company, plant);
    return ResponseUtil.success(data, '특채가 취소되었습니다.');
  }
}
