/**
 * @file src/modules/system/services/comm-config.service.ts
 * @description 통신설정 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: 페이지네이션 + 필터 목록 조회
 * 2. **findById / findByName / findByType**: 단건/유형별 조회
 * 3. **create / update / remove**: CRUD 처리, 소프트 삭제
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateCommConfigDto,
  UpdateCommConfigDto,
  CommConfigQueryDto,
} from '../dto/comm-config.dto';

@Injectable()
export class CommConfigService {
  private readonly logger = new Logger(CommConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 목록 조회 (페이지네이션 + 필터) */
  async findAll(query: CommConfigQueryDto) {
    const { page = 1, limit = 20, commType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (commType) where.commType = commType;
    if (useYn) where.useYn = useYn;

    if (search) {
      where.OR = [
        { configName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.commConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commConfig.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 단건 조회 (ID) */
  async findById(id: string) {
    const config = await this.prisma.commConfig.findUnique({
      where: { id },
    });

    if (!config || config.deletedAt) {
      throw new NotFoundException('통신설정을 찾을 수 없습니다.');
    }

    return config;
  }

  /** 이름으로 조회 (다른 화면에서 참조용) */
  async findByName(configName: string) {
    const config = await this.prisma.commConfig.findUnique({
      where: { configName },
    });

    if (!config || config.deletedAt) {
      throw new NotFoundException(`통신설정 '${configName}'을 찾을 수 없습니다.`);
    }

    return config;
  }

  /** 유형별 목록 (드롭다운용) */
  async findByType(commType: string) {
    return this.prisma.commConfig.findMany({
      where: {
        commType,
        useYn: 'Y',
        deletedAt: null,
      },
      select: {
        id: true,
        configName: true,
        commType: true,
        host: true,
        port: true,
        portName: true,
        baudRate: true,
      },
      orderBy: { configName: 'asc' },
    });
  }

  /** 생성 */
  async create(dto: CreateCommConfigDto) {
    const existing = await this.prisma.commConfig.findUnique({
      where: { configName: dto.configName },
    });

    if (existing) {
      throw new ConflictException(`이미 등록된 설정 이름입니다: ${dto.configName}`);
    }

    return this.prisma.commConfig.create({
      data: {
        configName: dto.configName,
        commType: dto.commType,
        description: dto.description,
        host: dto.host,
        port: dto.port,
        portName: dto.portName,
        baudRate: dto.baudRate,
        dataBits: dto.dataBits,
        stopBits: dto.stopBits,
        parity: dto.parity,
        flowControl: dto.flowControl,
        extraConfig: dto.extraConfig
          ? (dto.extraConfig as Prisma.InputJsonValue)
          : undefined,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  /** 수정 */
  async update(id: string, dto: UpdateCommConfigDto) {
    await this.findById(id);

    // 이름 변경 시 중복 체크
    if (dto.configName) {
      const existing = await this.prisma.commConfig.findUnique({
        where: { configName: dto.configName },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`이미 등록된 설정 이름입니다: ${dto.configName}`);
      }
    }

    return this.prisma.commConfig.update({
      where: { id },
      data: {
        ...(dto.configName !== undefined && { configName: dto.configName }),
        ...(dto.commType !== undefined && { commType: dto.commType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.host !== undefined && { host: dto.host }),
        ...(dto.port !== undefined && { port: dto.port }),
        ...(dto.portName !== undefined && { portName: dto.portName }),
        ...(dto.baudRate !== undefined && { baudRate: dto.baudRate }),
        ...(dto.dataBits !== undefined && { dataBits: dto.dataBits }),
        ...(dto.stopBits !== undefined && { stopBits: dto.stopBits }),
        ...(dto.parity !== undefined && { parity: dto.parity }),
        ...(dto.flowControl !== undefined && { flowControl: dto.flowControl }),
        ...(dto.extraConfig !== undefined && {
          extraConfig: dto.extraConfig as Prisma.InputJsonValue,
        }),
        ...(dto.useYn !== undefined && { useYn: dto.useYn }),
      },
    });
  }

  /** 삭제 (소프트 삭제) */
  async remove(id: string) {
    await this.findById(id);

    await this.prisma.commConfig.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: '통신설정이 삭제되었습니다.' };
  }
}
