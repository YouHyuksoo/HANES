import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  CreateSampleInspectDto,
  SampleInspectHistoryQueryDto,
} from '../dto/sample-inspect.dto';
import { SampleInspectService } from '../services/sample-inspect.service';

@ApiTags('Production - Sample Inspect')
@Controller('production/sample-inspect-input')
export class SampleInspectController {
  constructor(private readonly sampleInspectService: SampleInspectService) {}

  @Get()
  @ApiOperation({ summary: 'List sample inspection history' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findHistory(
    @Query() query: SampleInspectHistoryQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.sampleInspectService.findHistory(query, company, plant);
    return ResponseUtil.success(result.data);
  }

  @Get('job-order/:orderNo')
  @ApiOperation({ summary: 'List sample inspections by job order' })
  @ApiParam({ name: 'orderNo', description: 'Job order no' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findByJobOrder(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.sampleInspectService.findByJobOrder(orderNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create sample inspection records' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(
    @Body() dto: CreateSampleInspectDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.sampleInspectService.create(dto, company, plant);
    return ResponseUtil.success(result, `${result.count} sample inspection records created`);
  }
}
