/**
 * @file src/modules/material/controllers/iqc-defect-receive.controller.ts
 * @description IQC 불합격자재 불량창고 수동입고 API
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { IqcDefectReceiveService } from '../services/iqc-defect-receive.service';
import { IqcDefectHistoryQueryDto, IqcDefectPendingQueryDto, IqcDefectReceiveCancelDto, IqcDefectReceiveDto } from '../dto/iqc-defect-receive.dto';

@ApiTags('자재관리 - IQC불합격자재 불량창고입고')
@Controller('material/iqc-defect-receive')
export class IqcDefectReceiveController {
  constructor(private readonly service: IqcDefectReceiveService) {}

  @Get('pending')
  @ApiOperation({ summary: '불량창고 입고 대기 목록 (IQC FAIL · 특채 아님 · 입하재고 잔량>0)' })
  async findPending(@Query() query: IqcDefectPendingQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.findPending(query, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('lookup')
  @ApiOperation({ summary: '바코드(시리얼/입하번호) → 입고 대기 행 해석' })
  async lookup(@Query('barcode') barcode: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.lookup(barcode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '불량창고 입고 실행 (입하재고 → 불량창고)' })
  async receive(@Body() dto: IqcDefectReceiveDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.receive(dto, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '불량창고 입고 취소 (불량창고 → 입하재고 원복)' })
  async cancel(@Body() dto: IqcDefectReceiveCancelDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.cancel(dto, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('history')
  @ApiOperation({ summary: '불량창고 입고/취소 이력 (자동이동 IQC_FAIL 포함)' })
  async findHistory(@Query() query: IqcDefectHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.findHistory(query, company, plant);
    return ResponseUtil.success(data);
  }
}
