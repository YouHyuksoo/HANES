/**
 * @file src/modules/material/controllers/mat-lot.controller.ts
 * @description 자재LOT CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MatLotService } from '../services/mat-lot.service';
import { CreateMatLotDto, UpdateMatLotDto, MatLotQueryDto } from '../dto/mat-lot.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 자재시리얼')
@Controller('material/lots')
export class MatLotController {
  constructor(private readonly matLotService: MatLotService) {}

  @Get()
  @ApiOperation({ summary: '자재시리얼 목록 조회' })
  async findAll(@Query() query: MatLotQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.matLotService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('by-uid/:matUid')
  @ApiOperation({ summary: '자재시리얼(matUid)로 조회' })
  @ApiParam({ name: 'matUid', description: '자재시리얼' })
  async findByMatUid(@Param('matUid') matUid: string) {
    const data = await this.matLotService.findByMatUid(matUid);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'LOT 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.matLotService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'LOT 생성 (입고)' })
  async create(@Body() dto: CreateMatLotDto) {
    const data = await this.matLotService.create(dto);
    return ResponseUtil.success(data, 'LOT이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'LOT 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateMatLotDto) {
    const data = await this.matLotService.update(id, dto);
    return ResponseUtil.success(data, 'LOT이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'LOT 삭제' })
  async delete(@Param('id') id: string) {
    await this.matLotService.delete(id);
    return ResponseUtil.success(null, 'LOT이 삭제되었습니다.');
  }

  @Post(':id/consume')
  @ApiOperation({ summary: 'LOT 재고 차감' })
  async consume(@Param('id') id: string, @Body('qty') qty: number) {
    const data = await this.matLotService.consumeQty(id, qty);
    return ResponseUtil.success(data, '재고가 차감되었습니다.');
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'LOT 재고 반납' })
  async return(@Param('id') id: string, @Body('qty') qty: number) {
    const data = await this.matLotService.returnQty(id, qty);
    return ResponseUtil.success(data, '재고가 반납되었습니다.');
  }
}
