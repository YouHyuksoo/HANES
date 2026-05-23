/**
 * @file dto/impr-request.dto.ts
 * @description 개선요청 DTO
 */
import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateImprRequestDto {
  @ApiProperty({ description: '요청 발생 페이지 URL' })
  @IsString()
  @MaxLength(500)
  pageUrl: string;

  @ApiPropertyOptional({ description: '클릭한 요소 텍스트' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  elementText?: string;

  @ApiPropertyOptional({ description: '클릭한 요소 HTML 태그' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  elementTag?: string;

  @ApiProperty({ description: '개선 내용 설명' })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ description: 'base64 스크린샷 (JPEG)' })
  @IsOptional()
  @IsString()
  screenshot?: string;
}

export class UpdateImprStatusDto {
  @ApiProperty({ description: '변경할 상태', enum: ['PENDING', 'IN_PROGRESS', 'DONE'] })
  @IsIn(['PENDING', 'IN_PROGRESS', 'DONE'])
  status: string;
}

export class ImprRequestQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'DONE', 'ALL'])
  status?: string;

  @ApiPropertyOptional({ description: 'description/pageUrl 키워드 검색' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({ description: '등록일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '등록일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}
