import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { MoldService } from '../services/mold.service';
import {
  CreateMoldDto,
  UpdateMoldDto,
  CreateMoldUsageDto,
  MoldQueryDto,
} from '../dto/mold.dto';

@ApiTags('Mold Management')
@Controller('equipment')
export class MoldController {
  constructor(private readonly moldService: MoldService) {}

  @Get('molds/maintenance-due')
  @ApiOperation({ summary: 'Get molds due for maintenance' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getMaintenanceDue(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.moldService.getMaintenanceDue(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('molds')
  @ApiOperation({ summary: 'Get mold list' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll(
    @Query() query: MoldQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.moldService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('molds/:id')
  @ApiOperation({ summary: 'Get mold by id' })
  @ApiParam({ name: 'id', description: 'Mold code' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.moldService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('molds')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create mold' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(
    @Body() dto: CreateMoldDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.moldService.create(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'Mold created.');
  }

  @Put('molds/:id')
  @ApiOperation({ summary: 'Update mold' })
  @ApiParam({ name: 'id', description: 'Mold code' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMoldDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.moldService.update(id, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, 'Mold updated.');
  }

  @Delete('molds/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete mold' })
  @ApiParam({ name: 'id', description: 'Mold code' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  async delete(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.moldService.delete(id, company, plant);
    return ResponseUtil.success(null, 'Mold deleted.');
  }

  @Get('molds/:id/usage')
  @ApiOperation({ summary: 'Get mold usage logs' })
  @ApiParam({ name: 'id', description: 'Mold code' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getUsageLogs(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.moldService.getUsageLogs(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('molds/:id/usage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add mold usage' })
  @ApiParam({ name: 'id', description: 'Mold code' })
  @ApiResponse({ status: 201, description: 'Created' })
  async addUsage(
    @Param('id') id: string,
    @Body() dto: CreateMoldUsageDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.moldService.addUsage(id, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'Mold usage logged.');
  }

  @Patch('molds/:id/retire')
  @ApiOperation({ summary: 'Retire mold' })
  @ApiParam({ name: 'id', description: 'Mold code' })
  @ApiResponse({ status: 200, description: 'Retired' })
  async retire(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.moldService.retire(id, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, 'Mold retired.');
  }
}
