/**
 * @file src/modules/shipping/services/box.service.ts
 * @description 박스 관리 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **시리얼 관리**: addSerial로 시리얼 번호 추가
 * 3. **상태 관리**: closeBox로 박스 닫기, 팔레트 할당
 * 4. **Prisma 사용**: PrismaService를 통해 DB 접근
 *
 * 실제 DB 스키마 (box_masters 테이블):
 * - boxNo가 유니크 키
 * - status: OPEN, CLOSED, SHIPPED
 * - partId로 PartMaster와 연결
 * - palletId로 PalletMaster와 연결 (nullable)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateBoxDto,
  UpdateBoxDto,
  BoxQueryDto,
  AddSerialToBoxDto,
  AssignBoxToPalletDto,
  BoxStatus,
} from '../dto/box.dto';

@Injectable()
export class BoxService {
  private readonly logger = new Logger(BoxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 박스 목록 조회
   */
  async findAll(query: BoxQueryDto, company?: string) {
    const {
      page = 1,
      limit = 10,
      boxNo,
      partId,
      palletId,
      status,
      unassigned,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(boxNo && { boxNo: { contains: boxNo, mode: 'insensitive' as const } }),
      ...(partId && { partId }),
      ...(palletId && { palletId }),
      ...(status && { status }),
      ...(unassigned && { palletId: null }),
    };

    const [data, total] = await Promise.all([
      this.prisma.boxMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          part: {
            select: {
              id: true,
              partCode: true,
              partName: true,
              partType: true,
            },
          },
          pallet: {
            select: {
              id: true,
              palletNo: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.boxMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 박스 단건 조회 (ID)
   */
  async findById(id: string) {
    const box = await this.prisma.boxMaster.findFirst({
      where: { id, deletedAt: null },
      include: {
        part: true,
        pallet: true,
      },
    });

    if (!box) {
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${id}`);
    }

    return box;
  }

  /**
   * 박스 단건 조회 (박스번호)
   */
  async findByBoxNo(boxNo: string) {
    const box = await this.prisma.boxMaster.findFirst({
      where: { boxNo, deletedAt: null },
      include: {
        part: true,
        pallet: true,
      },
    });

    if (!box) {
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${boxNo}`);
    }

    return box;
  }

  /**
   * 박스 생성
   */
  async create(dto: CreateBoxDto) {
    // 중복 체크
    const existing = await this.prisma.boxMaster.findFirst({
      where: { boxNo: dto.boxNo, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 박스번호입니다: ${dto.boxNo}`);
    }

    // 품목 존재 확인
    const part = await this.prisma.partMaster.findFirst({
      where: { id: dto.partId, deletedAt: null },
    });

    if (!part) {
      throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.partId}`);
    }

    return this.prisma.boxMaster.create({
      data: {
        boxNo: dto.boxNo,
        partId: dto.partId,
        qty: dto.qty,
        serialList: dto.serialList ?? [],
        status: 'OPEN',
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 박스 수정
   */
  async update(id: string, dto: UpdateBoxDto) {
    const box = await this.findById(id);

    // SHIPPED 상태에서는 수정 불가
    if (box.status === 'SHIPPED') {
      throw new BadRequestException('출하된 박스는 수정할 수 없습니다.');
    }

    return this.prisma.boxMaster.update({
      where: { id },
      data: {
        ...(dto.qty !== undefined && { qty: dto.qty }),
        ...(dto.serialList !== undefined && { serialList: dto.serialList }),
        ...(dto.palletId !== undefined && { palletId: dto.palletId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
        pallet: {
          select: {
            id: true,
            palletNo: true,
          },
        },
      },
    });
  }

  /**
   * 박스 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const box = await this.findById(id);

    // SHIPPED 상태에서는 삭제 불가
    if (box.status === 'SHIPPED') {
      throw new BadRequestException('출하된 박스는 삭제할 수 없습니다.');
    }

    // 팔레트에 할당되어 있으면 삭제 불가
    if (box.palletId) {
      throw new BadRequestException('팔레트에 할당된 박스는 삭제할 수 없습니다. 먼저 팔레트에서 제거해주세요.');
    }

    return this.prisma.boxMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ===== 시리얼 관리 =====

  /**
   * 박스에 시리얼 추가
   */
  async addSerial(id: string, dto: AddSerialToBoxDto) {
    const box = await this.findById(id);

    // OPEN 상태에서만 시리얼 추가 가능
    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 시리얼을 추가할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 기존 시리얼 목록
    const existingSerials = (box.serialList as string[]) || [];

    // 중복 시리얼 체크
    const duplicates = dto.serials.filter(s => existingSerials.includes(s));
    if (duplicates.length > 0) {
      throw new ConflictException(`이미 존재하는 시리얼입니다: ${duplicates.join(', ')}`);
    }

    // 새로운 시리얼 목록
    const newSerialList = [...existingSerials, ...dto.serials];
    const newQty = newSerialList.length;

    return this.prisma.boxMaster.update({
      where: { id },
      data: {
        serialList: newSerialList,
        qty: newQty,
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 박스에서 시리얼 제거
   */
  async removeSerial(id: string, serials: string[]) {
    const box = await this.findById(id);

    // OPEN 상태에서만 시리얼 제거 가능
    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 시리얼을 제거할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 기존 시리얼 목록
    const existingSerials = (box.serialList as string[]) || [];

    // 존재하지 않는 시리얼 체크
    const notFound = serials.filter(s => !existingSerials.includes(s));
    if (notFound.length > 0) {
      throw new NotFoundException(`존재하지 않는 시리얼입니다: ${notFound.join(', ')}`);
    }

    // 새로운 시리얼 목록
    const newSerialList = existingSerials.filter(s => !serials.includes(s));
    const newQty = newSerialList.length;

    return this.prisma.boxMaster.update({
      where: { id },
      data: {
        serialList: newSerialList,
        qty: newQty,
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  // ===== 상태 관리 =====

  /**
   * 박스 닫기 (OPEN -> CLOSED)
   */
  async closeBox(id: string) {
    const box = await this.findById(id);

    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 박스를 닫을 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 빈 박스는 닫을 수 없음
    if (box.qty <= 0) {
      throw new BadRequestException('빈 박스는 닫을 수 없습니다.');
    }

    return this.prisma.boxMaster.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closeAt: new Date(),
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  /**
   * 박스 다시 열기 (CLOSED -> OPEN)
   */
  async reopenBox(id: string) {
    const box = await this.findById(id);

    if (box.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 박스를 다시 열 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 팔레트에 할당되어 있으면 다시 열 수 없음
    if (box.palletId) {
      throw new BadRequestException('팔레트에 할당된 박스는 다시 열 수 없습니다.');
    }

    return this.prisma.boxMaster.update({
      where: { id },
      data: {
        status: 'OPEN',
        closeAt: null,
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
    });
  }

  // ===== 팔레트 할당 =====

  /**
   * 박스를 팔레트에 할당
   */
  async assignToPallet(id: string, dto: AssignBoxToPalletDto) {
    const box = await this.findById(id);

    // CLOSED 상태에서만 팔레트 할당 가능
    if (box.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 팔레트에 할당할 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 이미 다른 팔레트에 할당되어 있는 경우
    if (box.palletId && box.palletId !== dto.palletId) {
      throw new BadRequestException('이미 다른 팔레트에 할당된 박스입니다.');
    }

    // 팔레트 존재 및 상태 확인
    const pallet = await this.prisma.palletMaster.findFirst({
      where: { id: dto.palletId, deletedAt: null },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${dto.palletId}`);
    }

    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`팔레트 상태(${pallet.status})가 OPEN이 아닙니다. OPEN 상태 팔레트에만 박스를 할당할 수 있습니다.`);
    }

    // 트랜잭션으로 박스 할당 및 팔레트 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 박스 업데이트
      const updatedBox = await tx.boxMaster.update({
        where: { id },
        data: { palletId: dto.palletId },
        include: {
          part: {
            select: {
              id: true,
              partCode: true,
              partName: true,
            },
          },
          pallet: {
            select: {
              id: true,
              palletNo: true,
            },
          },
        },
      });

      // 팔레트 집계 업데이트
      const palletSummary = await tx.boxMaster.aggregate({
        where: { palletId: dto.palletId, deletedAt: null },
        _count: true,
        _sum: { qty: true },
      });

      await tx.palletMaster.update({
        where: { id: dto.palletId },
        data: {
          boxCount: palletSummary._count,
          totalQty: palletSummary._sum.qty ?? 0,
        },
      });

      return updatedBox;
    });
  }

  /**
   * 박스를 팔레트에서 제거
   */
  async removeFromPallet(id: string) {
    const box = await this.findById(id);

    if (!box.palletId) {
      throw new BadRequestException('팔레트에 할당되지 않은 박스입니다.');
    }

    // 팔레트가 OPEN 상태일 때만 제거 가능
    const pallet = await this.prisma.palletMaster.findFirst({
      where: { id: box.palletId, deletedAt: null },
    });

    if (!pallet) {
      throw new NotFoundException('팔레트를 찾을 수 없습니다.');
    }

    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`팔레트 상태(${pallet.status})가 OPEN이 아닙니다. OPEN 상태 팔레트에서만 박스를 제거할 수 있습니다.`);
    }

    const palletId = box.palletId;

    // 트랜잭션으로 박스 제거 및 팔레트 집계 업데이트
    return this.prisma.$transaction(async (tx) => {
      // 박스 업데이트
      const updatedBox = await tx.boxMaster.update({
        where: { id },
        data: { palletId: null },
        include: {
          part: {
            select: {
              id: true,
              partCode: true,
              partName: true,
            },
          },
        },
      });

      // 팔레트 집계 업데이트
      const palletSummary = await tx.boxMaster.aggregate({
        where: { palletId, deletedAt: null },
        _count: true,
        _sum: { qty: true },
      });

      await tx.palletMaster.update({
        where: { id: palletId },
        data: {
          boxCount: palletSummary._count,
          totalQty: palletSummary._sum.qty ?? 0,
        },
      });

      return updatedBox;
    });
  }

  // ===== 조회 유틸리티 =====

  /**
   * 팔레트별 박스 목록 조회
   */
  async findByPalletId(palletId: string) {
    return this.prisma.boxMaster.findMany({
      where: { palletId, deletedAt: null },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 품목별 박스 목록 조회
   */
  async findByPartId(partId: string, status?: BoxStatus) {
    return this.prisma.boxMaster.findMany({
      where: {
        partId,
        deletedAt: null,
        ...(status && { status }),
      },
      include: {
        pallet: {
          select: {
            id: true,
            palletNo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 미할당 박스 목록 조회 (팔레트에 할당되지 않은 CLOSED 상태)
   */
  async findUnassignedBoxes() {
    return this.prisma.boxMaster.findMany({
      where: {
        palletId: null,
        status: 'CLOSED',
        deletedAt: null,
      },
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
