/**
 * @file src/modules/master/controllers/process-capa.controller.ts
 * @description 공정x제품별 CAPA 마스터 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET    /master/process-capas                          — CAPA 목록 조회
 * 2. POST   /master/process-capas                          — CAPA 생성
 * 3. PUT    /master/process-capas/:processCode/:itemCode   — CAPA 수정
 * 4. DELETE /master/process-capas/:processCode/:itemCode   — CAPA 삭제
 */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ProcessCapaService } from '../services/process-capa.service';
import {
  CreateProcessCapaDto,
  UpdateProcessCapaDto,
  ProcessCapaQueryDto,
} from '../dto/process-capa.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 공정 CAPA')
@Controller('master/process-capas')
export class ProcessCapaController {
  constructor(private readonly svc: ProcessCapaService) {}

  @Get()
  @ApiOperation({ summary: '공정 CAPA 목록 조회' })
  async findAll(
    @Query() query: ProcessCapaQueryDto,
    @Company() co: string,
    @Plant() pl: string,
  ) {
    const data = await this.svc.findAll(query, co, pl);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '공정 CAPA 생성' })
  async create(
    @Body() dto: CreateProcessCapaDto,
    @Company() co: string,
    @Plant() pl: string,
  ) {
    return ResponseUtil.success(
      await this.svc.create(dto, co, pl),
      '공정 CAPA가 생성되었습니다.',
    );
  }

  @Put(':processCode/:itemCode')
  @ApiOperation({ summary: '공정 CAPA 수정' })
  async update(
    @Param('processCode') processCode: string,
    @Param('itemCode') itemCode: string,
    @Body() dto: UpdateProcessCapaDto,
    @Company() co: string,
    @Plant() pl: string,
  ) {
    return ResponseUtil.success(
      await this.svc.update(processCode, itemCode, dto, co, pl),
      '공정 CAPA가 수정되었습니다.',
    );
  }

  @Delete(':processCode/:itemCode')
  @ApiOperation({ summary: '공정 CAPA 삭제' })
  async delete(
    @Param('processCode') processCode: string,
    @Param('itemCode') itemCode: string,
    @Company() co: string,
    @Plant() pl: string,
  ) {
    await this.svc.delete(processCode, itemCode, co, pl);
    return ResponseUtil.success(null, '공정 CAPA가 삭제되었습니다.');
  }
}
