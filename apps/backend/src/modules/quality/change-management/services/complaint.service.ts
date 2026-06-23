/**
 * @file complaint.service.ts
 * @description 고객클레임 관리 서비스 — IATF 16949 10.2.6 고객 불만 처리
 *
 * 초보자 가이드:
 * 1. **클레임 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **상태 흐름**: RECEIVED → INVESTIGATING → RESPONDING → RESOLVED → CLOSED
 * 3. **8D 프로세스**: 접수 → 조사(원인분석/봉쇄) → 대응(시정/예방) → 해결 → 종료
 * 4. **CAPA 연계**: 클레임에서 시정/예방조치(CAPA) 생성 연계
 * 5. **complaintNo 자동채번**: CC-YYYYMMDD-NNN 형식
 *
 * 주요 메서드:
 * - findAll / findById: 목록/단건 조회
 * - create / update / delete: 기본 CRUD
 * - investigate: 조사 시작 (RECEIVED → INVESTIGATING)
 * - respond: 대응 완료 (INVESTIGATING → RESPONDING)
 * - resolve: 해결 (RESPONDING → RESOLVED)
 * - close: 종료 (RESOLVED → CLOSED)
 * - linkCapa: CAPA 연계
 * - getStats: 상태별 통계
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerComplaint } from '../../../../entities/customer-complaint.entity';
import { parseDateStart } from '../../../../shared/date.util';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  ComplaintQueryDto,
  InvestigateComplaintDto,
  RespondComplaintDto,
  LinkCapaDto,
} from '../dto/complaint.dto';

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);

  constructor(
    @InjectRepository(CustomerComplaint)
    private readonly complaintRepo: Repository<CustomerComplaint>,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  // =============================================
  // 클레임번호 자동채번
  // =============================================

  /**
   * 클레임번호 자동채번: CC-YYYYMMDD-NNN
   */
  private async generateComplaintNo(company: string, plant: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CC-${dateStr}-`;

    const last = await this.complaintRepo
      .createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant })
      .andWhere('c.complaintNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.complaintNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.complaintNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * 클레임 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: ComplaintQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      complaintType,
      urgency,
      customerCode,
      search,
      fromDate,
      toDate,
    } = query;

    const qb = this.complaintRepo.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (status) qb.andWhere('c.status = :status', { status });
    if (complaintType) qb.andWhere('c.complaintType = :complaintType', { complaintType });
    if (urgency) qb.andWhere('c.urgency = :urgency', { urgency });
    if (customerCode) qb.andWhere('c.customerCode = :customerCode', { customerCode });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(c.complaintNo LIKE :sCode OR c.customerName LIKE :sRaw OR c.itemCode LIKE :sCode)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }
    if (fromDate) qb.andWhere("c.complaintDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    if (toDate) qb.andWhere("c.complaintDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });

    qb.orderBy('c.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 클레임 단건 조회
   */
  async findById(complaintNo: string, company?: string, plant?: string) {
    const item = await this.complaintRepo.findOne({ where: { complaintNo, ...this.tenantWhere(company, plant) } });
    if (!item) {
      throw new NotFoundException('고객클레임을 찾을 수 없습니다.');
    }
    this.assertSameTenant('고객클레임', item, company, plant);
    return item;
  }

  /**
   * 클레임 등록
   */
  async create(
    dto: CreateComplaintDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const complaintNo = await this.generateComplaintNo(company, plant);
    const entity = this.complaintRepo.create({
      complaintNo,
      customerCode: dto.customerCode,
      customerName: dto.customerName,
      complaintDate: parseDateStart(dto.complaintDate)!,
      itemCode: dto.itemCode,
      lotNo: dto.lotNo,
      defectQty: dto.defectQty,
      complaintType: dto.complaintType,
      description: dto.description,
      urgency: dto.urgency,
      responsibleCode: dto.responsibleCode,
      costAmount: dto.costAmount,
      status: 'RECEIVED',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.complaintRepo.save(entity);
    this.logger.log(`고객클레임 등록: ${complaintNo}`);
    return saved;
  }

  /**
   * 클레임 수정 (RECEIVED 상태에서만 가능)
   */
  async update(complaintNo: string, dto: UpdateComplaintDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    if (item.status !== 'RECEIVED') {
      throw new BadRequestException('접수 상태에서만 수정할 수 있습니다.');
    }
    const updateData: Partial<CustomerComplaint> = {
      ...(dto.customerCode !== undefined ? { customerCode: dto.customerCode } : {}),
      ...(dto.customerName !== undefined ? { customerName: dto.customerName } : {}),
      ...(dto.complaintDate !== undefined ? { complaintDate: parseDateStart(dto.complaintDate)! } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.lotNo !== undefined ? { lotNo: dto.lotNo } : {}),
      ...(dto.defectQty !== undefined ? { defectQty: dto.defectQty } : {}),
      ...(dto.complaintType !== undefined ? { complaintType: dto.complaintType } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.urgency !== undefined ? { urgency: dto.urgency } : {}),
      ...(dto.responsibleCode !== undefined ? { responsibleCode: dto.responsibleCode } : {}),
      ...(dto.costAmount !== undefined ? { costAmount: dto.costAmount } : {}),
    };
    Object.assign(item, updateData, { updatedBy: userId });
    return this.complaintRepo.save(item);
  }

  /**
   * 클레임 삭제 (RECEIVED 상태에서만 가능)
   */
  async delete(complaintNo: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    if (item.status !== 'RECEIVED') {
      throw new BadRequestException('접수 상태에서만 삭제할 수 있습니다.');
    }
    await this.complaintRepo.remove(item);
  }

  // =============================================
  // 상태 전환
  // =============================================

  /**
   * 조사 시작 (RECEIVED → INVESTIGATING)
   */
  async investigate(complaintNo: string, dto: InvestigateComplaintDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    if (item.status !== 'RECEIVED') {
      throw new BadRequestException('접수 상태에서만 조사를 시작할 수 있습니다.');
    }
    item.status = 'INVESTIGATING';
    if (dto.investigation) item.investigation = dto.investigation;
    if (dto.rootCause) item.rootCause = dto.rootCause;
    if (dto.containmentAction) item.containmentAction = dto.containmentAction;
    item.updatedBy = userId;
    this.logger.log(`고객클레임 조사 시작: ${item.complaintNo}`);
    return this.complaintRepo.save(item);
  }

  /**
   * 대응 완료 (INVESTIGATING → RESPONDING)
   */
  async respond(complaintNo: string, dto: RespondComplaintDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    if (item.status !== 'INVESTIGATING') {
      throw new BadRequestException('조사중 상태에서만 대응할 수 있습니다.');
    }
    item.status = 'RESPONDING';
    if (dto.correctiveAction) item.correctiveAction = dto.correctiveAction;
    if (dto.preventiveAction) item.preventiveAction = dto.preventiveAction;
    if (dto.responseDate) item.responseDate = parseDateStart(dto.responseDate)!;
    item.updatedBy = userId;
    this.logger.log(`고객클레임 대응 완료: ${item.complaintNo}`);
    return this.complaintRepo.save(item);
  }

  /**
   * 해결 (RESPONDING → RESOLVED)
   */
  async resolve(complaintNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    if (item.status !== 'RESPONDING') {
      throw new BadRequestException('대응중 상태에서만 해결할 수 있습니다.');
    }
    item.status = 'RESOLVED';
    item.resolvedAt = new Date();
    item.updatedBy = userId;
    this.logger.log(`고객클레임 해결: ${item.complaintNo}`);
    return this.complaintRepo.save(item);
  }

  /**
   * 종료 (RESOLVED → CLOSED)
   */
  async close(complaintNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    if (item.status !== 'RESOLVED') {
      throw new BadRequestException('해결 상태에서만 종료할 수 있습니다.');
    }
    item.status = 'CLOSED';
    item.updatedBy = userId;
    this.logger.log(`고객클레임 종료: ${item.complaintNo}`);
    return this.complaintRepo.save(item);
  }

  /**
   * CAPA 연계
   */
  async linkCapa(complaintNo: string, dto: LinkCapaDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(complaintNo, company, plant);
    item.capaId = dto.capaId;
    item.updatedBy = userId;
    this.logger.log(`고객클레임 CAPA 연계: ${item.complaintNo} → CAPA#${dto.capaId}`);
    return this.complaintRepo.save(item);
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 상태별 통계 (건수 + 불량수량 합계)
   */
  async getStats(company?: string, plant?: string) {
    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(c.defectQty), 0)', 'totalDefectQty');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });

    qb.groupBy('c.status');
    return qb.getRawMany();
  }
}
