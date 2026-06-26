import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import {
  AutoInspectDto,
  ContinuityInspectDto,
  CreateEquipProtocolDto,
  ReInspectDto,
  UpdateEquipProtocolDto,
  VoidLabelDto,
  IntegratedInspectDto,
} from '../dto/continuity-inspect.dto';
import { ContinuityInspectService } from '../services/continuity-inspect.service';

@ApiTags('Quality - Continuity Inspect')
@Controller('quality/continuity-inspect')
export class ContinuityInspectController {
  constructor(private readonly continuityInspectService: ContinuityInspectService) {}

  @Get('job-orders')
  @ApiOperation({ summary: 'List continuity-inspectable job orders' })
  @ApiQuery({ name: 'lineCode', required: false })
  @ApiQuery({ name: 'planDate', required: false })
  @ApiQuery({ name: 'finishedOnly', required: false, description: '완제품(FINISHED) 작업지시만 조회' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findJobOrders(
    @Company() company: string,
    @Plant() plant: string,
    @Query('lineCode') lineCode?: string,
    @Query('planDate') planDate?: string,
    @Query('finishedOnly') finishedOnly?: string,
  ) {
    const data = await this.continuityInspectService.findJobOrders({
      company,
      plant,
      lineCode,
      planDate,
      finishedOnly: finishedOnly === 'true',
    });
    return ResponseUtil.success(data);
  }

  @Get('fg-label/:fgBarcode')
  @ApiOperation({ summary: 'Get FG label by barcode' })
  @ApiParam({ name: 'fgBarcode' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findFgLabel(
    @Param('fgBarcode') fgBarcode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.findFgLabel(fgBarcode, company, plant);
    return ResponseUtil.success(data);
  }

  @Put('fg-label-status/:fgBarcode')
  @ApiOperation({ summary: 'Update FG label status' })
  @ApiParam({ name: 'fgBarcode' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async updateFgLabelStatus(
    @Param('fgBarcode') fgBarcode: string,
    @Body() body: { status: string },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.updateFgLabelStatus(
      fgBarcode,
      body.status,
      company,
      plant,
    );
    return ResponseUtil.success(data, 'Status updated');
  }

  @Post('visual-inspect/:fgBarcode')
  @ApiOperation({ summary: '외관검사 — 검사결과 기록 + FG라벨 상태전이(원자적)' })
  @ApiParam({ name: 'fgBarcode' })
  @ApiResponse({ status: 201, description: 'Inspected' })
  async visualInspect(
    @Param('fgBarcode') fgBarcode: string,
    @Body()
    body: {
      passYn: 'Y' | 'N';
      errorCode?: string | null;
      errorDetail?: string | null;
      inspectData?: string | null;
      inspectorId?: string | null;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.visualInspect(
      fgBarcode,
      body,
      company,
      plant,
    );
    return ResponseUtil.success(data, '외관검사가 등록되었습니다.');
  }

  @Get('fg-labels')
  @ApiOperation({ summary: 'Search FG labels' })
  @ApiQuery({ name: 'search', required: false, description: '바코드/품목코드/지시번호 검색' })
  @ApiQuery({ name: 'status', required: false, description: '라벨 상태 필터' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAllFgLabels(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.continuityInspectService.findAllFgLabels({
      search,
      status,
      company,
      plant,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return ResponseUtil.paged(data.data, data.total, data.page, data.limit);
  }

  @Get('inspect-history/:orderNo')
  @ApiOperation({ summary: '작업지시별 검사 이력 조회 (PASS+FAIL 포함)' })
  @ApiParam({ name: 'orderNo' })
  async getInspectHistory(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
    @Query('inspectType') inspectType?: string,
  ) {
    const data = await this.continuityInspectService.findInspectHistory(orderNo, company, plant, inspectType);
    return ResponseUtil.success(data);
  }

  @Get('fg-labels/:orderNo')
  @ApiOperation({ summary: 'List FG labels by order' })
  @ApiParam({ name: 'orderNo' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findFgLabels(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
    @Query('inspectType') inspectType?: string,
  ) {
    const data = await this.continuityInspectService.findFgLabelsByOrder(orderNo, company, plant, inspectType);
    return ResponseUtil.success(data);
  }

  @Post('inspect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register continuity inspection' })
  @ApiResponse({ status: 201, description: 'Created' })
  async inspect(
    @Body() dto: ContinuityInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.continuityInspectService.inspect(dto, company, plant);
    const message = dto.passYn === 'Y' ? `PASS: ${result.fgBarcode}` : 'FAIL recorded';
    return ResponseUtil.success(result, message);
  }

  @Post('integrated-inspect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '통합검사 — 회로/리크/내전압/구조 4개 검사 동시 처리' })
  @ApiResponse({ status: 201, description: 'Inspected' })
  async integratedInspect(
    @Body() dto: IntegratedInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.integratedInspect(dto, company, plant);
    const message = data.overallPass ? `통합검사 PASS: ${data.fgBarcode}` : '통합검사 FAIL (일부 스텝 불합격)';
    return ResponseUtil.success(data, message);
  }

  @Post('structure-inspect/:fgBarcode')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '구조검사 — DIM\'S/부재자누락 검사 결과 등록' })
  @ApiParam({ name: 'fgBarcode' })
  @ApiResponse({ status: 201, description: 'Inspected' })
  async structureInspect(
    @Param('fgBarcode') fgBarcode: string,
    @Body()
    body: {
      passYn: 'Y' | 'N';
      errorCode?: string | null;
      errorDetail?: string | null;
      inspectData?: string | null;
      inspectorId?: string | null;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.structureInspect(
      fgBarcode,
      body,
      company,
      plant,
    );
    return ResponseUtil.success(data, '구조검사가 등록되었습니다.');
  }

  @Post('auto-inspect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register auto continuity inspection' })
  @ApiResponse({ status: 201, description: 'Created' })
  async autoInspect(
    @Body() dto: AutoInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.continuityInspectService.autoInspect(dto, company, plant);
    const message = result.fgBarcode ? `PASS: ${result.fgBarcode}` : 'FAIL recorded';
    return ResponseUtil.success(result, message);
  }

  @Get('protocols')
  @ApiOperation({ summary: 'List equipment protocols' })
  async findProtocols(@Company() company: string, @Plant() plant: string) {
    const data = await this.continuityInspectService.findProtocols(company, plant);
    return ResponseUtil.success(data);
  }

  @Post('protocols')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create equipment protocol' })
  async createProtocol(@Body() dto: CreateEquipProtocolDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.continuityInspectService.createProtocol(dto, company, plant);
    return ResponseUtil.success(data, 'Created');
  }

  @Put('protocols/:protocolId')
  @ApiOperation({ summary: 'Update equipment protocol' })
  async updateProtocol(
    @Param('protocolId') protocolId: string,
    @Body() dto: UpdateEquipProtocolDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.updateProtocol(protocolId, dto, company, plant);
    return ResponseUtil.success(data, 'Updated');
  }

  @Delete('protocols/:protocolId')
  @ApiOperation({ summary: 'Delete equipment protocol' })
  async deleteProtocol(@Param('protocolId') protocolId: string, @Company() company: string, @Plant() plant: string) {
    await this.continuityInspectService.deleteProtocol(protocolId, company, plant);
    return ResponseUtil.success(null, 'Deleted');
  }

  @Get('pending/:orderNo')
  @ApiOperation({ summary: 'List pending FG labels by order' })
  async getPendingLabels(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.getPendingLabels(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('re-inspect/:fgBarcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-inspect by FG barcode' })
  async reInspect(
    @Param('fgBarcode') fgBarcode: string,
    @Body() dto: ReInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.reInspect(fgBarcode, dto, company, plant);
    const message = dto.passYn === 'Y' ? `Re-inspect PASS: ${fgBarcode}` : 'Re-inspect FAIL';
    return ResponseUtil.success(data, message);
  }

  @Get('stats/:orderNo')
  @ApiOperation({ summary: 'Get continuity inspect stats by order' })
  async getStats(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
    @Query('inspectType') inspectType?: string,
  ) {
    const data = await this.continuityInspectService.getStats(orderNo, company, plant, inspectType);
    return ResponseUtil.success(data);
  }

  @Post('reprint/:fgBarcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reprint FG label' })
  async reprintLabel(
    @Param('fgBarcode') fgBarcode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.reprintLabel(fgBarcode, company, plant);
    return ResponseUtil.success(data, 'Reprinted');
  }

  @Post('void/:fgBarcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void FG label' })
  async voidLabel(
    @Param('fgBarcode') fgBarcode: string,
    @Body() dto: VoidLabelDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.voidLabel(
      fgBarcode,
      dto.reason,
      company,
      plant,
    );
    return ResponseUtil.success(data, 'Voided');
  }
}
