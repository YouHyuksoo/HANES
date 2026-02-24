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

  /** 사용자 목록 조회 (검색/필터) */
  async findAll(query?: { search?: string; role?: string; status?: string }, company?: string) {
    const where: Record<string, unknown> = {
      ...(company && { company }),
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
        'id',
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'photoUrl',
        'lastLoginAt',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /** 사용자 상세 조회 */
  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'photoUrl',
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
  async create(dto: CreateUserDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
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
    });

    const savedUser = await this.userRepository.save(user);

    this.logger.log(`User created: ${savedUser.email}`);

    return {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      empNo: savedUser.empNo,
      dept: savedUser.dept,
      role: savedUser.role,
      status: savedUser.status,
      photoUrl: savedUser.photoUrl,
      createdAt: savedUser.createdAt,
    };
  }

  /** 사용자 수정 */
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // 존재 확인

    await this.userRepository.update(id, dto);

    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'name',
        'empNo',
        'dept',
        'role',
        'status',
        'photoUrl',
        'createdAt',
        'updatedAt',
      ],
    });

    this.logger.log(`User updated: ${user!.email}`);
    return user;
  }

  /** 사용자 삭제 (소프트 삭제) */
  async remove(id: string) {
    await this.findOne(id);

    await this.userRepository.delete(id);

    this.logger.log(`User deleted: ${id}`);
    return { message: '사용자가 삭제되었습니다.' };
  }

  /** 사진 URL 업데이트 */
  async updatePhoto(id: string, photoUrl: string | null) {
    const user = await this.findOne(id);
    
    await this.userRepository.update(id, { photoUrl });
    
    this.logger.log(`User photo updated: ${user.email}`);
    return { 
      id, 
      photoUrl,
      message: photoUrl ? '사진이 업로드되었습니다.' : '사진이 삭제되었습니다.' 
    };
  }
}
