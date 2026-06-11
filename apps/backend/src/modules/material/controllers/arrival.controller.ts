import { Controller, Get, Post, Patch, Body, Query, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ArrivalService } from '../services/arrival.service';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  ArrivalStockQueryDto,
  CancelArrivalDto,
  PoLineReceiptDto,
  PoLineQueryDto,
  ArrivalResultQueryDto,
  ChangeManufacturerDto,
  CancelArrivalByNoDto,
} from '../dto/arrival.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Material - Arrival')
@Controller('material/arrivals')
export class ArrivalController {
  constructor(private readonly arrivalService: ArrivalService) {}

  @Get()
  @ApiOperation({ summary: 'Get arrival history' })
  async findAll(@Query() query: ArrivalQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.arrivalService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('stock-status')
  @ApiOperation({ summary: 'Get arrival stock status' })
  async getArrivalStockStatus(@Query() query: ArrivalStockQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.arrivalService.getArrivalStockStatus(query, company, plant);
    return ResponseUtil.success(result);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get arrival stats' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('receivable-pos')
  @ApiOperation({ summary: 'Get receivable PO list' })
  async findReceivablePOs(@Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.findReceivablePOs(company, plant);
    return ResponseUtil.success(data);
  }

  // ─────────────────────────────────────────────────────────────────
  // IQC006 입하실적조회
  // ─────────────────────────────────────────────────────────────────

  @Get('results')
  @ApiOperation({ summary: 'IQC006 — 입하실적 목록 (입하번호+SEQ 집계)' })
  async listArrivalResults(@Query() query: ArrivalResultQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.arrivalService.listArrivalResults(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('results/:arrivalNo/serials')
  @ApiOperation({ summary: 'IQC006 — 입하 그룹(arrivalNo+품번)별 시리얼 목록 (입고/취소 여부)' })
  async getArrivalSerials(
    @Param('arrivalNo') arrivalNo: string,
    @Query('itemCode') itemCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.arrivalService.getArrivalSerials(arrivalNo, itemCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Patch('results/:arrivalNo/manufacturer')
  @ApiOperation({ summary: 'IQC006 — 입하 그룹 제조사 변경 (시리얼 mfgPartnerCode 일괄 갱신)' })
  async changeManufacturer(
    @Param('arrivalNo') arrivalNo: string,
    @Body() dto: ChangeManufacturerDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.arrivalService.changeManufacturer(arrivalNo, dto.itemCode, dto.mfgPartnerCode, company, plant);
    return ResponseUtil.success(data, '제조사가 변경되었습니다.');
  }

  @Post('results/:arrivalNo/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IQC006 — 입하(arrivalNo) 전체 취소' })
  async cancelByArrival(
    @Param('arrivalNo') arrivalNo: string,
    @Body() dto: CancelArrivalByNoDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.arrivalService.cancelByArrival(arrivalNo, dto.reason ?? '입하실적조회 취소', company, plant);
    return ResponseUtil.success(data, '입하가 취소되었습니다.');
  }

  @Get('by-barcode/:barcode')
  @ApiOperation({ summary: 'Find arrival by barcode' })
  async findByBarcode(@Param('barcode') barcode: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.findByBarcode(barcode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('po/:poId/items')
  @ApiOperation({ summary: 'Get PO items for arrival' })
  async getPoItems(@Param('poId') poId: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.getPoItems(poId, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('po')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create PO-based arrival' })
  async createPoArrival(@Body() dto: CreatePoArrivalDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.createPoArrival(dto, company, plant);
    return ResponseUtil.success(data, 'Arrival created');
  }

  @Post('manual')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create manual arrival' })
  async createManualArrival(@Body() dto: CreateManualArrivalDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.createManualArrival(dto, company, plant);
    return ResponseUtil.success(data, 'Manual arrival created');
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel arrival' })
  async cancel(@Body() dto: CancelArrivalDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.arrivalService.cancel(dto, company, plant);
    return ResponseUtil.success(data, 'Arrival canceled');
  }

  // ─────────────────────────────────────────────────────────────────
  // IQC005 Phase A endpoints
  // ─────────────────────────────────────────────────────────────────

  @Get('po-lines')
  @ApiOperation({ summary: 'IQC005 — list PO lines (per-line view)' })
  async listPoLines(
    @Query() query: PoLineQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.arrivalService.listPoLines(query, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('po-line')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC005 — register PO line receipt (issue N serials)' })
  async receivePoLine(
    @Body() dto: PoLineReceiptDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.arrivalService.receivePoLine(dto, {
      username: 'SYSTEM', // JWT decorator로 user 주입은 별도 task
      company,
      plant,
    });
    return ResponseUtil.success(data, 'Material receipt issued');
  }
}
