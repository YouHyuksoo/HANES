import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { AqlService } from '../services/aql.service';
import { AqlQueryDto, CreateAqlDto, CreateIqcAqlPolicyDto, UpdateAqlDto, UpdateIqcAqlPolicyDto } from '../dto/aql.dto';

@ApiTags('품질관리 - AQL 기준관리')
@Controller('quality/aql')
export class AqlController {
  constructor(private readonly aqlService: AqlService) {}

  @Get()
  @ApiOperation({ summary: 'AQL 기준 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: AqlQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.aqlService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'AQL 기준과 LOT 수량으로 sampling rule 산출' })
  async resolve(
    @Query('aqlCode') aqlCode: string,
    @Query('lotQty') lotQty: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.aqlService.resolveByAqlCode(aqlCode, Number(lotQty), company, plant);
    return ResponseUtil.success(data);
  }

  @Get('policies')
  @ApiOperation({ summary: 'IQC AQL 정책 목록 조회' })
  async findPolicies(
    @Query('useYn') useYn: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.aqlService.findPolicies({ useYn }, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('iso')
  @ApiOperation({ summary: 'ISO 2859 AQL Code Letter / Sampling Plan 표 조회' })
  async findIsoTables(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.aqlService.findIsoTables(company, plant);
    return ResponseUtil.success(data);
  }

  @Post('policies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC AQL 정책 등록' })
  async createPolicy(
    @Body() dto: CreateIqcAqlPolicyDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.aqlService.createPolicy(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'IQC AQL 정책이 등록되었습니다.');
  }

  @Put('policies/:policyCode')
  @ApiOperation({ summary: 'IQC AQL 정책 수정' })
  async updatePolicy(
    @Param('policyCode') policyCode: string,
    @Body() dto: UpdateIqcAqlPolicyDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.aqlService.updatePolicy(policyCode, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'IQC AQL 정책이 수정되었습니다.');
  }

  @Delete('policies/:policyCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IQC AQL 정책 사용중지' })
  async deletePolicy(
    @Param('policyCode') policyCode: string,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.aqlService.deletePolicy(policyCode, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'IQC AQL 정책이 사용중지되었습니다.');
  }

  @Get('resolve-iqc')
  @ApiOperation({ summary: '품목/업체/LOT 수량 기준 IQC AQL 정책 산출' })
  async resolveIqc(
    @Query('itemCode') itemCode: string,
    @Query('vendorCode') vendorCode: string,
    @Query('lotQty') lotQty: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.aqlService.resolveIqcPolicy({
      itemCode,
      vendorCode,
      lotQty: Number(lotQty),
      company,
      plant,
    });
    return ResponseUtil.success(data);
  }

  @Get('resolve-iqc-items')
  @ApiOperation({ summary: '품목/LOT 수량 기준 검사항목별 IQC AQL 정책 산출' })
  async resolveIqcItems(
    @Query('itemCode') itemCode: string,
    @Query('vendorCode') vendorCode: string,
    @Query('lotQty') lotQty: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.aqlService.resolveIqcPolicyByItem({
      itemCode,
      vendorCode,
      lotQty: Number(lotQty),
      itemDefectCounts: {},
      itemInspectedCounts: {},
      fallbackDefectCounts: { critical: 0, major: 0, minor: 0 },
      company,
      plant,
    });
    return ResponseUtil.success(data);
  }

  @Get(':aqlCode')
  @ApiOperation({ summary: 'AQL 기준 단건 조회' })
  async findOne(
    @Param('aqlCode') aqlCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.aqlService.findOne(aqlCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'AQL 기준 등록' })
  async create(
    @Body() dto: CreateAqlDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.aqlService.create(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'AQL 기준이 등록되었습니다.');
  }

  @Put(':aqlCode')
  @ApiOperation({ summary: 'AQL 기준 수정' })
  async update(
    @Param('aqlCode') aqlCode: string,
    @Body() dto: UpdateAqlDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.aqlService.update(aqlCode, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'AQL 기준이 수정되었습니다.');
  }

  @Delete(':aqlCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AQL 기준 사용중지' })
  async delete(
    @Param('aqlCode') aqlCode: string,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.aqlService.delete(aqlCode, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'AQL 기준이 사용중지되었습니다.');
  }
}
