import { Controller, Get, Post, Body, Query, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PhysicalInvService } from '../services/physical-inv.service';
import {
  CreatePhysicalInvDto,
  PhysicalInvHistoryQueryDto,
  StartPhysicalInvSessionDto,
  CompletePhysicalInvSessionDto,
  PdaScanCountDto,
  PhysicalInvCountQueryDto,
} from '../dto/physical-inv.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('Material - Physical Inventory')
@Controller('material/physical-inv')
export class PhysicalInvController {
  constructor(private readonly physicalInvService: PhysicalInvService) {}

  @Get()
  @ApiOperation({ summary: 'List stocks with counted quantities by month/session' })
  async findStocks(
    @Query() query: PhysicalInvCountQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.physicalInvService.findStocksWithCounts(query, company, plant);
    return ResponseUtil.success(result);
  }

  @Get('history')
  @ApiOperation({ summary: 'Physical inventory adjustment history' })
  async findHistory(
    @Query() query: PhysicalInvHistoryQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.physicalInvService.findHistory(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('session/active')
  @ApiOperation({ summary: 'PDA: get active inventory session' })
  async getActiveSession(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getActiveSession(company, plant);
    if (!data) {
      return ResponseUtil.success(null, 'No active inventory session.');
    }
    return ResponseUtil.success(data);
  }

  @Get('session/:sessionDate/:seq/location/:locationCode')
  @ApiOperation({ summary: 'PDA: list items in a location for a session' })
  @ApiParam({ name: 'sessionDate', description: 'Session date (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: 'Session sequence number' })
  @ApiParam({ name: 'locationCode', description: 'Location code' })
  async getLocationItems(
    @Param('sessionDate') sessionDate: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Param('locationCode') locationCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getLocationItems(sessionDate, seq, locationCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PDA: scan barcode and increment counted quantity' })
  async scanCount(
    @Body() dto: PdaScanCountDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.scanCount(dto, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('session')
  @ApiOperation({ summary: 'Get current inventory session status' })
  async getSessionStatus(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getSessionStatus(company, plant);
    return ResponseUtil.success(data);
  }

  @Post('session/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start inventory session' })
  async startSession(
    @Body() dto: StartPhysicalInvSessionDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.startSession(dto, company, plant);
    return ResponseUtil.success(data, 'Inventory session started.');
  }

  @Post('session/:sessionDate/:seq/complete')
  @ApiOperation({ summary: 'Complete inventory session' })
  @ApiParam({ name: 'sessionDate', description: 'Session date (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: 'Session sequence number' })
  async completeSession(
    @Param('sessionDate') sessionDate: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: CompletePhysicalInvSessionDto,
  ) {
    const data = await this.physicalInvService.completeSession(sessionDate, seq, dto);
    return ResponseUtil.success(data, 'Inventory session completed.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply inventory count result' })
  async apply(
    @Body() dto: CreatePhysicalInvDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.applyCount(dto, company, plant);
    return ResponseUtil.success(data, 'Inventory count applied.');
  }
}
