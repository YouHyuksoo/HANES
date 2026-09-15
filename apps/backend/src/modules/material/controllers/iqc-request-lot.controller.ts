import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { CreateIqcRequestLotDto, InspectIqcRequestLotDto, IqcRequestLotQueryDto } from '../dto/iqc-request-lot.dto';
import { IqcRequestLotService } from '../services/iqc-request-lot.service';

@ApiTags('품질 - IQC 검사의뢰 LOT')
@Controller('quality/iqc-request-lots')
export class IqcRequestLotController {
  constructor(private readonly service: IqcRequestLotService) {}

  @Get('candidates')
  @ApiOperation({ summary: '의뢰 구성 후보 입하(품목 1개, PENDING, 미의뢰)' })
  async candidates(@Query('itemCode') itemCode: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.listCandidates(itemCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '검사의뢰 LOT 목록' })
  async list(@Query() query: IqcRequestLotQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.list(query, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @ApiOperation({ summary: '검사의뢰 LOT 구성 확정' })
  async create(
    @Body() dto: CreateIqcRequestLotDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.create(dto, company, plant);
    return ResponseUtil.success(data, '검사의뢰 LOT이 등록되었습니다.');
  }

  @Post(':requestNo/cancel')
  @ApiOperation({ summary: '의뢰 취소(구성 입하 해제)' })
  async cancel(@Param('requestNo') requestNo: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.cancel(requestNo, company, plant);
    return ResponseUtil.success(data, '의뢰를 취소했습니다.');
  }

  @Post(':requestNo/inspect')
  @ApiOperation({ summary: '의뢰 LOT 일괄 판정(시료 AQL → 모집단 입하 전체)' })
  async inspect(
    @Param('requestNo') requestNo: string,
    @Body() dto: InspectIqcRequestLotDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.inspect(requestNo, dto, company, plant);
    return ResponseUtil.success(data, '검사의뢰 LOT이 판정되었습니다.');
  }
}
