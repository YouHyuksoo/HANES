/**
 * @file src/modules/user/user.service.ts
 * @description 사용자 CRUD 서비스
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 사용자 목록 조회 (검색/필터) */
  async findAll(query?: { search?: string; role?: string; status?: string }) {
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (query?.role) {
      where.role = query.role;
    }
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { empNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        empNo: true,
        dept: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 사용자 상세 조회 */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        empNo: true,
        dept: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  /** 사용자 생성 */
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: dto.password,
        name: dto.name,
        empNo: dto.empNo,
        dept: dto.dept,
        role: dto.role || 'OPERATOR',
      },
      select: {
        id: true,
        email: true,
        name: true,
        empNo: true,
        dept: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    this.logger.log(`User created: ${user.email}`);
    return user;
  }

  /** 사용자 수정 */
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // 존재 확인

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        empNo: true,
        dept: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User updated: ${user.email}`);
    return user;
  }

  /** 사용자 삭제 (소프트 삭제) */
  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    this.logger.log(`User deleted: ${id}`);
    return { message: '사용자가 삭제되었습니다.' };
  }
}
