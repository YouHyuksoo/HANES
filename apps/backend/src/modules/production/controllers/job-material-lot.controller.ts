/**
 * @file controllers/job-material-lot.controller.ts
 * @description 작업지시 자재 롯트 스캔 API
 *
 * 초보자 가이드:
 * - GET  /production/job-orders/:orderNo/material-lots       : 롯트 목록 조회
 * - POST /production/job-orders/:orderNo/material-lots/scan  : 바코드 스캔 등록
 * - DELETE /production/job-orders/:orderNo/material-lots/:itemCode/:seq : 등록 취소
 */
import {
  Controller, Get, Post, Delete, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { JobMaterialLotService } from '../services/job-material-lot.service';
import { ScanBarcodeDto, ScanRequestDto } from '../dto/job-material-lot.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('생산관리 - 자재롯트 스캔')
@Controller('production/job-orders/:orderNo/material-lots')
export class JobMaterialLotController {
  constructor(private readonly svc: JobMaterialLotService) {}

  @Get()
  @ApiOperation({ summary: '작업지시 자재 롯트 목록' })
  async findAll(@Param('orderNo') orderNo: string, @Company() company?: string, @Plant() plant?: string) {
    const data = await this.svc.findByJobOrder(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('scan')
  @ApiOperation({ summary: '바코드 스캔 — LOT 검증 후 등록' })
  async scan(
    @Param('orderNo') orderNo: string,
    @Body() body: ScanRequestDto,
    @Company() company: string,
    @Plant() plant: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const dto: ScanBarcodeDto = {
      matUid: body.matUid,
      scannedBy: body.scannedBy ?? req.user?.username,
    };
    const data = await this.svc.scanAndRegister(
      orderNo, dto, body.bomItems, company, plant,
    );
    return ResponseUtil.success(data, '자재 롯트가 등록되었습니다.');
  }

  @Delete(':itemCode/:seq')
  @ApiOperation({ summary: '자재 롯트 등록 취소' })
  async remove(
    @Param('orderNo') orderNo: string,
    @Param('itemCode') itemCode: string,
    @Param('seq') seq: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    await this.svc.remove(orderNo, itemCode, Number(seq), company, plant);
    return ResponseUtil.success(null, '롯트 등록이 취소되었습니다.');
  }
}
