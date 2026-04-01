/**
 * @file controllers/erp-material.controller.ts
 * @description G12: 자재 ERP 인터페이스 API — PO 수신 + 실적 전송 + 재시도 + 통계
 *
 * 초보자 가이드:
 * 1. POST /interface/erp/po-import — ERP에서 PO 데이터 수신
 * 2. POST /interface/erp/po-sync — PO 일괄 동기화 (배치)
 * 3. POST /interface/erp/export/* — MES→ERP 실적 수동 전송
 * 4. POST /interface/erp/retry — 실패 건 재시도
 * 5. GET /interface/erp/stats — 오늘 인터페이스 통계
 */
import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ErpMaterialService } from '../services/erp-material.service';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('인터페이스 - ERP 자재')
@Controller('interface/erp')
export class ErpMaterialController {
  constructor(private readonly erpMaterialService: ErpMaterialService) {}

  @Post('po-import')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ERP → MES: PO 단건 수신' })
  async importPo(@Body() body: any) {
    const data = await this.erpMaterialService.importPurchaseOrder(body);
    return ResponseUtil.success(data, 'PO 수신 완료');
  }

  @Post('po-sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ERP → MES: PO 일괄 동기화' })
  async syncPos(@Body() body: { poList: any[] }) {
    const data = await this.erpMaterialService.syncPurchaseOrders(body.poList);
    return ResponseUtil.success(data, 'PO 동기화 완료');
  }

  @Post('export/receiving')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MES → ERP: 입고 실적 전송' })
  async exportReceiving(@Body() body: any, @Company() company: string, @Plant() plant: string) {
    const data = await this.erpMaterialService.exportReceiving(body.refNo, body.itemCode, body.qty, body.poNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('export/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MES → ERP: 반품 실적 전송' })
  async exportReturn(@Body() body: any, @Company() company: string, @Plant() plant: string) {
    const data = await this.erpMaterialService.exportReturn(body.refNo, body.itemCode, body.qty, body.reason, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('export/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MES → ERP: 기타출고 실적 전송' })
  async exportIssue(@Body() body: any, @Company() company: string, @Plant() plant: string) {
    const data = await this.erpMaterialService.exportIssue(body.refNo, body.itemCode, body.qty, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('export/adjustment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MES → ERP: 재고보정 실적 전송' })
  async exportAdjustment(@Body() body: any, @Company() company: string, @Plant() plant: string) {
    const data = await this.erpMaterialService.exportAdjustment(body.refNo, body.itemCode, body.qty, body.reason, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '실패 건 재시도 (최대 3회)' })
  async retryFailed() {
    const data = await this.erpMaterialService.retryFailed();
    return ResponseUtil.success(data, `재시도 처리: ${data.length}건`);
  }

  @Get('stats')
  @ApiOperation({ summary: '오늘 ERP 인터페이스 통계' })
  async getStats() {
    const data = await this.erpMaterialService.getTodayStats();
    return ResponseUtil.success(data);
  }
}
