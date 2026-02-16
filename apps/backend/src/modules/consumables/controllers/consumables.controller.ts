/**
 * @file src/modules/consumables/controllers/consumables.controller.ts
 * @description 소모품관리 API 컨트롤러
 *
 * API 구조:
 * - GET  /consumables                : 소모품 목록
 * - GET  /consumables/:id            : 소모품 상세
 * - POST /consumables                : 소모품 등록
 * - PUT  /consumables/:id            : 소모품 수정
 * - DELETE /consumables/:id          : 소모품 삭제
 * - GET  /consumables/logs           : 입출고 이력 목록
 * - POST /consumables/logs           : 입출고 이력 등록
 * - POST /consumables/shot-count     : 타수 업데이트
 * - POST /consumables/reset          : 타수 리셋
 * - GET  /consumables/summary        : 현황 요약
 * - GET  /consumables/warning        : 경고/교체 필요 목록
 * - GET  /consumables/life-status    : 수명 현황
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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ConsumablesService } from '../services/consumables.service';
import {
  CreateConsumableDto,
  UpdateConsumableDto,
  ConsumableQueryDto,
  CreateConsumableLogDto,
  ConsumableLogQueryDto,
  UpdateShotCountDto,
  ResetShotCountDto,
} from '../dto/consumables.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('소모품관리')
@Controller('consumables')
export class ConsumablesController {
  constructor(private readonly consumablesService: ConsumablesService) {}

  // ===== 소모품 마스터 =====

  @Get()
  @ApiOperation({ summary: '소모품 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ConsumableQueryDto, @Req() req: Request) {
    const company = req.headers['x-company'] as string | undefined;
    const result = await this.consumablesService.findAll(query, company);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary')
  @ApiOperation({ summary: '소모품 현황 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary() {
    const data = await this.consumablesService.getSummary();
    return ResponseUtil.success(data);
  }

  @Get('warning')
  @ApiOperation({ summary: '경고/교체 필요 소모품 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getWarningList() {
    const data = await this.consumablesService.getWarningList();
    return ResponseUtil.success(data);
  }

  @Get('life-status')
  @ApiOperation({ summary: '소모품 수명 현황' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getLifeStatus() {
    const data = await this.consumablesService.getLifeStatus();
    return ResponseUtil.success(data);
  }

  @Get('stock-status')
  @ApiOperation({ summary: '소모품 재고 현황' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStockStatus(@Query() query: ConsumableQueryDto) {
    const result = await this.consumablesService.getStockStatus(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('logs')
  @ApiOperation({ summary: '입출고 이력 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllLogs(@Query() query: ConsumableLogQueryDto) {
    const result = await this.consumablesService.findAllLogs(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '소모품 상세 조회' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findById(@Param('id') id: string) {
    const data = await this.consumablesService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '소모품 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(@Body() dto: CreateConsumableDto) {
    const data = await this.consumablesService.create(dto);
    return ResponseUtil.success(data, '소모품이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '소모품 수정' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(@Param('id') id: string, @Body() dto: UpdateConsumableDto) {
    const data = await this.consumablesService.update(id, dto);
    return ResponseUtil.success(data, '소모품이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '소모품 삭제' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.consumablesService.delete(id);
    return ResponseUtil.success(null, '소모품이 삭제되었습니다.');
  }

  // ===== 입출고 이력 =====

  @Post('logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '입출고 이력 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createLog(@Body() dto: CreateConsumableLogDto) {
    const data = await this.consumablesService.createLog(dto);
    return ResponseUtil.success(data, '입출고 이력이 등록되었습니다.');
  }

  // ===== 타수 관리 =====

  @Post('shot-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '타수 업데이트' })
  @ApiResponse({ status: 200, description: '업데이트 성공' })
  async updateShotCount(@Body() dto: UpdateShotCountDto) {
    const data = await this.consumablesService.updateShotCount(dto);
    return ResponseUtil.success(data, '타수가 업데이트되었습니다.');
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '타수 리셋 (교체 시)' })
  @ApiResponse({ status: 200, description: '리셋 성공' })
  async resetShotCount(@Body() dto: ResetShotCountDto) {
    const data = await this.consumablesService.resetShotCount(dto);
    return ResponseUtil.success(data, '타수가 리셋되었습니다.');
  }
}
