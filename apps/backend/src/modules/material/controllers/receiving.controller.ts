import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReceivingService } from '../services/receiving.service';
import { CreateBulkReceiveDto, ReceivingQueryDto, AutoReceiveDto } from '../dto/receiving.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { InventoryFreezeGuard } from '../../../common/guards/inventory-freeze.guard';

@ApiTags('Material - Receiving')
@Controller('material/receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Get()
  @ApiOperation({ summary: 'Get receiving history' })
  async findAll(@Query() query: ReceivingQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.receivingService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get receiving stats' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('receivable')
  @ApiOperation({ summary: 'Get receivable lots' })
  async findReceivable(@Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.findReceivable(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('receivable/by-barcode/:matUid')
  @ApiOperation({ summary: 'Get single receivable lot by serial barcode (PDA)' })
  async findReceivableByBarcode(@Param('matUid') matUid: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.findReceivableByBarcode(matUid, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('auto')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InventoryFreezeGuard)
  @ApiOperation({ summary: 'Auto receive' })
  async autoReceive(@Body() dto: AutoReceiveDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.autoReceive(dto.matUids, dto.workerId, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(InventoryFreezeGuard)
  @ApiOperation({ summary: 'Create bulk receive' })
  async createBulkReceive(@Body() dto: CreateBulkReceiveDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.createBulkReceive(dto, company, plant);
    return ResponseUtil.success(data, 'Receiving created');
  }
}
