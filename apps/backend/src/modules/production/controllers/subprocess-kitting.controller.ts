/**
 * @file src/modules/production/controllers/subprocess-kitting.controller.ts
 * @description 서브공정 키팅 컨트롤러 — 제품라벨 발행 + genealogy + 제품 WIP 재고 적재.
 *
 * 라우트:
 * - POST /production/subprocess-kitting               : 키팅 실행(FG 발행)
 * - GET  /production/subprocess-kitting/sg-label/:sgBarcode : SG 라벨 조회
 *
 * 주의: cancel()은 본 범위에서 제공하지 않는다(별도 후속).
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { KitDto } from '../dto/subprocess-kitting.dto';
import { SubprocessKittingService } from '../services/subprocess-kitting.service';

@ApiTags('생산관리 - 서브공정 키팅')
@Controller('production/subprocess-kitting')
export class SubprocessKittingController {
  constructor(private readonly service: SubprocessKittingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '서브공정 키팅 — 제품라벨 발행 + genealogy + 제품 WIP 재고 적재' })
  async kit(
    @Body() dto: KitDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.kit(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '서브공정 키팅이 완료되었습니다.');
  }

  @Get('sg-labels-by-result/:resultNo')
  @ApiOperation({ summary: '생산실적별 SG 라벨 목록 조회' })
  @ApiParam({ name: 'resultNo', description: '생산실적번호' })
  async getSgLabelsByResult(
    @Param('resultNo') resultNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getSgLabelsByResult(resultNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('sg-label/:sgBarcode')
  @ApiOperation({ summary: 'SG 라벨 조회' })
  @ApiParam({ name: 'sgBarcode', description: '반제품 묶음 라벨 바코드' })
  async getSgLabel(
    @Param('sgBarcode') sgBarcode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getSgLabel(sgBarcode, company, plant);
    return ResponseUtil.success(data);
  }
}
