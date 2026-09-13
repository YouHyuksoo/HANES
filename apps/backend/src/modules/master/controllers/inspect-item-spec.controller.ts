/**
 * @file inspect-item-spec.controller.ts
 * @description 품목별 리크/내전압/토크 스펙 API
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { InspectItemSpecService } from '../services/inspect-item-spec.service';
import {
  CreateInspectItemSpecDto,
  InspectItemSpecQueryDto,
  InspectItemSpecResolveQueryDto,
  UpdateInspectItemSpecDto,
} from '../dto/inspect-item-spec.dto';

@ApiTags('기준정보 - 검사 실측 스펙')
@Controller('master/inspect-item-specs')
export class InspectItemSpecController {
  constructor(private readonly service: InspectItemSpecService) {}

  @Get()
  @ApiOperation({ summary: '검사 스펙 목록' })
  async findAll(@Query() query: InspectItemSpecQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('resolve')
  @ApiOperation({ summary: '품목+검사유형 사용중 스펙 1건' })
  async resolve(@Query() query: InspectItemSpecResolveQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.resolve(query.itemCode, query.inspectType, company, plant, query.connectorKey);
    return ResponseUtil.success(data);
  }

  @Get(':specId')
  async findOne(@Param('specId', ParseIntPipe) specId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findById(specId, company, plant));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateInspectItemSpecDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '검사 스펙이 등록되었습니다.');
  }

  @Put(':specId')
  async update(
    @Param('specId', ParseIntPipe) specId: number,
    @Body() dto: UpdateInspectItemSpecDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(specId, dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '검사 스펙이 수정되었습니다.');
  }

  @Delete(':specId')
  async delete(@Param('specId', ParseIntPipe) specId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.delete(specId, company, plant), '삭제되었습니다.');
  }
}
