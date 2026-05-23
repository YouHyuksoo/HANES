import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ResponseUtil } from '../../../common/dto/response.dto';
import {
  CreateEquipInspectItemPoolDto,
  EquipInspectItemPoolQueryDto,
  UpdateEquipInspectItemPoolDto,
} from '../dto/equip-inspect-item-pool.dto';
import { EquipInspectItemPoolService } from '../services/equip-inspect-item-pool.service';

@ApiTags('기준정보 - 설비점검항목 Pool')
@Controller('master/equip-inspect-item-pool')
export class EquipInspectItemPoolController {
  constructor(private readonly service: EquipInspectItemPoolService) {}

  @Get()
  @ApiOperation({ summary: '설비점검항목 Pool 목록 조회' })
  async findAll(@Query() query: EquipInspectItemPoolQueryDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비점검항목 Pool 생성' })
  async create(@Body() dto: CreateEquipInspectItemPoolDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const data = await this.service.create(dto, company, plant);
    return ResponseUtil.success(data, '설비점검항목 마스터가 생성되었습니다.');
  }

  @Put(':itemCode')
  @ApiOperation({ summary: '설비점검항목 Pool 수정' })
  async update(@Param('itemCode') itemCode: string, @Body() dto: UpdateEquipInspectItemPoolDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const data = await this.service.update(company, plant, itemCode, dto);
    return ResponseUtil.success(data, '설비점검항목 마스터가 수정되었습니다.');
  }

  @Delete(':itemCode')
  @ApiOperation({ summary: '설비점검항목 Pool 삭제' })
  async delete(@Param('itemCode') itemCode: string, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    await this.service.delete(company, plant, itemCode);
    return ResponseUtil.success(null, '설비점검항목 마스터가 삭제되었습니다.');
  }

  private tenant(req: Request) {
    const user = (req as Request & { user?: { company?: string; plant?: string } }).user ?? {};
    return {
      company: (req.headers['x-company'] as string) || user.company || '',
      plant: (req.headers['x-plant'] as string) || user.plant || '',
    };
  }
}
