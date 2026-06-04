import {
  BadRequestException,
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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { AuthenticatedRequest, JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BomQueryDto, CreateBomDto, UpdateBomDto } from '../dto/bom.dto';
import { BomService } from '../services/bom.service';

@ApiTags('Master - BOM')
@Controller('master/boms')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get('parents')
  @ApiOperation({ summary: 'Get BOM parent list' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'effectiveDate', required: false })
  async findParents(
    @Query('search') search?: string,
    @Query('effectiveDate') effectiveDate?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.bomService.findParents(search, effectiveDate, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export BOM to Excel' })
  @ApiQuery({ name: 'parentItemCode', required: false })
  async exportToExcel(
    @Query('parentItemCode') parentItemCode: string | undefined,
    @Company() company: string,
    @Plant() plant: string,
    @Res() res: Response,
  ) {
    const buffer = await this.bomService.exportToExcel(parentItemCode, company, plant);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = parentItemCode
      ? `BOM_${parentItemCode}_${dateStr}.xlsx`
      : `BOM_ALL_${dateStr}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('template')
  @ApiOperation({ summary: 'Download blank BOM Excel template' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.bomService.downloadTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="BOM_template.xlsx"',
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post('upload/preview')
  @ApiOperation({ summary: 'Preview BOM Excel upload — check duplicates before actual upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
        if (!file.originalname.match(/\.xlsx$/i)) return cb(new BadRequestException('Only .xlsx is allowed'), false);
        cb(null, true);
      },
    }),
  )
  async previewUpload(
    @UploadedFile() file: Express.Multer.File,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const result = await this.bomService.previewUpload(file.buffer, company, plant);
    return ResponseUtil.success(result, `미리보기 완료 — 신규: ${result.newCount}, 중복: ${result.duplicateCount}, 오류: ${result.errorCount}`);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload BOM from Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
        if (!file.originalname.match(/\.xlsx$/i)) {
          return cb(new BadRequestException('Only .xlsx is allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const userId = req.user.id;
    const result = await this.bomService.uploadFromExcel(file.buffer, company, plant, userId);
    return ResponseUtil.success(
      result,
      `Inserted: ${result.inserted}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
    );
  }

  @Get('hierarchy/:parentItemCode')
  @ApiOperation({ summary: 'Get BOM hierarchy' })
  @ApiParam({ name: 'parentItemCode' })
  @ApiQuery({ name: 'depth', required: false })
  @ApiQuery({ name: 'effectiveDate', required: false })
  async findHierarchy(
    @Param('parentItemCode') parentItemCode: string,
    @Query('depth') depth?: number,
    @Query('effectiveDate') effectiveDate?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.bomService.findHierarchy(parentItemCode, depth ?? 3, effectiveDate, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('parent/:parentItemCode')
  @ApiOperation({ summary: 'Get BOM rows by parent item' })
  @ApiQuery({ name: 'effectiveDate', required: false })
  async findByParentId(
    @Param('parentItemCode') parentItemCode: string,
    @Query('effectiveDate') effectiveDate?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.bomService.findByParentId(parentItemCode, effectiveDate, company, plant);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: 'Get BOM list' })
  async findAll(
    @Query() query: BomQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.bomService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one BOM row' })
  async findById(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    const data = await this.bomService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create BOM row' })
  async create(
    @Body() dto: CreateBomDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.bomService.create(dto, company, plant);
    return ResponseUtil.success(data, 'BOM created');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update BOM row' })
  async update(@Param('id') id: string, @Body() dto: UpdateBomDto, @Company() company?: string, @Plant() plant?: string) {
    const data = await this.bomService.update(id, dto, company, plant);
    return ResponseUtil.success(data, 'BOM updated');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete BOM row' })
  async delete(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    await this.bomService.delete(id, company, plant);
    return ResponseUtil.success(null, 'BOM deleted');
  }
}
