/**
 * @file src/modules/material/controllers/physical-inv.controller.ts
 * @description 재고실사 API 컨트롤러 — 실사 세션 관리 + PDA 스캔 + 실사 결과 반영
 *
 * 초보자 가이드:
 * 1. **GET  /material/physical-inv**                                → 실사 대상 재고 목록 (PDA 실사수량 포함)
 * 2. **GET  /material/physical-inv/history**                        → 실사 이력 조회
 * 3. **GET  /material/physical-inv/session/active**                 → PDA: 활성 실사 세션 조회
 * 4. **GET  /material/physical-inv/session**                        → PC: 세션 상태 조회
 * 5. **POST /material/physical-inv/session/start**                  → 실사 개시
 * 6. **POST /material/physical-inv/session/:date/:seq/complete**    → 실사 완료
 * 7. **GET  /material/physical-inv/session/:date/:seq/location/:code** → PDA: 로케이션별 품목 현황
 * 8. **POST /material/physical-inv/count**                          → PDA: 바코드 스캔 카운트
 * 9. **POST /material/physical-inv**                                → 실사 결과 반영
 */

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

@ApiTags('자재관리 - 재고실사')
@Controller('material/physical-inv')
export class PhysicalInvController {
  constructor(private readonly physicalInvService: PhysicalInvService) {}

  /** 실사 대상 재고 목록 조회 (기준년월 기반, PDA 실사수량 포함) */
  @Get()
  @ApiOperation({ summary: '실사 대상 재고 목록 조회 (기준년월 기반, PDA 실사수량 포함)' })
  async findStocks(
    @Query() query: PhysicalInvCountQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.physicalInvService.findStocksWithCounts(query, company, plant);
    return ResponseUtil.success(result);
  }

  /** 재고실사 이력 조회 */
  @Get('history')
  @ApiOperation({ summary: '재고실사 이력 조회' })
  async findHistory(
    @Query() query: PhysicalInvHistoryQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.physicalInvService.findHistory(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  // ─── PDA 전용 — 반드시 /session 보다 위에 배치 (NestJS 경로 매칭 순서) ──

  /** PDA — 활성 실사 세션 조회 */
  @Get('session/active')
  @ApiOperation({ summary: 'PDA용 — 진행 중 실사 세션 조회' })
  async getActiveSession(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getActiveSession(company, plant);
    if (!data) {
      return ResponseUtil.success(null, '진행 중인 실사가 없습니다.');
    }
    return ResponseUtil.success(data);
  }

  /** PDA — 로케이션별 품목 현황 조회 */
  @Get('session/:sessionDate/:seq/location/:locationCode')
  @ApiOperation({ summary: 'PDA용 — 세션+로케이션별 품목 현황 조회' })
  @ApiParam({ name: 'sessionDate', description: '세션일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '세션 일련번호' })
  @ApiParam({ name: 'locationCode', description: '로케이션 코드' })
  async getLocationItems(
    @Param('sessionDate') sessionDate: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Param('locationCode') locationCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getLocationItems(
      sessionDate, seq, locationCode, company, plant,
    );
    return ResponseUtil.success(data);
  }

  /** PDA — 바코드 스캔 카운트 (+1) */
  @Post('count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PDA용 — 자재 바코드 스캔 → 실사수량 +1' })
  async scanCount(
    @Body() dto: PdaScanCountDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.scanCount(dto, company, plant);
    return ResponseUtil.success(data);
  }

  // ─── PC 세션 관리 ─────────────────────────────────────────────────

  /** 현재 실사 세션 상태 조회 (IN_PROGRESS 여부) */
  @Get('session')
  @ApiOperation({ summary: '현재 실사 세션 상태 조회 (IN_PROGRESS 여부)' })
  async getSessionStatus(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getSessionStatus(company, plant);
    return ResponseUtil.success(data);
  }

  /** 실사 개시 — IN_PROGRESS 세션 생성 */
  @Post('session/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '실사 개시 — IN_PROGRESS 세션 생성, 트랜잭션 차단 시작' })
  async startSession(
    @Body() dto: StartPhysicalInvSessionDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.startSession(dto, company, plant);
    return ResponseUtil.success(data, '재고실사가 개시되었습니다. 자재 트랜잭션이 제한됩니다.');
  }

  /** 실사 완료 — COMPLETED 상태 전환 */
  @Post('session/:sessionDate/:seq/complete')
  @ApiOperation({ summary: '실사 완료 — COMPLETED 상태 전환, 트랜잭션 차단 해제' })
  @ApiParam({ name: 'sessionDate', description: 'PhysicalInvSession 세션일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: 'PhysicalInvSession 일련번호' })
  async completeSession(
    @Param('sessionDate') sessionDate: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: CompletePhysicalInvSessionDto,
  ) {
    const data = await this.physicalInvService.completeSession(sessionDate, seq, dto);
    return ResponseUtil.success(data, '재고실사가 완료되었습니다. 자재 트랜잭션이 재개됩니다.');
  }

  /** 재고실사 결과 반영 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재고실사 결과 반영 (Stock 업데이트 + InvAdjLog 기록)' })
  async apply(@Body() dto: CreatePhysicalInvDto) {
    const data = await this.physicalInvService.applyCount(dto);
    return ResponseUtil.success(data, '재고실사가 반영되었습니다.');
  }
}
