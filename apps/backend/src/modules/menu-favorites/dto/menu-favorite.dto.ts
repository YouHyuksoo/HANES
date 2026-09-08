/**
 * @file src/modules/menu-favorites/dto/menu-favorite.dto.ts
 * @description 사용자 메뉴 즐겨찾기 DTO
 *
 * 초보자 가이드:
 * - ReplaceMenuFavoritesDto: 내 즐겨찾기 전체 교체 (배열 순서 = 표시 순서)
 * - menuCodes: menuConfig leaf 코드 배열 (빈 배열 = 전체 해제)
 */
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength, IsInt, Min, Max, ValidateIf, Matches } from 'class-validator';

/** 즐겨찾기 최대 개수 — 사이드바 표시 특성상 과도한 등록 방지 */
export const MAX_FAVORITES = 30;

export class ReplaceMenuFavoritesDto {
  @ApiProperty({ description: '즐겨찾기 메뉴 코드 배열 (순서 = 표시 순서)', type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_FAVORITES)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  menuCodes!: string[];
}

export class FavoriteFolderNameDto {
  @ApiProperty({ description: '폴더명', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @Matches(/\S/, { message: '폴더명을 입력하세요.' })
  name!: string;
}

export class AssignFavoriteFolderDto {
  @ApiProperty({ description: '폴더 ID (null이면 폴더 밖으로 이동)', nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(999999999999999)
  folderId!: number | null;
}
