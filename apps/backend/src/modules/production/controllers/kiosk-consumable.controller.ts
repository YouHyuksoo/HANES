/**
 * @file controllers/kiosk-consumable.controller.ts
 * @description 키오스크 소모품 매핑 조회 + conUid 롯트 스캔 장착 API
 *
 * - GET    /production/job-orders/:orderNo/consumables          : 매핑 소모품 + 장착 현황
 * - POST   /production/job-orders/:orderNo/consumables/scan     : conUid 스캔 장착
 * - DELETE /production/job-orders/:orderNo/consumables/:conUid  : 장착 해제
 */
import {
  Controller, Get, Post, Delete, Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KioskConsumableService } from '../services/kiosk-consumable.service';
import { ScanConsumableMountDto } from '../dto/kiosk-consumable.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('생산관리 - 키오스크 소모품')
@Controller('production/job-orders/:orderNo/consumables')
export class KioskConsumableController {
  constructor(private readonly svc: KioskConsumableService) {}

  @Get()
  @ApiOperation({ summary: '작업지시(모델+설비) 매핑 소모품 + 장착 현황' })
  async findAll(
    @Param('orderNo') orderNo: string,
    @Query('equipCode') equipCode?: string,
    @Query('includeMounted') includeMounted?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const withMounted = includeMounted === '1' || includeMounted === 'true';
    const data = await this.svc.findByJobOrder(orderNo, company, plant, equipCode, withMounted);
    return ResponseUtil.success(data);
  }

  @Post('scan')
  @ApiOperation({ summary: '바코드(conUid) 스캔 — 소모품 롯트 설비 장착' })
  async scan(
    @Param('orderNo') orderNo: string,
    @Body() body: ScanConsumableMountDto,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.svc.scanMount(orderNo, body.conUid, company, plant, body.equipCode);
    return ResponseUtil.success(data, '소모품 롯트가 장착되었습니다.');
  }

  @Delete(':conUid')
  @ApiOperation({ summary: '소모품 롯트 장착 해제' })
  async remove(
    @Param('conUid') conUid: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    await this.svc.unmount(conUid, company, plant);
    return ResponseUtil.success(null, '소모품 롯트 장착이 해제되었습니다.');
  }
}
