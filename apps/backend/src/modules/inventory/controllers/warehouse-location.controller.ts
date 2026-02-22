/**
 * @file controllers/warehouse-location.controller.ts
 * @description 창고 로케이션 REST API 컨트롤러
 *
 * 초보자 가이드:
 * - GET    /inventory/warehouse-locations         → 전체 목록 (warehouseId 쿼리 지원)
 * - POST   /inventory/warehouse-locations         → 신규 생성
 * - PUT    /inventory/warehouse-locations/:id      → 수정
 * - DELETE /inventory/warehouse-locations/:id      → 삭제
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
} from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { WarehouseLocationService } from '../services/warehouse-location.service';
import {
  CreateWarehouseLocationDto,
  UpdateWarehouseLocationDto,
} from '../dto/warehouse-location.dto';

@Controller('inventory/warehouse-locations')
export class WarehouseLocationController {
  constructor(private readonly service: WarehouseLocationService) {}

  @Get()
  findAll(@Query('warehouseId') warehouseId?: string, @Company() company?: string, @Plant() plant?: string) {
    return this.service.findAll(warehouseId, company, plant);
  }

  @Post()
  create(@Body() dto: CreateWarehouseLocationDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseLocationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
