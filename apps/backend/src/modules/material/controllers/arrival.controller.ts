import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ArrivalService } from '../services/arrival.service';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  ArrivalStockQueryDto,
  CancelArrivalDto,
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
}
