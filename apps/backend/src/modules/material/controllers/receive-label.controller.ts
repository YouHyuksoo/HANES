/**
 * @file receive-label.controller.ts
 * @description 자재 라벨 발행 API — IQC PASS 입하건 조회 + matUid 채번 + 라벨 발행
 *
 * 초보자 가이드:
 * 1. GET /material/receive-label/arrivals: 라벨 발행 가능한 입하건 목록
 * 2. POST /material/receive-label/create: matUid 채번 + MatLot 생성 + 라벨 인쇄
 */
import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReceiveLabelService } from '../services/receive-label.service';
import { CreateMatLabelsDto } from '../dto/receive-label.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 라벨발행')
@Controller('material/receive-label')
export class ReceiveLabelController {
  constructor(private readonly service: ReceiveLabelService) {}

  @Get('arrivals')
  @ApiOperation({ summary: '라벨 발행 가능 입하건 목록 (IQC PASS)' })
  async findLabelable() {
    const data = await this.service.findLabelableArrivals();
    return ResponseUtil.success(data);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'matUid 채번 + MatLot 생성 + 라벨 발행' })
  async createLabels(@Body() dto: CreateMatLabelsDto) {
    const data = await this.service.createMatLabels(dto);
    return ResponseUtil.success(data, `${data.length}건의 자재시리얼이 생성되었습니다.`);
  }
}
