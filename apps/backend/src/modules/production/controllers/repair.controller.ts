/**
 * @file controllers/repair.controller.ts
 * @description 수리관리 API 컨트롤러 - 수리 CRUD + 수리실 재고 조회
 *
 * 초보자 가이드:
 * 1. GET /production/repairs — 수리 목록 (필터/페이징)
 * 2. GET /production/repairs/inventory — 수리실 현재고
 * 3. GET /production/repairs/:date/:seq — 수리 상세 (사용부품 포함)
 * 4. POST /production/repairs — 수리 등록
 * 5. PUT /production/repairs/:date/:seq — 수리 수정
 * 6. DELETE /production/repairs/:date/:seq — 수리 삭제
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { RepairService } from '../services/repair.service';
import {
  RepairQueryDto,
  CreateRepairDto,
  UpdateRepairDto,
} from '../dto/repair.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('생산관리 - 수리관리')
@UseGuards(JwtAuthGuard)
@Controller('production/repairs')
export class RepairController {
  constructor(private readonly repairService: RepairService) {}

  @Get()
  @ApiOperation({
    summary: '수리 목록 조회',
    description: '필터 기반 수리오더 목록 (페이징)',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: RepairQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.repairService.findAll(query, company, plant);
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('inventory')
  @ApiOperation({
    summary: '수리실 현재고',
    description: '상태가 RECEIVED/IN_REPAIR인 수리오더 목록',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getInventory(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.repairService.getInventory(company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':date/:seq')
  @ApiOperation({
    summary: '수리 상세 조회',
    description: '수리오더 단건 (사용부품 포함)',
  })
  @ApiParam({ name: 'date', description: '수리일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findOne(
    @Param('date') date: string,
    @Param('seq') seq: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.repairService.findOne(date, +seq, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '수리 등록',
    description: '수리오더 + 사용부품 등록',
  })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(
    @Body() dto: CreateRepairDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.repairService.create(dto, company, plant);
    return ResponseUtil.success(result, '수리가 등록되었습니다.');
  }

  @Put(':date/:seq')
  @ApiOperation({
    summary: '수리 수정',
    description: '수리오더 + 사용부품 수정',
  })
  @ApiParam({ name: 'date', description: '수리일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('date') date: string,
    @Param('seq') seq: number,
    @Body() dto: UpdateRepairDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.repairService.update(
      date,
      +seq,
      dto,
      company,
      plant,
    );
    return ResponseUtil.success(result, '수리가 수정되었습니다.');
  }

  @Delete(':date/:seq')
  @ApiOperation({
    summary: '수리 삭제',
    description: '수리오더 + 사용부품 삭제',
  })
  @ApiParam({ name: 'date', description: '수리일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async remove(
    @Param('date') date: string,
    @Param('seq') seq: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.repairService.remove(date, +seq, company, plant);
    return ResponseUtil.success(null, '수리가 삭제되었습니다.');
  }
}
