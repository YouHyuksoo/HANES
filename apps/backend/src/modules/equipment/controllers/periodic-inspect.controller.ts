/**
 * @file src/modules/equipment/controllers/periodic-inspect.controller.ts
 * @description 설비 정기점검 API 컨트롤러 (inspectType=PERIODIC 고정)
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/equipment/periodic-inspect
 * 2. inspectType을 'PERIODIC'으로 고정하여 정기점검만 처리
 *
 * API 경로:
 * - GET    /equipment/periodic-inspect       정기점검 목록 조회
 * - GET    /equipment/periodic-inspect/:id   정기점검 상세 조회
 * - POST   /equipment/periodic-inspect       정기점검 등록
 * - PUT    /equipment/periodic-inspect/:id   정기점검 수정
 * - DELETE /equipment/periodic-inspect/:id   정기점검 삭제
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
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { EquipInspectService } from '../services/equip-inspect.service';
import { CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto } from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - 정기점검')
@Controller('equipment/periodic-inspect')
export class PeriodicInspectController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get()
  @ApiOperation({ summary: '정기점검 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: EquipInspectQueryDto) {
    const result = await this.equipInspectService.findAll({ ...query, inspectType: 'PERIODIC' });
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '정기점검 상세 조회' })
  @ApiParam({ name: 'id', description: '점검 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.equipInspectService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '정기점검 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(@Body() dto: CreateEquipInspectDto) {
    const data = await this.equipInspectService.create({ ...dto, inspectType: 'PERIODIC' });
    return ResponseUtil.success(data, '정기점검이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '정기점검 수정' })
  @ApiParam({ name: 'id', description: '점검 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateEquipInspectDto) {
    const data = await this.equipInspectService.update(id, dto);
    return ResponseUtil.success(data, '정기점검이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '정기점검 삭제' })
  @ApiParam({ name: 'id', description: '점검 ID' })
  async delete(@Param('id') id: string) {
    await this.equipInspectService.delete(id);
    return ResponseUtil.success(null, '정기점검이 삭제되었습니다.');
  }
}
