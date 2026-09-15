/**
 * @file quality/ncr/controllers/ncr.controller.ts
 * @description 부적합 보고서(NCR) API
 *
 * - GET    /quality/ncr            : 목록(발행일 구간)
 * - GET    /quality/ncr/:ncrNo     : 단건
 * - POST   /quality/ncr            : 발행
 * - PUT    /quality/ncr/:ncrNo     : 수정 (종결 건은 불가)
 * - PATCH  /quality/ncr/:ncrNo/disposition : 처리방안 확정
 * - PATCH  /quality/ncr/:ncrNo/cause       : 원인·재발방지
 * - PATCH  /quality/ncr/:ncrNo/close       : 종결
 * - PATCH  /quality/ncr/:ncrNo/capa        : 시정조치(CAPA) 연결
 */
import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { NcrService } from '../services/ncr.service';
import {
  CloseNcrDto, CreateNcrDto, NcrCauseDto, NcrDispositionDto, NcrQueryDto, UpdateNcrDto,
} from '../dto/ncr.dto';

@ApiTags('quality')
@Controller('quality/ncr')
export class NcrController {
  constructor(private readonly svc: NcrService) {}

  @Get()
  @ApiOperation({ summary: '부적합 보고서 목록', description: '발행일 구간·대상구분·발견공정·등급·상태 필터' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: NcrQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.svc.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':ncrNo')
  @ApiOperation({ summary: '부적합 보고서 단건' })
  @ApiParam({ name: 'ncrNo' })
  async findOne(@Param('ncrNo') ncrNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.findOne(ncrNo, company, plant));
  }

  @Post()
  @ApiOperation({
    summary: '부적합 보고서 발행',
    description: '같은 출처(sourceType+sourceId)로 이미 발행된 건이 있으면 거부한다.',
  })
  async create(
    @Body() dto: CreateNcrDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.create(dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '부적합 보고서가 발행되었습니다.');
  }

  @Put(':ncrNo')
  @ApiOperation({ summary: '부적합 보고서 수정', description: '종결된 건은 수정할 수 없다.' })
  async update(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: UpdateNcrDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.update(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '부적합 보고서가 수정되었습니다.');
  }

  @Patch(':ncrNo/disposition')
  @ApiOperation({ summary: '처리방안 확정', description: '특채/수리/재작업/폐기/반품 + 기한·책임자' })
  async setDisposition(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: NcrDispositionDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.setDisposition(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '처리방안이 확정되었습니다.');
  }

  @Patch(':ncrNo/cause')
  @ApiOperation({ summary: '원인분석·재발방지', description: '4M1E 분류 + 원인 + 대책' })
  async setCause(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: NcrCauseDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.setCause(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '원인·재발방지 대책이 저장되었습니다.');
  }

  @Patch(':ncrNo/close')
  @ApiOperation({
    summary: '부적합 보고서 종결',
    description: '처리방안과 발생 원인이 모두 채워져야 종결할 수 있다.',
  })
  async close(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: CloseNcrDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.close(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '부적합 보고서가 종결되었습니다.');
  }

  @Patch(':ncrNo/capa')
  @ApiOperation({ summary: '시정조치(CAPA) 연결' })
  async linkCapa(
    @Param('ncrNo') ncrNo: string,
    @Body('capaNo') capaNo: string,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.linkCapa(ncrNo, capaNo, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '시정조치가 연결되었습니다.');
  }
}
