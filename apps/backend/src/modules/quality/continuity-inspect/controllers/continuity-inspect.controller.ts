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
  PreIssueDto,
  ReInspectDto,
  VoidLabelDto,
} from '../dto/continuity-inspect.dto';
import { ContinuityInspectService } from '../services/continuity-inspect.service';

@ApiTags('Quality - Continuity Inspect')
@UseGuards(JwtAuthGuard)
@Controller('quality/continuity-inspect')
export class ContinuityInspectController {
  constructor(private readonly continuityInspectService: ContinuityInspectService) {}

  @Get('job-orders')
  @ApiOperation({ summary: 'List continuity-inspectable job orders' })
  @ApiQuery({ name: 'lineCode', required: false })
  @ApiQuery({ name: 'planDate', required: false })
  @ApiResponse({ status: 200, description: 'Success' })
  async findJobOrders(
    @Company() company: string,
    @Plant() plant: string,
    @Query('lineCode') lineCode?: string,
    @Query('planDate') planDate?: string,
  ) {
    const data = await this.continuityInspectService.findJobOrders({
      company,
      plant,
      lineCode,
      planDate,
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

  @Get('fg-labels/:orderNo')
  @ApiOperation({ summary: 'List FG labels by order' })
  @ApiParam({ name: 'orderNo' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findFgLabels(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.findFgLabelsByOrder(orderNo, company, plant);
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
  async createProtocol(@Body() body: any, @Company() company: string, @Plant() plant: string) {
    const data = await this.continuityInspectService.createProtocol(body, company, plant);
    return ResponseUtil.success(data, 'Created');
  }

  @Put('protocols/:protocolId')
  @ApiOperation({ summary: 'Update equipment protocol' })
  async updateProtocol(
    @Param('protocolId') protocolId: string,
    @Body() body: any,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.updateProtocol(protocolId, body, company, plant);
    return ResponseUtil.success(data, 'Updated');
  }

  @Delete('protocols/:protocolId')
  @ApiOperation({ summary: 'Delete equipment protocol' })
  async deleteProtocol(@Param('protocolId') protocolId: string, @Company() company: string, @Plant() plant: string) {
    await this.continuityInspectService.deleteProtocol(protocolId, company, plant);
    return ResponseUtil.success(null, 'Deleted');
  }

  @Post('pre-issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Pre-issue FG barcodes' })
  async preIssue(
    @Body() dto: PreIssueDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.continuityInspectService.preIssue(dto, company, plant);
    return ResponseUtil.success(data, `${data.issued} issued`);
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
  ) {
    const data = await this.continuityInspectService.getStats(orderNo, company, plant);
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
