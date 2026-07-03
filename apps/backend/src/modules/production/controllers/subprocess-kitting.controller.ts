/**
 * @file src/modules/production/controllers/subprocess-kitting.controller.ts
 * @description 서브공정 키팅 컨트롤러 — 제품라벨 발행 + genealogy + 제품 WIP 재고 적재.
 *
 * 라우트:
 * - POST /production/subprocess-kitting               : 키팅 실행(FG 발행)
 * - GET  /production/subprocess-kitting/sg-label/:sgBarcode : SFG 라벨 조회
 *
 * 주의: cancel()은 본 범위에서 제공하지 않는다(별도 후속).
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import {
  IssueLabelDto,
  ConfirmAssemblyDto,
  IssueSgLabelDto,
  ConfirmSubKitDto,
} from '../dto/subprocess-kitting.dto';
import { SubprocessKittingService } from '../services/subprocess-kitting.service';

@ApiTags('생산관리 - 서브공정 키팅')
@Controller('production/subprocess-kitting')
export class SubprocessKittingController {
  constructor(private readonly service: SubprocessKittingService) {}

  @Post('issue-label')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '조립 라벨 발행 — FG 바코드 채번 + ISSUED 저장(SG·자재·실적·재고 미반영)' })
  async issueLabel(
    @Body() dto: IssueLabelDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.issueLabel(
      dto.orderNo,
      dto.equipCode,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '조립 라벨이 발행되었습니다.');
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '조립 확정 — 실물 FG 라벨 스캔으로 genealogy+소비+실적+재고 단일 트랜잭션 확정' })
  async confirm(
    @Body() dto: ConfirmAssemblyDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.confirmAssembly(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '조립이 확정되었습니다.');
  }

  @Post('issue-sg-label')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '서브 키팅 SFG 라벨 발행 — 새 SG 채번 + ISSUED 저장(입력SFG·자재·실적·재고 미반영)' })
  async issueSgLabel(
    @Body() dto: IssueSgLabelDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.issueSgLabel(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'SFG 라벨이 발행되었습니다.');
  }

  @Post('confirm-subkit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '서브 키팅 확정 — 실물 새 SFG 라벨 스캔으로 입력SFG 소비+genealogy+자재차감+실적+재고 단일 트랜잭션' })
  async confirmSubKit(
    @Body() dto: ConfirmSubKitDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.confirmSubKit(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '서브 키팅이 확정되었습니다.');
  }

  @Get('circuits-by-order/:orderNo')
  @ApiOperation({ summary: '작업지시 기준 회로 목록 조회 — 회로 선택 칸 데이터 소스' })
  @ApiParam({ name: 'orderNo', description: '반제품 작업지시번호' })
  async getCircuitsByOrder(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getCircuitsByOrder(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('sg-labels-by-result/:resultNo')
  @ApiOperation({ summary: '생산실적별 SFG 라벨 목록 조회' })
  @ApiParam({ name: 'resultNo', description: '생산실적번호' })
  async getSgLabelsByResult(
    @Param('resultNo') resultNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getSgLabelsByResult(resultNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('assembly-requirements/:orderNo')
  @ApiOperation({ summary: '조립 요구사항 조회 — 완제품 BOM의 SEMI_PRODUCT 자식 컴포넌트 목록' })
  @ApiParam({ name: 'orderNo', description: '완제품 작업지시번호' })
  async getAssemblyRequirements(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getAssemblyRequirements(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('sg-label/:sgBarcode')
  @ApiOperation({ summary: 'SFG 라벨 조회' })
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
