/**
 * @file src/modules/master/controllers/routing.controller.ts
 * @description 공정라우팅(ProcessMap) CRUD API 컨트롤러 - 복합키 (itemCode + seq)
 *
 * 초보자 가이드:
 * 1. **GET /master/routings**: 라우팅 목록 조회 (itemCode 필터 지원)
 * 2. **POST /master/routings**: 라우팅 생성
 * 3. **PUT /master/routings/:itemCode/:seq**: 라우팅 수정
 * 4. **DELETE /master/routings/:itemCode/:seq**: 라우팅 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { RoutingService } from '../services/routing.service';
import { CreateRoutingDto, UpdateRoutingDto, RoutingQueryDto } from '../dto/routing.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 공정라우팅')
@Controller('master/routings')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get()
  @ApiOperation({ summary: '라우팅 목록 조회' })
  async findAll(@Query() query: RoutingQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.routingService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':itemCode/:seq')
  @ApiOperation({ summary: '라우팅 상세 조회' })
  async findByKey(@Param('itemCode') itemCode: string, @Param('seq', ParseIntPipe) seq: number) {
    const data = await this.routingService.findByKey(itemCode, seq);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '라우팅 생성' })
  async create(@Body() dto: CreateRoutingDto) {
    const data = await this.routingService.create(dto);
    return ResponseUtil.success(data, '라우팅이 생성되었습니다.');
  }

  @Put(':itemCode/:seq')
  @ApiOperation({ summary: '라우팅 수정' })
  async update(@Param('itemCode') itemCode: string, @Param('seq', ParseIntPipe) seq: number, @Body() dto: UpdateRoutingDto) {
    const data = await this.routingService.update(itemCode, seq, dto);
    return ResponseUtil.success(data, '라우팅이 수정되었습니다.');
  }

  @Delete(':itemCode/:seq')
  @ApiOperation({ summary: '라우팅 삭제' })
  async delete(@Param('itemCode') itemCode: string, @Param('seq', ParseIntPipe) seq: number) {
    await this.routingService.delete(itemCode, seq);
    return ResponseUtil.success(null, '라우팅이 삭제되었습니다.');
  }
}
