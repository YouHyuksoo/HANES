/**
 * @file src/modules/customs/controllers/customs.controller.ts
 * @description 보세관리 API 컨트롤러
 *
 * API 구조:
 * - GET  /customs/entries            : 수입신고 목록
 * - GET  /customs/entries/:id        : 수입신고 상세
 * - POST /customs/entries            : 수입신고 등록
 * - PUT  /customs/entries/:id        : 수입신고 수정
 * - DELETE /customs/entries/:id      : 수입신고 삭제
 * - GET  /customs/lots/:entryId      : 보세자재 LOT 목록
 * - POST /customs/lots               : 보세자재 LOT 등록
 * - GET  /customs/usage              : 사용신고 목록
 * - POST /customs/usage              : 사용신고 등록
 * - PUT  /customs/usage/:id          : 사용신고 상태 변경
 * - GET  /customs/summary            : 보세관리 현황 요약
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CustomsService } from '../services/customs.service';
import {
  CreateCustomsEntryDto,
  UpdateCustomsEntryDto,
  CustomsEntryQueryDto,
  CreateCustomsLotDto,
  UpdateCustomsLotDto,
  CreateUsageReportDto,
  UpdateUsageReportDto,
  UsageReportQueryDto,
} from '../dto/customs.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('보세관리')
@Controller('customs')
export class CustomsController {
  constructor(private readonly customsService: CustomsService) {}

  // ===== 수입신고 =====

  @Get('entries')
  @ApiOperation({ summary: '수입신고 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllEntries(@Query() query: CustomsEntryQueryDto) {
    const result = await this.customsService.findAllEntries(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: '수입신고 상세 조회' })
  @ApiParam({ name: 'id', description: '수입신고 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findEntryById(@Param('id') id: string) {
    const data = await this.customsService.findEntryById(id);
    return ResponseUtil.success(data);
  }

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '수입신고 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createEntry(@Body() dto: CreateCustomsEntryDto) {
    const data = await this.customsService.createEntry(dto);
    return ResponseUtil.success(data, '수입신고가 등록되었습니다.');
  }

  @Put('entries/:id')
  @ApiOperation({ summary: '수입신고 수정' })
  @ApiParam({ name: 'id', description: '수입신고 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateEntry(@Param('id') id: string, @Body() dto: UpdateCustomsEntryDto) {
    const data = await this.customsService.updateEntry(id, dto);
    return ResponseUtil.success(data, '수입신고가 수정되었습니다.');
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '수입신고 삭제' })
  @ApiParam({ name: 'id', description: '수입신고 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteEntry(@Param('id') id: string) {
    await this.customsService.deleteEntry(id);
    return ResponseUtil.success(null, '수입신고가 삭제되었습니다.');
  }

  // ===== 보세자재 LOT =====

  @Get('lots/entry/:entryId')
  @ApiOperation({ summary: '수입신고별 보세자재 LOT 목록' })
  @ApiParam({ name: 'entryId', description: '수입신고 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findLotsByEntryId(@Param('entryId') entryId: string) {
    const data = await this.customsService.findLotsByEntryId(entryId);
    return ResponseUtil.success(data);
  }

  @Get('lots/:id')
  @ApiOperation({ summary: '보세자재 LOT 상세 조회' })
  @ApiParam({ name: 'id', description: 'LOT ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findLotById(@Param('id') id: string) {
    const data = await this.customsService.findLotById(id);
    return ResponseUtil.success(data);
  }

  @Post('lots')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '보세자재 LOT 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createLot(@Body() dto: CreateCustomsLotDto) {
    const data = await this.customsService.createLot(dto);
    return ResponseUtil.success(data, '보세자재 LOT이 등록되었습니다.');
  }

  @Put('lots/:id')
  @ApiOperation({ summary: '보세자재 LOT 수정' })
  @ApiParam({ name: 'id', description: 'LOT ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateLot(@Param('id') id: string, @Body() dto: UpdateCustomsLotDto) {
    const data = await this.customsService.updateLot(id, dto);
    return ResponseUtil.success(data, '보세자재 LOT이 수정되었습니다.');
  }

  // ===== 사용신고 =====

  @Get('usage')
  @ApiOperation({ summary: '사용신고 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllUsageReports(@Query() query: UsageReportQueryDto) {
    const result = await this.customsService.findAllUsageReports(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('usage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '사용신고 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createUsageReport(@Body() dto: CreateUsageReportDto) {
    const data = await this.customsService.createUsageReport(dto);
    return ResponseUtil.success(data, '사용신고가 등록되었습니다.');
  }

  @Put('usage/:id')
  @ApiOperation({ summary: '사용신고 상태 변경' })
  @ApiParam({ name: 'id', description: '사용신고 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateUsageReport(@Param('id') id: string, @Body() dto: UpdateUsageReportDto) {
    const data = await this.customsService.updateUsageReport(id, dto);
    return ResponseUtil.success(data, '사용신고가 수정되었습니다.');
  }

  // ===== 통계 =====

  @Get('summary')
  @ApiOperation({ summary: '보세관리 현황 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getCustomsSummary() {
    const data = await this.customsService.getCustomsSummary();
    return ResponseUtil.success(data);
  }
}
