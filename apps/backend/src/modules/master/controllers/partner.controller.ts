/**
 * @file src/modules/master/controllers/partner.controller.ts
 * @description 거래처마스터 CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PartnerService } from '../services/partner.service';
import { CreatePartnerDto, UpdatePartnerDto, PartnerQueryDto } from '../dto/partner.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { PARTNER_TYPE_VALUES } from '@hanes/shared';

@ApiTags('기준정보 - 거래처마스터')
@Controller('master/partners')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get('statistics')
  @ApiOperation({ summary: '거래처 통계 조회' })
  async getStatistics() {
    const data = await this.partnerService.getStatistics();
    return ResponseUtil.success(data);
  }

  @Get('types/:type')
  @ApiOperation({ summary: '거래처 유형별 목록 조회' })
  @ApiParam({ name: 'type', enum: PARTNER_TYPE_VALUES })
  async findByType(@Param('type') type: string) {
    const data = await this.partnerService.findByType(type);
    return ResponseUtil.success(data);
  }

  @Get('code/:partnerCode')
  @ApiOperation({ summary: '거래처 코드로 조회' })
  async findByCode(@Param('partnerCode') partnerCode: string) {
    const data = await this.partnerService.findByCode(partnerCode);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '거래처 목록 조회' })
  async findAll(@Query() query: PartnerQueryDto) {
    const result = await this.partnerService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '거래처 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.partnerService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '거래처 생성' })
  async create(@Body() dto: CreatePartnerDto) {
    const data = await this.partnerService.create(dto);
    return ResponseUtil.success(data, '거래처가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '거래처 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    const data = await this.partnerService.update(id, dto);
    return ResponseUtil.success(data, '거래처가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '거래처 삭제' })
  async delete(@Param('id') id: string) {
    await this.partnerService.delete(id);
    return ResponseUtil.success(null, '거래처가 삭제되었습니다.');
  }
}
