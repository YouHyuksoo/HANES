/**
 * @file src/modules/master/controllers/routing.controller.ts
 * @description 공정라우팅(ProcessMap) CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/routings**: 라우팅 목록 조회 (partId 필터 지원)
 * 2. **POST /master/routings**: 라우팅 생성
 * 3. **PUT /master/routings/:id**: 라우팅 수정
 * 4. **DELETE /master/routings/:id**: 라우팅 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoutingService } from '../services/routing.service';
import { CreateRoutingDto, UpdateRoutingDto, RoutingQueryDto } from '../dto/routing.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 공정라우팅')
@Controller('master/routings')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get()
  @ApiOperation({ summary: '라우팅 목록 조회' })
  async findAll(@Query() query: RoutingQueryDto) {
    const result = await this.routingService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '라우팅 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.routingService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '라우팅 생성' })
  async create(@Body() dto: CreateRoutingDto) {
    const data = await this.routingService.create(dto);
    return ResponseUtil.success(data, '라우팅이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '라우팅 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoutingDto) {
    const data = await this.routingService.update(id, dto);
    return ResponseUtil.success(data, '라우팅이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '라우팅 삭제' })
  async delete(@Param('id') id: string) {
    await this.routingService.delete(id);
    return ResponseUtil.success(null, '라우팅이 삭제되었습니다.');
  }
}
