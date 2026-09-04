/**
 * @file hv-spc.controller.ts
 * @description 고전압 하네스 SPC 관리도 API — 관리대상 목록과 관리도 데이터.
 *
 * 초보자 가이드:
 * - GET /api/v1/quality/spc/hv/targets?days=30&k=0            → { sourceKind, dateFrom, dateTo, targets[] }
 * - GET /api/v1/quality/spc/hv/targets/:targetId?days=30&k=0  → SpcTargetData (서브그룹·관리한계·능력지수·규칙 위반)
 * - 응답은 HANES 관례대로 ResponseUtil.success 로 감싸고, `data` 안은 원본 webdisplay 와 같은 형태다.
 * - 데이터 소스(MOCK|DB)는 시스템 설정 SPC_HV_SOURCE 가 정한다 — hv-spc.service.ts 참고.
 * - 기존 SPC CRUD(`quality/spc/charts`, `data`) 는 spc.controller.ts 에 그대로 있다.
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { HvSpcService } from './hv-spc.service';
import { HvSpcQueryDto } from './hv-spc.dto';

@ApiTags('SPC')
@Controller('quality/spc/hv')
export class HvSpcController {
  constructor(private readonly hvSpcService: HvSpcService) {}

  private toQuery(dto: HvSpcQueryDto) {
    return { days: dto.days ?? 30, kLimit: dto.k ?? 0 };
  }

  @Get('targets')
  @ApiOperation({ summary: 'HV SPC 관리대상 목록', description: '관리대상별 Cpk/상태/이탈 수 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getTargets(
    @Query() query: HvSpcQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.hvSpcService.getTargets(company, plant, this.toQuery(query));
    return ResponseUtil.success(data);
  }

  @Get('targets/:targetId')
  @ApiOperation({ summary: 'HV SPC 관리도 데이터', description: '서브그룹·관리한계·능력지수·규칙 위반' })
  @ApiParam({ name: 'targetId', description: '관리대상 ID (DB 소스는 CHART_NO)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '관리대상 없음' })
  async getTarget(
    @Param('targetId') targetId: string,
    @Query() query: HvSpcQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.hvSpcService.getTarget(company, plant, targetId, this.toQuery(query));
    return ResponseUtil.success(data);
  }
}
