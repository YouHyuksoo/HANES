/**
 * @file controllers/self-inspect.controller.ts
 * @description 자주검사 API 컨트롤러
 *
 * 초보자 가이드:
 * API 구조:
 * - GET  /production/self-inspect/items       : 공정별 검사항목 조회
 * - POST /production/self-inspect/results     : 검사 결과 저장
 * - GET  /production/self-inspect/results/:orderNo : 작업지시별 결과 이력
 * - GET  /production/self-inspect/pending/:orderNo : 의뢰검사 대기 여부
 * - PATCH /production/self-inspect/results/:id/status : 의뢰검사 상태 업데이트
 * - GET  /production/self-inspect/delegates  : 의뢰검사 대기 목록 (관리 화면용)
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SelfInspectService } from '../services/self-inspect.service';

@ApiTags('Production - 자주검사')
@Controller('production/self-inspect')
export class SelfInspectController {
  constructor(private readonly svc: SelfInspectService) {}

  @Get('items/all')
  @ApiOperation({ summary: '자주검사 항목 전체 조회 (관리용, timing 무관)' })
  @ApiQuery({ name: 'processCode', required: true })
  async findAllItems(
    @Query('processCode') processCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.findAllItems(processCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('items')
  @ApiOperation({ summary: '자주검사 항목 조회 (공정별)' })
  @ApiQuery({ name: 'processCode', required: false })
  @ApiQuery({ name: 'timing', required: false, description: 'FIRST | MID | LAST' })
  async findItems(
    @Query('processCode') processCode: string,
    @Query('timing') timing: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.findItems(processCode, timing, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('results')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '자주검사 결과 저장' })
  async createResult(
    @Body() dto: {
      orderNo: string;
      equipCode?: string;
      processCode?: string;
      inspectItemId?: string;
      itemName: string;
      timing: string;
      inspectMethod: string;
      status: string;
      prodQtyAtInspect?: number;
      inspectorId?: string;
      remark?: string;
      sampleNo?: number;
      measureValue?: number;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.createResult(dto, company, plant);
    return ResponseUtil.success(data, '자주검사 결과가 저장되었습니다');
  }

  @Get('results/:orderNo')
  @ApiOperation({ summary: '작업지시별 자주검사 결과 이력' })
  async findResults(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.findResults(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('pending/:orderNo')
  @ApiOperation({ summary: '의뢰검사 대기 여부 확인' })
  async hasPending(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.hasPendingDelegate(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Patch('results/:id/status')
  @ApiOperation({ summary: '의뢰검사 상태 업데이트 (관리 화면용)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; remark?: string; measureValue?: number },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.updateResultStatus(
      id,
      body.status,
      body.remark,
      body.measureValue,
      company,
      plant,
    );
    return ResponseUtil.success(data, `상태가 ${body.status}로 변경되었습니다`);
  }

  @Get('delegates')
  @ApiOperation({ summary: '의뢰검사 대기 목록 (관리 화면용)' })
  async findPendingDelegates(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.findPendingDelegates(company, plant);
    return ResponseUtil.success(data);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '자주검사 항목 생성' })
  async createItem(
    @Body() dto: {
      processCode: string;
      itemName: string;
      standard?: string | null;
      inspectMethod?: string;
      timing?: string;
      isDestructive?: boolean;
      sortOrder?: number;
      useYn?: string;
      itemType?: string;
      unit?: string | null;
      lslValue?: number | null;
      uslValue?: number | null;
      sampleCount?: number;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.createItem(dto, company, plant);
    return ResponseUtil.success(data, '자주검사 항목이 생성되었습니다');
  }

  @Put('items/:id')
  @ApiOperation({ summary: '자주검사 항목 수정' })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: {
      itemName?: string;
      standard?: string | null;
      inspectMethod?: string;
      timing?: string;
      isDestructive?: boolean;
      sortOrder?: number;
      useYn?: string;
      itemType?: string;
      unit?: string | null;
      lslValue?: number | null;
      uslValue?: number | null;
      sampleCount?: number;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.updateItem(id, dto, company, plant);
    return ResponseUtil.success(data, '자주검사 항목이 수정되었습니다');
  }

  @Delete('items/:id')
  @ApiOperation({ summary: '자주검사 항목 삭제' })
  async deleteItem(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.deleteItem(id, company, plant);
    return ResponseUtil.success(data, '자주검사 항목이 삭제되었습니다');
  }

  @Get('history')
  @ApiOperation({ summary: '자주검사 이력 목록 조회' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'orderNo', required: false })
  @ApiQuery({ name: 'processCode', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findHistory(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('orderNo') orderNo?: string,
    @Query('processCode') processCode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const result = await this.svc.findHistory(
      {
        fromDate,
        toDate,
        orderNo,
        processCode,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 30,
      },
      company ?? '',
      plant ?? '',
    );
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
}
