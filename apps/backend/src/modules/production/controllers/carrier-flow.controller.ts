/**
 * @file carrier-flow.controller.ts
 * @description 대차 흐름 API
 * 1. GET  /production/carriers                      — 현황 목록(상태·공정·바코드 검색, 서버 페이징)
 * 2. GET  /production/carriers/process-flags        — 작업지시+공정의 대차 플래그
 * 3. GET  /production/carriers/:no                  — 상태·내용·다음 공정
 * 4. POST /production/carriers/release              — 설비의 출력 대차 해제
 * 5. POST /production/carriers/:no/select           — 출력 대차 지정(검증)
 * 6. POST /production/carriers/:no/slip             — 이동전표 발행/재발행
 * 7. GET  /production/carriers/:no/auto-input       — 자동투입 대상 목록(검증)
 * 라우트 주의: 'process-flags', 'release'는 ':no'보다 먼저 선언한다.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { CarrierFlowService } from '../services/carrier-flow.service';
import { CarrierAutoInputQueryDto, CarrierListQueryDto, CarrierProcessFlagsQueryDto, ReleaseCarrierDto, SelectCarrierDto } from '../dto/carrier-flow.dto';

@ApiTags('생산 - 대차 흐름')
@Controller('production/carriers')
export class CarrierFlowController {
  constructor(private readonly svc: CarrierFlowService) {}

  @Get()
  @ApiOperation({ summary: '대차 현황 목록' })
  async list(@Query() query: CarrierListQueryDto, @Company() company: string, @Plant() plant: string) {
    const r = await this.svc.list(query, company, plant);
    return ResponseUtil.paged(r.data, r.total, r.page, r.limit);
  }

  @Get('process-flags')
  @ApiOperation({ summary: '작업지시+공정의 대차 적재/자동투입 플래그' })
  async processFlags(@Query() q: CarrierProcessFlagsQueryDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.getProcessFlags(q.orderNo, q.processCode, company, plant));
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '설비의 출력 대차 지정 해제' })
  async release(@Body() dto: ReleaseCarrierDto, @Company() company: string, @Plant() plant: string) {
    await this.svc.release(dto.equipCode, company, plant);
    return ResponseUtil.success({ released: true });
  }

  @Get(':no')
  @ApiOperation({ summary: '대차 상태·내용·다음 공정' })
  async status(@Param('no') no: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.getStatus(no, company, plant));
  }

  @Post(':no/select')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출력 대차 지정 — 검증 후 설비 CUR_CARRIER_NO 갱신' })
  async select(@Param('no') no: string, @Body() dto: SelectCarrierDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.select(no, dto.equipCode, company, plant), '출력 대차가 지정되었습니다.');
  }

  @Post(':no/slip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이동전표 발행/재발행' })
  async slip(@Param('no') no: string, @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.svc.issueSlip(no, req.user?.id ?? 'SYSTEM', company, plant));
  }

  @Get(':no/auto-input')
  @ApiOperation({ summary: '자동투입 대상 목록 — 설비 공정 플래그·전표·빈 대차 검증' })
  async autoInput(@Param('no') no: string, @Query() q: CarrierAutoInputQueryDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.getAutoInputRows(no, q.equipCode, company, plant));
  }
}
