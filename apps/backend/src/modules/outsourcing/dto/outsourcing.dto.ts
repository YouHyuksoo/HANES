/**
 * @file src/modules/outsourcing/dto/outsourcing.dto.ts
 * @description 외주관리 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsDateString,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// 외주처 마스터 DTOs
// ============================================================================

export class CreateVendorDto {
  @ApiProperty({ description: '외주처 코드', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  vendorCode: string;

  @ApiProperty({ description: '외주처명', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  vendorName: string;

  @ApiPropertyOptional({ description: '사업자번호', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bizNo?: string;

  @ApiPropertyOptional({ description: '대표자명', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ceoName?: string;

  @ApiPropertyOptional({ description: '주소', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: '전화번호', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tel?: string;

  @ApiPropertyOptional({ description: '팩스번호', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  fax?: string;

  @ApiPropertyOptional({ description: '이메일' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: '담당자명', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPerson?: string;

  @ApiPropertyOptional({ description: '업체 유형', enum: ['SUBCON', 'SUPPLIER'] })
  @IsOptional()
  @IsString()
  vendorType?: string;
}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @ApiPropertyOptional({ description: '사용 여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  useYn?: string;
}

export class VendorQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '업체 유형' })
  @IsOptional()
  @IsString()
  vendorType?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '사용 여부' })
  @IsOptional()
  @IsString()
  useYn?: string;
}

// ============================================================================
// 외주발주 DTOs
// ============================================================================

export class CreateSubconOrderDto {
  @ApiProperty({ description: '외주처 ID' })
  @IsString()
  vendorId: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  partCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  partName?: string;

  @ApiProperty({ description: '발주 수량' })
  @IsInt()
  @Min(1)
  orderQty: number;

  @ApiPropertyOptional({ description: '단가' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: '발주일' })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @ApiPropertyOptional({ description: '납기일' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateSubconOrderDto extends PartialType(CreateSubconOrderDto) {
  @ApiPropertyOptional({ description: '상태', enum: ['ORDERED', 'DELIVERED', 'PARTIAL_RECV', 'RECEIVED', 'CLOSED', 'CANCELED'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class SubconOrderQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '외주처 ID' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ============================================================================
// 외주 출고 DTOs
// ============================================================================

export class CreateSubconDeliveryDto {
  @ApiProperty({ description: '외주발주 ID' })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ description: 'LOT 번호' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiProperty({ description: '출고 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

// ============================================================================
// 외주 입고 DTOs
// ============================================================================

export class CreateSubconReceiveDto {
  @ApiProperty({ description: '외주발주 ID' })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ description: 'LOT 번호' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiProperty({ description: '입고 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: '양품 수량' })
  @IsOptional()
  @IsInt()
  @Min(0)
  goodQty?: number;

  @ApiPropertyOptional({ description: '불량 수량' })
  @IsOptional()
  @IsInt()
  @Min(0)
  defectQty?: number;

  @ApiPropertyOptional({ description: '검사 결과', enum: ['PASS', 'FAIL', 'PARTIAL'] })
  @IsOptional()
  @IsString()
  inspectResult?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}
