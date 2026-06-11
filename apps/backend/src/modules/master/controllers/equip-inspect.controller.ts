import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { EquipInspectService } from '../services/equip-inspect.service';
import { CreateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { getHeaderString } from '../../../common/utils/header-value.util';
import { getRequestUser } from '../../../common/utils/request-user.util';

@ApiTags('기준정보 - 설비점검항목')
@Controller('master/equip-inspect-items')
export class EquipInspectController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get()
  @ApiOperation({ summary: '설비점검항목 목록 조회 (설비코드 필터)' })
  async findAll(@Query() query: EquipInspectItemQueryDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const result = await this.equipInspectService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비점검항목 등록 (설비+항목코드+점검유형)' })
  async create(@Body() dto: CreateEquipInspectItemDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const data = await this.equipInspectService.create(dto, company, plant);
    return ResponseUtil.success(data, '설비점검항목이 등록되었습니다.');
  }

  @Delete(':equipCode/:itemCode/:inspectType')
  @ApiOperation({ summary: '설비점검항목 삭제 (equipCode/itemCode/inspectType)' })
  async delete(
    @Param('equipCode') equipCode: string,
    @Param('itemCode') itemCode: string,
    @Param('inspectType') inspectType: string,
    @Req() req: Request,
  ) {
    const { company, plant } = this.tenant(req);
    await this.equipInspectService.delete(company, plant, equipCode, itemCode, inspectType);
    return ResponseUtil.success(null, '설비점검항목이 삭제되었습니다.');
  }

  private tenant(req: Request) {
    const user = getRequestUser(req) ?? {};
    return {
      company: getHeaderString(req.headers['x-company']) || user.company || '',
      plant: getHeaderString(req.headers['x-plant']) || user.plant || '',
    };
  }
}
