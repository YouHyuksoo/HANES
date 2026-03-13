/**
 * @file src/modules/material/controllers/physical-inv.controller.ts
 * @description 재고실사 API 컨트롤러 — 실사 세션 관리 + 실사 결과 반영
 *
 * 초보자 가이드:
 * 1. **GET  /material/physical-inv**          → 실사 대상 재고 목록 조회
 * 2. **GET  /material/physical-inv/history**  → 실사 이력 조회
 * 3. **GET  /material/physical-inv/session**  → 현재 실사 세션 상태 조회 (IN_PROGRESS 여부)
 * 4. **POST /material/physical-inv/session/start**    → 실사 개시 (IN_PROGRESS 세션 생성)
 * 5. **POST /material/physical-inv/session/complete** → 실사 완료 (COMPLETED 상태 전환)
 * 6. **POST /material/physical-inv**          → 실사 결과 반영 (Stock 업데이트 + InvAdjLog 기록)
 */

import { Controller, Get, Post, Body, Query, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PhysicalInvService } from '../services/physical-inv.service';
import {
  CreatePhysicalInvDto,
  PhysicalInvQueryDto,
  PhysicalInvHistoryQueryDto,
  StartPhysicalInvSessionDto,
  CompletePhysicalInvSessionDto,
} from '../dto/physical-inv.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 재고실사')
@Controller('material/physical-inv')
export class PhysicalInvController {
  constructor(private readonly physicalInvService: PhysicalInvService) {}

  /** 실사 대상 재고 목록 조회 */
  @Get()
  @ApiOperation({ summary: '실사 대상 재고 목록 조회' })
  async findStocks(
    @Query() query: PhysicalInvQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.physicalInvService.findStocks(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
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

  /**
   * 현재 실사 세션 상태 조회
   * 프론트엔드에서 진행 중 여부 배너를 표시할 때 사용
   */
  @Get('session')
  @ApiOperation({ summary: '현재 실사 세션 상태 조회 (IN_PROGRESS 여부)' })
  async getSessionStatus(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.physicalInvService.getSessionStatus(company, plant);
    return ResponseUtil.success(data);
  }

  /**
   * 실사 개시 — IN_PROGRESS 세션 생성
   * 이 API 호출 후부터 InventoryFreezeGuard가 자재 트랜잭션을 차단합니다.
   */
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

  /**
   * 실사 완료 — COMPLETED 상태 전환
   * 이 API 호출 후 InventoryFreezeGuard 차단이 해제됩니다.
   */
  @Post('session/:id/complete')
  @ApiOperation({ summary: '실사 완료 — COMPLETED 상태 전환, 트랜잭션 차단 해제' })
  @ApiParam({ name: 'id', description: 'PhysicalInvSession PK' })
  async completeSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompletePhysicalInvSessionDto,
  ) {
    const data = await this.physicalInvService.completeSession(id, dto);
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
