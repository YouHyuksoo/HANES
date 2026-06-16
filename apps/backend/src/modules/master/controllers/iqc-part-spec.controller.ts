/**
 * @file iqc-part-spec.controller.ts
 * @description 품목별 IQC 기준 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET  /master/iqc-part-specs           — 전체 목록
 * 2. GET  /master/iqc-part-specs/:itemCode — 특정 품목 기준 상세
 * 3. POST /master/iqc-part-specs           — upsert (없으면 생성, 있으면 수정)
 * 4. DELETE /master/iqc-part-specs/:itemCode — 삭제
 */
import {
  Controller, Get, Post, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthenticatedRequest, JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { IqcPartSpecService } from '../services/iqc-part-spec.service';
import { UpsertIqcPartSpecDto } from '../dto/iqc-part-spec.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

@ApiTags('기준정보 - 품목별 IQC 기준')
@Controller('master/iqc-part-specs')
export class IqcPartSpecController {
  constructor(private readonly service: IqcPartSpecService) {}

  @Get()
  @ApiOperation({ summary: '품목별 IQC 기준 전체 조회' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.service.findAll(company, plant, query.page, query.limit);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':itemCode/resolve-items')
  @ApiOperation({ summary: '품목별 IQC 검사항목 해석 (검사 모달용)' })
  async resolveItems(
    @Param('itemCode') itemCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.resolveItems(itemCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':itemCode')
  @ApiOperation({ summary: '품목별 IQC 기준 상세 조회' })
  async findOne(
    @Param('itemCode') itemCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.findByItemCode(itemCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '품목별 IQC 기준 저장 (upsert)' })
  async upsert(
    @Body() dto: UpsertIqcPartSpecDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id ?? 'SYSTEM';
    const data = await this.service.upsert(dto, company, plant, userId);
    return ResponseUtil.success(data, '저장되었습니다.');
  }

  @Delete(':itemCode')
  @ApiOperation({ summary: '품목별 IQC 기준 삭제' })
  async delete(
    @Param('itemCode') itemCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.service.delete(itemCode, company, plant);
    return ResponseUtil.success(null, '삭제되었습니다.');
  }
}
