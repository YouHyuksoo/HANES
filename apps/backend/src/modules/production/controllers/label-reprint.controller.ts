/**
 * @file production/controllers/label-reprint.controller.ts
 * @description 반제품(SG)·완제품(FG) 라벨 재발행 API
 *
 * - GET  /production/label-reprint        : 발행일 구간으로 재발행 대상 라벨 조회
 * - POST /production/label-reprint        : 재발행 확정(이력 적재) + 출력용 데이터 반환
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { LabelReprintService, ReprintLabelType } from '../services/label-reprint.service';
import { ReprintLabelsDto } from '../dto/label-reprint.dto';

@ApiTags('production')
@Controller('production/label-reprint')
export class LabelReprintController {
  constructor(private readonly svc: LabelReprintService) {}

  @Get()
  @ApiOperation({
    summary: '재발행 대상 라벨 조회',
    description: '반제품(SG)·완제품(FG) 라벨을 발행일 구간으로 조회한다. 훼손·분실 라벨 재발행용.',
  })
  @ApiQuery({ name: 'labelType', required: true, description: 'SG | FG' })
  @ApiQuery({ name: 'fromDate', required: false, description: '발행일 시작 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'toDate', required: false, description: '발행일 종료 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'search', required: false, description: '바코드·품목·작업지시 검색' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findLabels(
    @Query('labelType') labelType: ReprintLabelType,
    @Company() company: string,
    @Plant() plant: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.svc.findLabels(
      { labelType: labelType === 'FG' ? 'FG' : 'SG', fromDate, toDate, search },
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  @Post()
  @ApiOperation({
    summary: '라벨 재발행 확정',
    description: '취소된 라벨은 거부한다. FG 는 REPRINT_COUNT 를 올리고, 두 유형 모두 LABEL_PRINT_LOGS 에 남긴다.',
  })
  @ApiResponse({ status: 201, description: '재발행 기록 완료' })
  async reprint(@Body() dto: ReprintLabelsDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.svc.reprint(dto.labelType, dto.barcodes, dto.workerId, company, plant);
    return ResponseUtil.success(data, '라벨 재발행을 기록했습니다.');
  }
}
