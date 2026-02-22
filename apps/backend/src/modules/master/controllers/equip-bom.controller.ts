/**
 * @file src/modules/master/controllers/equip-bom.controller.ts
 * @description 설비 BOM 관리 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/equip-bom/items**: BOM 품목 목록
 * 2. **GET /master/equip-bom/items/:id**: BOM 품목 상세
 * 3. **POST /master/equip-bom/items**: BOM 품목 생성
 * 4. **PUT /master/equip-bom/items/:id**: BOM 품목 수정
 * 5. **DELETE /master/equip-bom/items/:id**: BOM 품목 삭제
 * 6. **GET /master/equip-bom/rels**: 설비-BOM 연결 목록
 * 7. **GET /master/equip-bom/equip/:equipId**: 특정 설비의 BOM 목록
 * 8. **POST /master/equip-bom/rels**: 설비-BOM 연결 생성
 * 9. **PUT /master/equip-bom/rels/:id**: 설비-BOM 연결 수정
 * 10. **DELETE /master/equip-bom/rels/:id**: 설비-BOM 연결 삭제
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { EquipBomService } from '../services/equip-bom.service';
import {
  CreateEquipBomItemDto,
  UpdateEquipBomItemDto,
  EquipBomItemQueryDto,
  CreateEquipBomRelDto,
  UpdateEquipBomRelDto,
  EquipBomRelQueryDto,
} from '../dto/equip-bom.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 설비BOM')
@Controller('master/equip-bom')
export class EquipBomController {
  constructor(private readonly equipBomService: EquipBomService) {}

  // ========================================
  // BOM 품목 마스터 API
  // ========================================

  @Get('items')
  @ApiOperation({ summary: 'BOM 품목 목록 조회' })
  async findAllItems(@Query() query: EquipBomItemQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.equipBomService.findAllItems(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'BOM 품목 상세 조회' })
  async findItemById(@Param('id') id: string) {
    const data = await this.equipBomService.findItemById(id);
    return ResponseUtil.success(data);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'BOM 품목 생성' })
  async createItem(@Body() dto: CreateEquipBomItemDto) {
    const data = await this.equipBomService.createItem(dto);
    return ResponseUtil.success(data, 'BOM 품목이 생성되었습니다.');
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'BOM 품목 수정' })
  async updateItem(@Param('id') id: string, @Body() dto: UpdateEquipBomItemDto) {
    const data = await this.equipBomService.updateItem(id, dto);
    return ResponseUtil.success(data, 'BOM 품목이 수정되었습니다.');
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'BOM 품목 삭제' })
  async deleteItem(@Param('id') id: string) {
    await this.equipBomService.deleteItem(id);
    return ResponseUtil.success(null, 'BOM 품목이 삭제되었습니다.');
  }

  // ========================================
  // 설비-BOM 연결 API
  // ========================================

  @Get('rels')
  @ApiOperation({ summary: '설비-BOM 연결 목록 조회' })
  async findAllRels(@Query() query: EquipBomRelQueryDto) {
    const result = await this.equipBomService.findAllRels(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('rels/:id')
  @ApiOperation({ summary: '설비-BOM 연결 상세 조회' })
  async findRelById(@Param('id') id: string) {
    const data = await this.equipBomService.findRelById(id);
    return ResponseUtil.success(data);
  }

  @Get('equip/:equipId')
  @ApiOperation({ summary: '특정 설비의 BOM 목록 조회' })
  async getEquipBomList(@Param('equipId') equipId: string) {
    const data = await this.equipBomService.getEquipBomList(equipId);
    return ResponseUtil.success(data);
  }

  @Post('rels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비-BOM 연결 생성' })
  async createRel(@Body() dto: CreateEquipBomRelDto) {
    const data = await this.equipBomService.createRel(dto);
    return ResponseUtil.success(data, '설비-BOM 연결이 생성되었습니다.');
  }

  @Put('rels/:id')
  @ApiOperation({ summary: '설비-BOM 연결 수정' })
  async updateRel(@Param('id') id: string, @Body() dto: UpdateEquipBomRelDto) {
    const data = await this.equipBomService.updateRel(id, dto);
    return ResponseUtil.success(data, '설비-BOM 연결이 수정되었습니다.');
  }

  @Delete('rels/:id')
  @ApiOperation({ summary: '설비-BOM 연결 삭제' })
  async deleteRel(@Param('id') id: string) {
    await this.equipBomService.deleteRel(id);
    return ResponseUtil.success(null, '설비-BOM 연결이 삭제되었습니다.');
  }
}
