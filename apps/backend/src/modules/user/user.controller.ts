/**
 * @file src/modules/user/user.controller.ts
 * @description 사용자 관리 API 엔드포인트
 *
 * 엔드포인트:
 * - GET    /api/users       - 목록 조회
 * - GET    /api/users/:id   - 상세 조회
 * - POST   /api/users       - 생성
 * - PATCH  /api/users/:id   - 수정
 * - DELETE /api/users/:id   - 삭제
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';

@ApiTags('사용자')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '사용자 목록 조회' })
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.userService.findAll({ search, role, status });
  }

  @Get(':id')
  @ApiOperation({ summary: '사용자 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '사용자 생성' })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '사용자 수정' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '사용자 삭제' })
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (req: Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          const uploadPath = './uploads/users';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `user-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!file.mimetype.match(/\/jpg|jpeg|png|gif$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiOperation({ summary: '사용자 사진 업로드' })
  @ApiConsumes('multipart/form-data')
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const photoUrl = `/uploads/users/${file.filename}`;
    return this.userService.updatePhoto(id, photoUrl);
  }

  @Delete(':id/photo')
  @ApiOperation({ summary: '사용자 사진 삭제' })
  removePhoto(@Param('id') id: string) {
    return this.userService.updatePhoto(id, null);
  }
}
