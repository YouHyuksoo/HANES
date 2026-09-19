/**
 * @file carrier.controller.ts
 * @description 대차/트레이/매거진 마스터 API
 * 1. GET    /master/carriers            — 목록(페이징·유형/사용여부/검색)
 * 2. GET    /master/carriers/:carrierNo — 단건
 * 3. POST   /master/carriers            — 생성
 * 4. PUT    /master/carriers/:carrierNo — 수정
 * 5. DELETE /master/carriers/:carrierNo — 삭제
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { CarrierService } from '../services/carrier.service';
import { CarrierQueryDto, CreateCarrierDto, UpdateCarrierDto } from '../dto/carrier.dto';

@ApiTags('기준정보 - 대차관리')
@Controller('master/carriers')
export class CarrierController {
  constructor(private readonly service: CarrierService) {}

  @Get()
  @ApiOperation({ summary: '대차 목록 조회' })
  async findAll(@Query() query: CarrierQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':carrierNo')
  @ApiOperation({ summary: '대차 단건 조회' })
  async findOne(@Param('carrierNo') carrierNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findOneOrFail(carrierNo, company, plant));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '대차 생성' })
  async create(@Body() dto: CreateCarrierDto, @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM'), '대차가 등록되었습니다.');
  }

  @Put(':carrierNo')
  @ApiOperation({ summary: '대차 수정' })
  async update(@Param('carrierNo') carrierNo: string, @Body() dto: UpdateCarrierDto, @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.update(carrierNo, dto, company, plant, req.user?.id ?? 'SYSTEM'), '대차가 수정되었습니다.');
  }

  @Delete(':carrierNo')
  @ApiOperation({ summary: '대차 삭제' })
  async remove(@Param('carrierNo') carrierNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.delete(carrierNo, company, plant), '대차가 삭제되었습니다.');
  }
}
