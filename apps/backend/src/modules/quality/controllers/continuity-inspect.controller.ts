/**
 * @file continuity-inspect.controller.ts
 * @description 통전검사 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. 작업지시 조회 → 검사 등록 → FG_BARCODE 자동 발행 흐름
 * 2. 합격(PASS) 시 FG_LABELS 테이블에 바코드 등록
 * 3. 라벨 재인쇄/취소 기능 제공
 *
 * API:
 * - GET  /quality/continuity-inspect/job-orders         — 작업지시 목록
 * - GET  /quality/continuity-inspect/fg-labels/:orderNo  — 작업지시별 FG 라벨 목록
 * - POST /quality/continuity-inspect/inspect             — 검사 결과 등록 + 바코드 발행
 * - POST /quality/continuity-inspect/auto-inspect       — 장비 자동검사 결과 등록
 * - GET    /quality/continuity-inspect/protocols           — 장비 프로토콜 목록
 * - POST   /quality/continuity-inspect/protocols           — 프로토콜 등록
 * - PUT    /quality/continuity-inspect/protocols/:id       — 프로토콜 수정
 * - DELETE /quality/continuity-inspect/protocols/:id       — 프로토콜 삭제
 * - GET    /quality/continuity-inspect/stats/:orderNo      — 통계
 * - POST /quality/continuity-inspect/reprint/:fgBarcode  — 라벨 재인쇄
 * - POST /quality/continuity-inspect/void/:fgBarcode     — 라벨 취소
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { ContinuityInspectService } from '../services/continuity-inspect.service';
import {
  ContinuityInspectDto,
  AutoInspectDto,
  VoidLabelDto,
} from '../dto/continuity-inspect.dto';

@ApiTags('품질관리 - 통전검사')
@Controller('quality/continuity-inspect')
export class ContinuityInspectController {
  constructor(
    private readonly continuityInspectService: ContinuityInspectService,
  ) {}

  // ===== 작업지시 목록 =====

  @Get('job-orders')
  @ApiOperation({
    summary: '작업지시 목록 조회',
    description: '통전검사 가능한 작업지시 목록 (IN_PROGRESS/WAITING)',
  })
  @ApiQuery({ name: 'lineCode', required: false, description: '라인 코드' })
  @ApiQuery({ name: 'planDate', required: false, description: '계획일 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
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

  // ===== FG 라벨 조회 =====

  @Get('fg-label/:fgBarcode')
  @ApiOperation({
    summary: 'FG 바코드로 라벨 단건 조회',
    description: '바코드 스캔 시 라벨 정보 반환',
  })
  @ApiParam({ name: 'fgBarcode', description: 'FG 바코드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '라벨 없음' })
  async findFgLabel(@Param('fgBarcode') fgBarcode: string) {
    const data = await this.continuityInspectService.findFgLabel(fgBarcode);
    return ResponseUtil.success(data);
  }

  // ===== FG 라벨 상태 변경 =====

  @Put('fg-label-status/:fgBarcode')
  @ApiOperation({
    summary: 'FG 라벨 상태 변경',
    description: 'ISSUED → VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED',
  })
  @ApiParam({ name: 'fgBarcode', description: 'FG 바코드' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  async updateFgLabelStatus(
    @Param('fgBarcode') fgBarcode: string,
    @Body() body: { status: string },
  ) {
    const data = await this.continuityInspectService.updateFgLabelStatus(fgBarcode, body.status);
    return ResponseUtil.success(data, '상태가 변경되었습니다.');
  }

  // ===== FG 라벨 목록 =====

  @Get('fg-labels/:orderNo')
  @ApiOperation({
    summary: '작업지시별 FG 라벨 목록',
    description: '해당 작업지시에서 발행된 FG_BARCODE 라벨 목록',
  })
  @ApiParam({ name: 'orderNo', description: '작업지시 번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findFgLabels(@Param('orderNo') orderNo: string) {
    const data =
      await this.continuityInspectService.findFgLabelsByOrder(orderNo);
    return ResponseUtil.success(data);
  }

  // ===== 검사 등록 =====

  @Post('inspect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '통전검사 결과 등록',
    description: 'PASS 시 FG_BARCODE 자동 채번 + FG_LABELS 등록',
  })
  @ApiResponse({ status: 201, description: '검사 등록 성공' })
  @ApiResponse({ status: 404, description: '작업지시 없음' })
  async inspect(
    @Body() dto: ContinuityInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.continuityInspectService.inspect(
      dto,
      company,
      plant,
    );
    const message =
      dto.passYn === 'Y'
        ? `합격 — FG_BARCODE: ${result.fgBarcode}`
        : '불합격 처리되었습니다.';
    return ResponseUtil.success(result, message);
  }

  // ===== 자동검사 (장비 연동) =====

  @Post('auto-inspect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '장비 자동검사 결과 등록',
    description:
      '장비 게이트웨이에서 전송한 raw 데이터를 프로토콜 설정에 따라 파싱하여 검사 결과 등록',
  })
  @ApiResponse({ status: 201, description: '검사 등록 성공' })
  async autoInspect(
    @Body() dto: AutoInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.continuityInspectService.autoInspect(
      dto,
      company,
      plant,
    );
    const message = result.fgBarcode
      ? `합격 — FG_BARCODE: ${result.fgBarcode}`
      : '불합격 처리되었습니다.';
    return ResponseUtil.success(result, message);
  }

  // ===== 프로토콜 CRUD =====

  @Get('protocols')
  @ApiOperation({ summary: '장비 프로토콜 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findProtocols() {
    const data = await this.continuityInspectService.findProtocols();
    return ResponseUtil.success(data);
  }

  @Post('protocols')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '프로토콜 등록' })
  async createProtocol(@Body() body: any) {
    const data = await this.continuityInspectService.createProtocol(body);
    return ResponseUtil.success(data, '프로토콜이 등록되었습니다.');
  }

  @Put('protocols/:protocolId')
  @ApiOperation({ summary: '프로토콜 수정' })
  async updateProtocol(
    @Param('protocolId') protocolId: string,
    @Body() body: any,
  ) {
    const data = await this.continuityInspectService.updateProtocol(
      protocolId,
      body,
    );
    return ResponseUtil.success(data, '프로토콜이 수정되었습니다.');
  }

  @Delete('protocols/:protocolId')
  @ApiOperation({ summary: '프로토콜 삭제' })
  async deleteProtocol(@Param('protocolId') protocolId: string) {
    await this.continuityInspectService.deleteProtocol(protocolId);
    return ResponseUtil.success(null, '프로토콜이 삭제되었습니다.');
  }

  // ===== 통계 =====

  @Get('stats/:orderNo')
  @ApiOperation({
    summary: '작업지시별 통전검사 통계',
    description: '합격/불합격 수, 합격률, 라벨 발행 수',
  })
  @ApiParam({ name: 'orderNo', description: '작업지시 번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Param('orderNo') orderNo: string) {
    const data = await this.continuityInspectService.getStats(orderNo);
    return ResponseUtil.success(data);
  }

  // ===== 라벨 재인쇄 =====

  @Post('reprint/:fgBarcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'FG 라벨 재인쇄',
    description: 'reprintCount += 1, 라벨 데이터 반환',
  })
  @ApiParam({ name: 'fgBarcode', description: 'FG 바코드' })
  @ApiResponse({ status: 200, description: '재인쇄 성공' })
  @ApiResponse({ status: 404, description: '라벨 없음' })
  async reprintLabel(@Param('fgBarcode') fgBarcode: string) {
    const data = await this.continuityInspectService.reprintLabel(fgBarcode);
    return ResponseUtil.success(data, '라벨 재인쇄 처리되었습니다.');
  }

  // ===== 라벨 취소 =====

  @Post('void/:fgBarcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'FG 라벨 취소',
    description: 'status → VOIDED, 취소 사유 기록',
  })
  @ApiParam({ name: 'fgBarcode', description: 'FG 바코드' })
  @ApiResponse({ status: 200, description: '취소 성공' })
  @ApiResponse({ status: 404, description: '라벨 없음' })
  async voidLabel(
    @Param('fgBarcode') fgBarcode: string,
    @Body() dto: VoidLabelDto,
  ) {
    const data = await this.continuityInspectService.voidLabel(
      fgBarcode,
      dto.reason,
    );
    return ResponseUtil.success(data, '라벨이 취소되었습니다.');
  }
}
