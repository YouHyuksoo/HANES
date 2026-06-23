/**
 * @file controllers/kiosk-material.controller.ts
 * @description 키오스크 자재 설비 장착 API (BOM 오장착 가드)
 *
 * - POST /production/job-orders/:orderNo/material-mounts/scan : matUid 스캔 → 설비 장착
 *
 * 목록 조회/해제는 설비(equipCode) 단위이므로 기존 엔드포인트를 재사용한다:
 * - GET  /production/equip-material/mounted?equipCode=
 * - POST /production/equip-material/unmount
 */
import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KioskMaterialService } from '../services/kiosk-material.service';
import { ScanMaterialMountDto } from '../dto/kiosk-material.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('생산관리 - 키오스크 자재')
@Controller('production/job-orders/:orderNo/material-mounts')
export class KioskMaterialController {
  constructor(private readonly svc: KioskMaterialService) {}

  @Post('scan')
  @ApiOperation({ summary: '바코드(matUid) 스캔 — 자재 LOT 설비 장착(BOM 오장착 검증)' })
  async scan(
    @Param('orderNo') orderNo: string,
    @Body() body: ScanMaterialMountDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.scanMount(orderNo, body.matUid, company, plant, body.equipCode);
    return ResponseUtil.success(data, '자재가 설비에 장착되었습니다.');
  }
}
