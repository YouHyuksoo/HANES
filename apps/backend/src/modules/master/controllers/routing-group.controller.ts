/**
 * @file src/modules/master/controllers/routing-group.controller.ts
 * @description 라우팅 그룹 + 공정순서 + 양품조건 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. /master/routing-groups: 라우팅 그룹 CRUD
 * 2. /master/routing-groups/:code/processes: 공정순서 CRUD
 * 3. /master/routing-groups/:code/processes/:seq/conditions: 양품조건
 */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, HttpCode, HttpStatus, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { RoutingGroupService } from '../services/routing-group.service';
import {
  CreateRoutingGroupDto, UpdateRoutingGroupDto, RoutingGroupQueryDto,
  CreateRoutingProcessDto, UpdateRoutingProcessDto,
  BulkSaveConditionDto,
} from '../dto/routing-group.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 라우팅그룹')
@Controller('master/routing-groups')
export class RoutingGroupController {
  constructor(private readonly svc: RoutingGroupService) {}

  // ─── 라우팅 그룹 ───

  @Get()
  @ApiOperation({ summary: '라우팅 그룹 목록' })
  async findAll(@Query() q: RoutingGroupQueryDto, @Company() co: string, @Plant() pl: string) {
    const r = await this.svc.findAllGroups(q, co, pl);
    return ResponseUtil.paged(r.data, r.total, r.page, r.limit);
  }

  @Get('by-item/:itemCode')
  @ApiOperation({ summary: '품목코드로 라우팅 그룹+공정 조회 (BOM 페이지용)' })
  async findByItem(@Param('itemCode') itemCode: string) {
    const data = await this.svc.findByItemCode(itemCode);
    return ResponseUtil.success(data);
  }

  @Get(':code')
  @ApiOperation({ summary: '라우팅 그룹 상세' })
  async findOne(@Param('code') code: string) {
    return ResponseUtil.success(await this.svc.findGroupByCode(code));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '라우팅 그룹 생성' })
  async create(@Body() dto: CreateRoutingGroupDto, @Company() co: string, @Plant() pl: string) {
    return ResponseUtil.success(await this.svc.createGroup(dto, co, pl), '라우팅 그룹이 생성되었습니다.');
  }

  @Put(':code')
  @ApiOperation({ summary: '라우팅 그룹 수정' })
  async update(@Param('code') code: string, @Body() dto: UpdateRoutingGroupDto) {
    return ResponseUtil.success(await this.svc.updateGroup(code, dto), '라우팅 그룹이 수정되었습니다.');
  }

  @Delete(':code')
  @ApiOperation({ summary: '라우팅 그룹 삭제 (하위 공정+양품조건 포함)' })
  async delete(@Param('code') code: string) {
    await this.svc.deleteGroup(code);
    return ResponseUtil.success(null, '라우팅 그룹이 삭제되었습니다.');
  }

  // ─── 공정순서 ───

  @Get(':code/processes')
  @ApiOperation({ summary: '공정순서 목록' })
  async findProcesses(@Param('code') code: string) {
    return ResponseUtil.success(await this.svc.findProcesses(code));
  }

  @Post(':code/processes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '공정순서 추가' })
  async createProcess(
    @Param('code') code: string,
    @Body() dto: CreateRoutingProcessDto,
    @Company() co: string, @Plant() pl: string,
  ) {
    dto.routingCode = code;
    return ResponseUtil.success(await this.svc.createProcess(dto, co, pl), '공정이 추가되었습니다.');
  }

  @Put(':code/processes/:seq')
  @ApiOperation({ summary: '공정순서 수정' })
  async updateProcess(
    @Param('code') code: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: UpdateRoutingProcessDto,
  ) {
    return ResponseUtil.success(await this.svc.updateProcess(code, seq, dto), '공정이 수정되었습니다.');
  }

  @Delete(':code/processes/:seq')
  @ApiOperation({ summary: '공정순서 삭제 (양품조건 포함)' })
  async deleteProcess(
    @Param('code') code: string,
    @Param('seq', ParseIntPipe) seq: number,
  ) {
    await this.svc.deleteProcess(code, seq);
    return ResponseUtil.success(null, '공정이 삭제되었습니다.');
  }

  // ─── 양품조건 ───

  @Get(':code/processes/:seq/conditions')
  @ApiOperation({ summary: '양품조건 목록' })
  async findConditions(
    @Param('code') code: string,
    @Param('seq', ParseIntPipe) seq: number,
  ) {
    return ResponseUtil.success(await this.svc.findConditions(code, seq));
  }

  @Put(':code/processes/:seq/conditions/bulk')
  @ApiOperation({ summary: '양품조건 일괄 저장' })
  async bulkSave(
    @Param('code') code: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: BulkSaveConditionDto,
    @Company() co: string, @Plant() pl: string,
  ) {
    return ResponseUtil.success(
      await this.svc.bulkSaveConditions(code, seq, dto, co, pl),
      '양품조건이 저장되었습니다.',
    );
  }
}
