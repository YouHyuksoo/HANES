/**
 * @file src/modules/menu-categories/dto/menu-category-item.dto.ts
 * @description 메뉴 카테고리 내 메뉴 아이템(leaf) 이동/정렬 관련 DTO 정의
 *
 * 초보자 가이드:
 * - MoveMenuItemDto: 특정 메뉴를 다른 카테고리로 이동할 때 사용
 * - ReorderMenuItemsDto: 카테고리 내 메뉴 아이템들의 순서를 한 번에 변경할 때 사용
 * - menuCode: 이동/정렬할 메뉴의 고유 코드 (leaf 노드)
 * - toCategoryCode: 이동 목적지 카테고리 코드
 * - sortOrder: 카테고리 내 표시 순서 (0부터 시작)
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MoveMenuItemDto {
  @ApiProperty({ description: '이동할 메뉴 코드(leaf)' })
  @IsString()
  menuCode!: string;

  @ApiProperty({ description: '대상 카테고리 코드' })
  @IsString()
  toCategoryCode!: string;

  @ApiProperty({ description: '카테고리 내 표시 순서' })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderMenuItem {
  @ApiProperty()
  @IsString()
  menuCode!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderMenuItemsDto {
  @ApiProperty({ type: [ReorderMenuItem] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItem)
  items!: ReorderMenuItem[];
}
