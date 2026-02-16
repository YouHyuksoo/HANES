/**
 * @file src/modules/master/services/department.service.ts
 * @description 부서마스터 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto, DepartmentQueryDto } from '../dto/department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: DepartmentQueryDto, company?: string) {
    const { page = 1, limit = 50, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { deptCode: { contains: search, mode: 'insensitive' as const } },
          { deptName: { contains: search, mode: 'insensitive' as const } },
          { managerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.departmentMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { deptCode: 'asc' }],
      }),
      this.prisma.departmentMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const dept = await this.prisma.departmentMaster.findFirst({ where: { id, deletedAt: null } });
    if (!dept) throw new NotFoundException(`부서를 찾을 수 없습니다: ${id}`);
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.departmentMaster.findFirst({
      where: { deptCode: dto.deptCode, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 부서코드입니다: ${dto.deptCode}`);

    return this.prisma.departmentMaster.create({
      data: {
        deptCode: dto.deptCode,
        deptName: dto.deptName,
        parentDeptCode: dto.parentDeptCode,
        sortOrder: dto.sortOrder ?? 0,
        managerName: dto.managerName,
        remark: dto.remark,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findById(id);
    return this.prisma.departmentMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.departmentMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
