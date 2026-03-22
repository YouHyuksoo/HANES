/**
 * @file src/modules/master/controllers/shift-pattern.controller.ts
 * @description 교대 패턴(Shift Pattern) API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET  /master/shift-patterns          — 교대 패턴 목록 조회
 * 2. POST /master/shift-patterns          — 교대 패턴 생성
 * 3. PUT  /master/shift-patterns/:code    — 교대 패턴 수정
 * 4. DELETE /master/shift-patterns/:code  — 교대 패턴 삭제
 */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ShiftPatternService } from '../services/shift-pattern.service';
import { CreateShiftPatternDto, UpdateShiftPatternDto } from '../dto/work-calendar.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 교대패턴')
@Controller('master/shift-patterns')
export class ShiftPatternController {
  constructor(private readonly svc: ShiftPatternService) {}

  @Get()
  @ApiOperation({ summary: '교대 패턴 목록' })
  async findAll(@Company() co: string, @Plant() pl: string) {
    const data = await this.svc.findAll(co, pl);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '교대 패턴 생성' })
  async create(@Body() dto: CreateShiftPatternDto, @Company() co: string, @Plant() pl: string) {
    return ResponseUtil.success(await this.svc.create(dto, co, pl), '교대 패턴이 생성되었습니다.');
  }

  @Put(':shiftCode')
  @ApiOperation({ summary: '교대 패턴 수정' })
  async update(
    @Param('shiftCode') shiftCode: string,
    @Body() dto: UpdateShiftPatternDto,
    @Company() co: string,
    @Plant() pl: string,
  ) {
    return ResponseUtil.success(await this.svc.update(shiftCode, dto, co, pl), '교대 패턴이 수정되었습니다.');
  }

  @Delete(':shiftCode')
  @ApiOperation({ summary: '교대 패턴 삭제' })
  async delete(
    @Param('shiftCode') shiftCode: string,
    @Company() co: string,
    @Plant() pl: string,
  ) {
    await this.svc.delete(shiftCode, co, pl);
    return ResponseUtil.success(null, '교대 패턴이 삭제되었습니다.');
  }
}
