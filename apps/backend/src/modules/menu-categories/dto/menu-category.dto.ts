/**
 * @file src/modules/menu-categories/dto/menu-category.dto.ts
 * @description 메뉴 카테고리 관련 DTO 정의 (생성/수정/정렬)
 *
 * 초보자 가이드:
 * - CreateMenuCategoryDto: 새 카테고리 생성 시 필요한 필드
 * - UpdateMenuCategoryDto: 카테고리 부분 수정 시 사용 (모든 필드 optional)
 * - ReorderCategoriesDto: 여러 카테고리의 표시 순서를 한 번에 변경할 때 사용
 * - CATEGORY_CODE_PATTERN: 코드 유효성 검사 정규식 (서비스에서도 재사용 가능)
 * - RESERVED_ROOT: 예약된 루트 코드 상수
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  IsIn,
  IsInt,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CATEGORY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
export const RESERVED_ROOT = '__ROOT__';

export class CreateMenuCategoryDto {
  @ApiProperty({
    example: 'NEW_CATEGORY',
    description:
      '카테고리 코드(영문 대문자/숫자/언더스코어, 2~50자). __ROOT__ 등 예약어는 생성 불가.',
  })
  @IsString()
  @Matches(CATEGORY_CODE_PATTERN, {
    message: '카테고리 코드는 영문 대문자/숫자/언더스코어 2~50자여야 합니다.',
  })
  code!: string;

  @ApiProperty({ example: 'menu.newCategory' })
  @IsString()
  @MaxLength(200)
  labelKey!: string;

  @ApiProperty({ required: false, example: 'Folder' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iconName?: string;
}

export class UpdateMenuCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  labelKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iconName?: string | null;

  @ApiProperty({ required: false, enum: ['Y', 'N'] })
  @IsOptional()
  @IsIn(['Y', 'N'])
  isActive?: 'Y' | 'N';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderCategoryItem {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [ReorderCategoryItem] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItem)
  items!: ReorderCategoryItem[];
}
