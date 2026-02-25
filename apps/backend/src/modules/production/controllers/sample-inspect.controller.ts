/**
 * @file src/modules/production/controllers/sample-inspect.controller.ts
 * @description 반제품 샘플검사 입력/조회 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. POST /production/sample-inspect-input : 샘플검사 일괄 입력
 * 2. GET  /production/sample-inspect-input : 샘플검사 이력 조회
 * 3. GET  /production/sample-inspect-input/job-order/:id : 작업지시별 검사목록
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { SampleInspectService } from '../services/sample-inspect.service';
import {
  CreateSampleInspectDto,
  SampleInspectHistoryQueryDto,
} from '../dto/sample-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('생산관리 - 반제품 샘플검사')
@Controller('production/sample-inspect-input')
export class SampleInspectController {
  constructor(private readonly sampleInspectService: SampleInspectService) {}

  @Get()
  @ApiOperation({ summary: '샘플검사 이력 조회', description: '날짜/합불/검색어 필터링' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findHistory(@Query() query: SampleInspectHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.sampleInspectService.findHistory(query, company, plant);
    return ResponseUtil.success(result.data);
  }

  @Get('job-order/:orderNo')
  @ApiOperation({ summary: '작업지시별 샘플검사 조회' })
  @ApiParam({ name: 'orderNo', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByJobOrder(@Param('orderNo') orderNo: string) {
    const data = await this.sampleInspectService.findByJobOrder(orderNo);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '샘플검사 일괄 입력', description: '작업지시 기준 샘플별 측정값 저장' })
  @ApiResponse({ status: 201, description: '입력 성공' })
  async create(@Body() dto: CreateSampleInspectDto) {
    const result = await this.sampleInspectService.create(dto);
    return ResponseUtil.success(result, `${result.count}건의 샘플검사가 등록되었습니다.`);
  }
}
