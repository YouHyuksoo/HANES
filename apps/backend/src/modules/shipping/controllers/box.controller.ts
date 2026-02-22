/**
 * @file src/modules/shipping/controllers/box.controller.ts
 * @description 박스 CRUD 및 상태 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/boxes
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET    /                    : 박스 목록 (페이지네이션)
 * - GET    /:id                 : 박스 단건 조회
 * - GET    /box-no/:boxNo       : 박스번호로 조회
 * - POST   /                    : 박스 생성
 * - PUT    /:id                 : 박스 수정
 * - DELETE /:id                 : 박스 삭제
 * - POST   /:id/serials         : 시리얼 추가
 * - DELETE /:id/serials         : 시리얼 제거
 * - POST   /:id/close           : 박스 닫기
 * - POST   /:id/reopen          : 박스 다시 열기
 * - POST   /:id/assign-pallet   : 팔레트 할당
 * - POST   /:id/remove-pallet   : 팔레트에서 제거
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
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BoxService } from '../services/box.service';
import {
  CreateBoxDto,
  UpdateBoxDto,
  BoxQueryDto,
  AddSerialToBoxDto,
  AssignBoxToPalletDto,
} from '../dto/box.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 박스')
@Controller('shipping/boxes')
export class BoxController {
  constructor(private readonly boxService: BoxService) {}

  // ===== 기본 CRUD =====

  @Get()
  @ApiOperation({ summary: '박스 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: BoxQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.boxService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('unassigned')
  @ApiOperation({ summary: '미할당 박스 목록', description: '팔레트에 할당되지 않은 CLOSED 상태 박스 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findUnassignedBoxes() {
    const data = await this.boxService.findUnassignedBoxes();
    return ResponseUtil.success(data);
  }

  @Get('box-no/:boxNo')
  @ApiOperation({ summary: '박스번호로 조회' })
  @ApiParam({ name: 'boxNo', description: '박스 번호', example: 'BOX-20250126-001' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '박스 없음' })
  async findByBoxNo(@Param('boxNo') boxNo: string) {
    const data = await this.boxService.findByBoxNo(boxNo);
    return ResponseUtil.success(data);
  }

  @Get('pallet/:palletId')
  @ApiOperation({ summary: '팔레트별 박스 목록 조회' })
  @ApiParam({ name: 'palletId', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByPalletId(@Param('palletId') palletId: string) {
    const data = await this.boxService.findByPalletId(palletId);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '박스 상세 조회' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '박스 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.boxService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '박스 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 409, description: '중복 박스번호' })
  async create(@Body() dto: CreateBoxDto) {
    const data = await this.boxService.create(dto);
    return ResponseUtil.success(data, '박스가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '박스 수정' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '박스 없음' })
  @ApiResponse({ status: 400, description: '수정 불가 상태' })
  async update(@Param('id') id: string, @Body() dto: UpdateBoxDto) {
    const data = await this.boxService.update(id, dto);
    return ResponseUtil.success(data, '박스가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 삭제' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '박스 없음' })
  @ApiResponse({ status: 400, description: '삭제 불가 상태' })
  async delete(@Param('id') id: string) {
    await this.boxService.delete(id);
    return ResponseUtil.success(null, '박스가 삭제되었습니다.');
  }

  // ===== 시리얼 관리 =====

  @Post(':id/serials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '시리얼 추가', description: '박스에 시리얼 번호 추가 (OPEN 상태에서만 가능)' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '추가 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 409, description: '중복 시리얼' })
  async addSerial(@Param('id') id: string, @Body() dto: AddSerialToBoxDto) {
    const data = await this.boxService.addSerial(id, dto);
    return ResponseUtil.success(data, '시리얼이 추가되었습니다.');
  }

  @Delete(':id/serials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '시리얼 제거', description: '박스에서 시리얼 번호 제거 (OPEN 상태에서만 가능)' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiBody({ schema: { type: 'object', properties: { serials: { type: 'array', items: { type: 'string' } } } } })
  @ApiResponse({ status: 200, description: '제거 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '시리얼 없음' })
  async removeSerial(@Param('id') id: string, @Body('serials') serials: string[]) {
    const data = await this.boxService.removeSerial(id, serials);
    return ResponseUtil.success(data, '시리얼이 제거되었습니다.');
  }

  // ===== 상태 관리 =====

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 닫기', description: 'OPEN -> CLOSED 상태로 변경' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '닫기 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async closeBox(@Param('id') id: string) {
    const data = await this.boxService.closeBox(id);
    return ResponseUtil.success(data, '박스가 닫혔습니다.');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 다시 열기', description: 'CLOSED -> OPEN 상태로 변경 (팔레트 미할당 시)' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '열기 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async reopenBox(@Param('id') id: string) {
    const data = await this.boxService.reopenBox(id);
    return ResponseUtil.success(data, '박스가 다시 열렸습니다.');
  }

  // ===== 팔레트 할당 =====

  @Post(':id/assign-pallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 할당', description: 'CLOSED 상태 박스를 OPEN 상태 팔레트에 할당' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '할당 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  async assignToPallet(@Param('id') id: string, @Body() dto: AssignBoxToPalletDto) {
    const data = await this.boxService.assignToPallet(id, dto);
    return ResponseUtil.success(data, '박스가 팔레트에 할당되었습니다.');
  }

  @Post(':id/remove-pallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트에서 제거', description: 'OPEN 상태 팔레트에서 박스 제거' })
  @ApiParam({ name: 'id', description: '박스 ID' })
  @ApiResponse({ status: 200, description: '제거 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  async removeFromPallet(@Param('id') id: string) {
    const data = await this.boxService.removeFromPallet(id);
    return ResponseUtil.success(data, '박스가 팔레트에서 제거되었습니다.');
  }
}
