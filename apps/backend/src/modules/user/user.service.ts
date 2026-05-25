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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private sanitizeUpdateDto(dto: UpdateUserDto): UpdateUserDto {
    const { company: _company, plant: _plant, email: _email, ...safeDto } = dto as UpdateUserDto & {
      company?: string;
      plant?: string;
      email?: string;
    };
    return safeDto;
  }

  /** 사용자 목록 조회 (검색/필터) */
  async findAll(query?: { search?: string; role?: string; status?: string }, company?: string, plant?: string) {
    const where: Record<string, unknown> = {
      ...this.tenantWhere(company, plant),
    };

    if (query?.role) {
      where.role = query.role;
    }
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.search) {
      where.email = ILike(`%${query.search}%`);
    }

    return this.userRepository.find({
      where,
      select: [
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'photoUrl',
        'pdaRoleCode',
        'lastLoginAt',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /** 사용자 상세 조회 */
  async findOne(id: string, company?: string, plant?: string) {
    const user = await this.userRepository.findOne({
      where: { email: id, ...this.tenantWhere(company, plant) },
      select: [
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'photoUrl',
        'pdaRoleCode',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  /** 사용자 생성 */
  async create(dto: CreateUserDto, company?: string, plant?: string) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const user = this.userRepository.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      empNo: dto.empNo,
      dept: dto.dept,
      role: dto.role || 'OPERATOR',
      pdaRoleCode: dto.pdaRoleCode ?? null,
      company: company || null,
      plant: plant || null,
    });

    const savedUser = await this.userRepository.save(user);

    this.logger.log(`User created: ${savedUser.email}`);

    return {
      id: savedUser.email,
      email: savedUser.email,
      name: savedUser.name,
      empNo: savedUser.empNo,
      dept: savedUser.dept,
      role: savedUser.role,
      status: savedUser.status,
      photoUrl: savedUser.photoUrl,
      pdaRoleCode: savedUser.pdaRoleCode,
      createdAt: savedUser.createdAt,
    };
  }

  /** 사용자 수정 */
  async update(id: string, dto: UpdateUserDto, company?: string, plant?: string) {
    await this.findOne(id, company, plant); // 존재 확인

    const safeDto = this.sanitizeUpdateDto(dto);
    await this.userRepository.update({ email: id, ...this.tenantWhere(company, plant) }, safeDto);

    const user = await this.userRepository.findOne({
      where: { email: id, ...this.tenantWhere(company, plant) },
      select: [
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'photoUrl',
        'pdaRoleCode',
        'createdAt',
        'updatedAt',
      ],
    });

    this.logger.log(`User updated: ${user!.email}`);
    return user;
  }

  /** 사용자 삭제 (소프트 삭제) */
  async remove(id: string, company?: string, plant?: string) {
    await this.findOne(id, company, plant);

    await this.userRepository.delete({ email: id, ...this.tenantWhere(company, plant) });

    this.logger.log(`User deleted: ${id}`);
    return { message: '사용자가 삭제되었습니다.' };
  }

  /** 사진 URL 업데이트 */
  async updatePhoto(id: string, photoUrl: string | null, company?: string, plant?: string) {
    const user = await this.findOne(id, company, plant);
    
    await this.userRepository.update({ email: id, ...this.tenantWhere(company, plant) }, { photoUrl });
    
    this.logger.log(`User photo updated: ${user.email}`);
    return { 
      id, 
      photoUrl,
      message: photoUrl ? '사진이 업로드되었습니다.' : '사진이 삭제되었습니다.' 
    };
  }
}
