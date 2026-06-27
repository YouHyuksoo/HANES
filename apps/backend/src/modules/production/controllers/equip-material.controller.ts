/**
 * @file src/modules/production/controllers/equip-material.controller.ts
 * @description 설비 자재 장착/해제 컨트롤러
 *
 * 라우트:
 * - POST /production/equip-material/mount    : 자재 장착
 * - GET  /production/equip-material/mounted  : 장착 목록 조회 (?equipCode=)
 * - POST /production/equip-material/unmount  : 자재 해제
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { MountMaterialDto, UnmountMaterialDto } from '../dto/equip-material.dto';
import { EquipMaterialService } from '../services/equip-material.service';

@ApiTags('생산관리 - 설비 자재 장착')
@Controller('production/equip-material')
@UseGuards(JwtAuthGuard)
export class EquipMaterialController {
  constructor(private readonly svc: EquipMaterialService) {}

  @Post('mount')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '자재 LOT를 설비에 장착 — MAT_LOTS 잔량 전량을 WIP_MAT_STOCKS로 이동' })
  async mount(
    @Body() dto: MountMaterialDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.svc.mount(
      dto.equipCode,
      dto.matUid,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '자재가 설비에 장착되었습니다.');
  }

  @Get('mounted')
  @ApiOperation({ summary: '설비에 장착된 자재 목록 조회 (availableQty>0)' })
  @ApiQuery({ name: 'equipCode', required: true, description: '설비 코드' })
  async listMounted(
    @Query('equipCode') equipCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.listMounted(equipCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('proc-waiting')
  @ApiOperation({ summary: '설비 공정의 장착 대기 공정재고 목록 조회 (availableQty>0)' })
  @ApiQuery({ name: 'equipCode', required: true, description: '설비 코드' })
  async listProcWaiting(
    @Query('equipCode') equipCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.listProcWaiting(equipCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('unmount')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '설비 자재 해제 — WIP_MAT_STOCKS 잔량을 MAT_LOTS로 복원' })
  async unmount(
    @Body() dto: UnmountMaterialDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.svc.unmount(dto.equipCode, dto.matUid, company, plant);
    return ResponseUtil.success(null, '자재가 설비에서 해제되었습니다.');
  }
}
