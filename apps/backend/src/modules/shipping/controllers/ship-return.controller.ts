/**
 * @file src/modules/shipping/controllers/ship-return.controller.ts
 * @description 출하반품 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/returns
 * 2. **CRUD**: 반품 등록/조회/수정/삭제
 *
 * API 경로:
 * - GET    /shipping/returns       반품 목록 조회
 * - GET    /shipping/returns/:id   반품 상세 조회
 * - POST   /shipping/returns       반품 생성
 * - PUT    /shipping/returns/:id   반품 수정
 * - DELETE /shipping/returns/:id   반품 삭제
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
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ShipReturnService } from '../services/ship-return.service';
import { CreateShipReturnDto, UpdateShipReturnDto, ShipReturnQueryDto } from '../dto/ship-return.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 출하반품')
@Controller('shipping/returns')
export class ShipReturnController {
  constructor(private readonly shipReturnService: ShipReturnService) {}

  @Get()
  @ApiOperation({ summary: '반품 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ShipReturnQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.shipReturnService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '반품 상세 조회' })
  @ApiParam({ name: 'id', description: '반품 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.shipReturnService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '반품 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(@Body() dto: CreateShipReturnDto) {
    const data = await this.shipReturnService.create(dto);
    return ResponseUtil.success(data, '반품이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '반품 수정' })
  @ApiParam({ name: 'id', description: '반품 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateShipReturnDto) {
    const data = await this.shipReturnService.update(id, dto);
    return ResponseUtil.success(data, '반품이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '반품 삭제' })
  @ApiParam({ name: 'id', description: '반품 ID' })
  async delete(@Param('id') id: string) {
    await this.shipReturnService.delete(id);
    return ResponseUtil.success(null, '반품이 삭제되었습니다.');
  }
}
