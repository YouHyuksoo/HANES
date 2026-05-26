import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ComCodeQueryDto, CreateComCodeDto, UpdateComCodeDto } from '../dto/com-code.dto';
import { ComCodeService } from '../services/com-code.service';

@ApiTags('Master - ComCode')
@Controller('master/com-codes')
export class ComCodeController {
  constructor(private readonly comCodeService: ComCodeService) {}

  @Get('all-active')
  @ApiOperation({ summary: 'Get all active common codes grouped by groupCode' })
  @ApiResponse({ status: 200, description: 'OK' })
  async findAllActive(@Company() company?: string, @Plant() plant?: string) {
    const data = await this.comCodeService.findAllActive(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Get all code groups' })
  @ApiResponse({ status: 200, description: 'OK' })
  async findAllGroups(@Company() company?: string, @Plant() plant?: string) {
    const data = await this.comCodeService.findAllGroups(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('groups/:groupCode')
  @ApiOperation({ summary: 'Get codes by groupCode' })
  @ApiParam({ name: 'groupCode' })
  @ApiResponse({ status: 200, description: 'OK' })
  async findByGroupCode(
    @Param('groupCode') groupCode: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.comCodeService.findByGroupCode(groupCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: 'Get common codes' })
  @ApiResponse({ status: 200, description: 'OK' })
  async findAll(
    @Query() query: ComCodeQueryDto,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const result = await this.comCodeService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one common code by id' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    const data = await this.comCodeService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create common code' })
  @ApiResponse({ status: 201, description: 'Created' })
  async create(
    @Body() dto: CreateComCodeDto,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.comCodeService.create(dto, company, plant);
    return ResponseUtil.success(data, 'Common code created');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update common code' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateComCodeDto,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.comCodeService.update(id, dto, company, plant);
    return ResponseUtil.success(data, 'Common code updated');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete common code' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  async delete(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    await this.comCodeService.delete(id, company, plant);
    return ResponseUtil.success(null, 'Common code deleted');
  }

  @Delete('groups/:groupCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete common codes by groupCode' })
  @ApiParam({ name: 'groupCode' })
  @ApiResponse({ status: 200, description: 'OK' })
  async deleteByGroupCode(
    @Param('groupCode') groupCode: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const result = await this.comCodeService.deleteByGroupCode(groupCode, company, plant);
    return ResponseUtil.success(result, `${result.count} codes deleted`);
  }
}
