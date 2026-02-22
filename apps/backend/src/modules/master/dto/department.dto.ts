/**
 * @file src/modules/master/dto/department.dto.ts
 * @description 부서마스터 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';

export class CreateDepartmentDto {
  @ApiProperty({ description: '부서코드', example: 'D001' })
  @IsString()
  @MaxLength(20)
  deptCode: string;

  @ApiProperty({ description: '부서명', example: '생산1팀' })
  @IsString()
  @MaxLength(100)
  deptName: string;

  @ApiPropertyOptional({ description: '상위부서코드' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  parentDeptCode?: string;

  @ApiPropertyOptional({ description: '정렬순서', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '부서장' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  managerName?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class DepartmentQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
