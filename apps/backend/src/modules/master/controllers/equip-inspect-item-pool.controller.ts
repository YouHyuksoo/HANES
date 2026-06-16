import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { Request } from 'express';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { ResponseUtil } from '../../../common/dto/response.dto';
import {
  CreateEquipInspectItemPoolDto,
  EquipInspectItemPoolQueryDto,
  UpdateEquipInspectItemPoolDto,
} from '../dto/equip-inspect-item-pool.dto';
import { EquipInspectItemPoolService } from '../services/equip-inspect-item-pool.service';
import { getHeaderString } from '../../../common/utils/header-value.util';
import { getRequestUser } from '../../../common/utils/request-user.util';

@ApiTags('기준정보 - 설비점검항목 마스터')
@Controller('master/equip-inspect-item-masters')
export class EquipInspectItemPoolController {
  private readonly logger = new Logger(EquipInspectItemPoolController.name);

  constructor(private readonly service: EquipInspectItemPoolService) {}

  @Get()
  @ApiOperation({ summary: '설비점검항목 Pool 목록 조회' })
  async findAll(@Query() query: EquipInspectItemPoolQueryDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비점검항목 Pool 생성' })
  async create(@Body() dto: CreateEquipInspectItemPoolDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const data = await this.service.create(dto, company, plant);
    return ResponseUtil.success(data, '설비점검항목 마스터가 생성되었습니다.');
  }

  @Post(':itemCode/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          const uploadPath = './uploads/equip-inspect-items';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `equip-inspect-item-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: '설비점검항목 사진 업로드' })
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @Param('itemCode') itemCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const { company, plant } = this.tenant(req);
    const imageUrl = `/uploads/equip-inspect-items/${file.filename}`;
    const data = await this.service.updateImage(itemCode, imageUrl, company, plant);
    return ResponseUtil.success(data, '설비점검항목 사진이 업로드되었습니다.');
  }

  @Delete(':itemCode/image')
  @ApiOperation({ summary: '설비점검항목 사진 삭제' })
  async removeImage(@Param('itemCode') itemCode: string, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const existing = await this.service.findByCode(company, plant, itemCode);
    if (existing.imageUrl) {
      const filePath = join('.', existing.imageUrl);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (error: unknown) {
        // 파일 삭제 실패는 DB 경로 해제를 막지 않는다 — 단, 고아 파일 추적을 위해 경고 로깅.
        this.logger.warn(
          `설비점검항목 이미지 파일 삭제 실패 (itemCode=${itemCode}, path=${filePath}): ${error instanceof Error ? error.message : '오류'}`,
        );
      }
    }
    const data = await this.service.updateImage(itemCode, null, company, plant);
    return ResponseUtil.success(data, '설비점검항목 사진이 삭제되었습니다.');
  }

  @Put(':itemCode')
  @ApiOperation({ summary: '설비점검항목 Pool 수정' })
  async update(@Param('itemCode') itemCode: string, @Body() dto: UpdateEquipInspectItemPoolDto, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    const data = await this.service.update(company, plant, itemCode, dto);
    return ResponseUtil.success(data, '설비점검항목 마스터가 수정되었습니다.');
  }

  @Delete(':itemCode')
  @ApiOperation({ summary: '설비점검항목 Pool 삭제' })
  async delete(@Param('itemCode') itemCode: string, @Req() req: Request) {
    const { company, plant } = this.tenant(req);
    await this.service.delete(company, plant, itemCode);
    return ResponseUtil.success(null, '설비점검항목 마스터가 삭제되었습니다.');
  }

  private tenant(req: Request) {
    const user = getRequestUser(req) ?? {};
    return {
      company: getHeaderString(req.headers['x-company']) || user.company || '',
      plant: getHeaderString(req.headers['x-plant']) || user.plant || '',
    };
  }
}
