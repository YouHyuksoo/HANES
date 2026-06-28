import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { BomMaster } from '../../../entities/bom-master.entity';
import { HarnessCircuitSpec } from '../../../entities/harness-circuit-spec.entity';
import { HarnessDrawingMaster } from '../../../entities/harness-drawing-master.entity';
import { HarnessDrawingRevision } from '../../../entities/harness-drawing-revision.entity';
import { TransactionService } from '../../../shared/transaction.service';
import {
  CreateProductionSpecificationDto,
  HarnessCircuitSpecDto,
  ProductionSpecificationQueryDto,
  ReviseProductionSpecificationDto,
  UpdateProductionSpecificationDto,
  UpdateProductionSpecificationRevisionDto,
} from '../dto/production-specification.dto';

type DrawingDetail = HarnessDrawingMaster & {
  revisions?: HarnessDrawingRevision[];
  revision?: HarnessDrawingRevision & { circuits: HarnessCircuitSpec[] };
};

@Injectable()
export class ProductionSpecificationService {
  constructor(
    @InjectRepository(HarnessDrawingMaster)
    private readonly masterRepo: Repository<HarnessDrawingMaster>,
    @InjectRepository(HarnessDrawingRevision)
    private readonly revisionRepo: Repository<HarnessDrawingRevision>,
    @InjectRepository(HarnessCircuitSpec)
    private readonly circuitRepo: Repository<HarnessCircuitSpec>,
    @InjectRepository(BomMaster)
    private readonly bomRepo: Repository<BomMaster>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private async nextVal(manager: EntityManager, sequenceName: string): Promise<number> {
    const rows = await manager.query(`SELECT ${sequenceName}.NEXTVAL AS "NEXT_SEQ" FROM DUAL`);
    return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? rows[0]?.nextSeq);
  }

  private normalizeText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async validateCircuitWireItems(
    itemCode: string,
    circuits: HarnessCircuitSpecDto[] | undefined,
    company: string,
    plant: string,
  ) {
    const wireItemCodes = [...new Set((circuits ?? [])
      .map((circuit) => this.normalizeText(circuit.wireItemCode))
      .filter((value): value is string => !!value))];
    if (wireItemCodes.length === 0) return;

    const bomItems = await this.bomRepo.find({
      where: { parentItemCode: itemCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      select: ['childItemCode'],
    });
    const bomChildSet = new Set(bomItems.map((bom) => bom.childItemCode));
    const invalid = wireItemCodes.find((wireItemCode) => !bomChildSet.has(wireItemCode));
    if (invalid) {
      throw new BadRequestException(`BOM에 없는 전선 품목은 회로 사양에 연결할 수 없습니다: ${invalid}`);
    }
  }

  private nextRevisionCode(source: string): string {
    const code = source.trim().toUpperCase();
    if (/^[A-Y]$/.test(code)) return String.fromCharCode(code.charCodeAt(0) + 1);
    if (code === 'Z') return 'AA';
    const numeric = code.match(/^(.*?)(\d+)$/);
    if (numeric) return `${numeric[1]}${Number(numeric[2]) + 1}`;
    return `${code}-1`;
  }

  private async saveCircuitRows(
    manager: EntityManager,
    revisionId: number,
    circuits: HarnessCircuitSpecDto[] | undefined,
    company: string,
    plant: string,
    userId?: string,
  ) {
    for (const [index, circuit] of (circuits ?? []).entries()) {
      const circuitId = await this.nextVal(manager, 'SEQ_HARNESS_CIRCUIT_ID');
      const entity = manager.create(HarnessCircuitSpec, {
        circuitId,
        revisionId,
        sortOrder: index + 1,
        circuitNo: circuit.circuitNo,
        wireSpec: this.normalizeText(circuit.wireSpec),
        wireItemCode: this.normalizeText(circuit.wireItemCode),
        wireSize: this.normalizeText(circuit.wireSize),
        colorCode: this.normalizeText(circuit.colorCode),
        colorName: this.normalizeText(circuit.colorName),
        lengthMm: circuit.lengthMm ?? null,
        stripA: circuit.stripA ?? null,
        stripB: circuit.stripB ?? null,
        endAHousing: this.normalizeText(circuit.endAHousing),
        endATerminal: this.normalizeText(circuit.endATerminal),
        connectionSymbol: this.normalizeText(circuit.connectionSymbol),
        endBTerminal: this.normalizeText(circuit.endBTerminal),
        endBHousing: this.normalizeText(circuit.endBHousing),
        tubeSpec: this.normalizeText(circuit.tubeSpec),
        subNo: this.normalizeText(circuit.subNo),
        remark: this.normalizeText(circuit.remark),
        company,
        plant,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
      });
      await manager.save(HarnessCircuitSpec, entity);
    }
  }

  async findAll(query: ProductionSpecificationQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, itemCode, status } = query;
    const qb = this.masterRepo.createQueryBuilder('m');
    if (company) qb.andWhere('m.company = :company', { company });
    if (plant) qb.andWhere('m.plant = :plant', { plant });
    if (itemCode) qb.andWhere('m.itemCode = :itemCode', { itemCode });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(m.drawingNo LIKE :search OR m.itemCode LIKE :search OR m.erpItemNo LIKE :search OR m.itemName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }
    if (status) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM HARNESS_DRAWING_REVISIONS r
          WHERE r.DRAWING_ID = m.DRAWING_ID
            AND r.STATUS = :status
            ${company ? 'AND r.COMPANY = :company' : ''}
            ${plant ? 'AND r.PLANT_CD = :plant' : ''}
        )`,
        { status, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      );
    }
    qb.orderBy('m.updatedAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { data, total, page, limit };
  }

  async findOne(drawingId: number, company?: string, plant?: string): Promise<DrawingDetail> {
    const master = await this.masterRepo.findOne({
      where: { drawingId, ...this.tenantWhere(company, plant) },
    });
    if (!master) throw new NotFoundException(`도면을 찾을 수 없습니다: ${drawingId}`);

    const revisions = await this.revisionRepo.find({
      where: { drawingId, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
    });
    const latest = revisions[0];
    const revision = latest ? await this.findRevision(latest.revisionId, company, plant) : undefined;
    return { ...master, revisions, revision };
  }

  /**
   * 품목코드 기준 회로 목록 조회 — 해당 품목의 도면에서 유효 Revision(APPROVED 우선, 없으면 최신)의 회로를 반환.
   * 서브공정 키팅의 회로 선택 칸 데이터 소스. 도면/Revision/회로가 없으면 빈 배열.
   */
  async findCircuitsByItemCode(
    itemCode: string,
    company?: string,
    plant?: string,
  ): Promise<HarnessCircuitSpec[]> {
    const master = await this.masterRepo.findOne({
      where: { itemCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { updatedAt: 'DESC' },
    });
    if (!master) return [];

    const revisions = await this.revisionRepo.find({
      where: { drawingId: master.drawingId, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
    });
    const target = revisions.find((r) => r.status === 'APPROVED') ?? revisions[0];
    if (!target) return [];

    return this.circuitRepo.find({
      where: { revisionId: target.revisionId, ...this.tenantWhere(company, plant) },
      order: { sortOrder: 'ASC' },
    });
  }

  async findRevision(revisionId: number, company?: string, plant?: string) {
    const revision = await this.revisionRepo.findOne({
      where: { revisionId, ...this.tenantWhere(company, plant) },
    });
    if (!revision) throw new NotFoundException(`도면 Revision을 찾을 수 없습니다: ${revisionId}`);
    const circuits = await this.circuitRepo.find({
      where: { revisionId, ...this.tenantWhere(company, plant) },
      order: { sortOrder: 'ASC' },
    });
    return { ...revision, circuits };
  }

  async create(dto: CreateProductionSpecificationDto, company: string, plant: string, userId?: string) {
    const existing = await this.masterRepo.findOne({
      where: { drawingNo: dto.drawingNo, ...this.tenantWhere(company, plant) },
    });
    if (existing) throw new ConflictException(`이미 등록된 도면번호입니다: ${dto.drawingNo}`);

    await this.validateCircuitWireItems(dto.itemCode, dto.circuits, company, plant);

    let newDrawingId = 0;
    let newRevisionId = 0;
    await this.tx.run(async (queryRunner) => {
      const manager = queryRunner.manager;
      newDrawingId = await this.nextVal(manager, 'SEQ_HARNESS_DRAWING_ID');
      newRevisionId = await this.nextVal(manager, 'SEQ_HARNESS_DRAWING_REV_ID');
      await manager.save(HarnessDrawingMaster, manager.create(HarnessDrawingMaster, {
        drawingId: newDrawingId,
        drawingNo: dto.drawingNo.trim(),
        itemCode: dto.itemCode.trim(),
        itemName: this.normalizeText(dto.itemName),
        erpItemNo: this.normalizeText(dto.erpItemNo),
        customerPartNo: this.normalizeText(dto.customerPartNo),
        remark: this.normalizeText(dto.remark),
        useYn: 'Y',
        company,
        plant,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
      }));
      await manager.save(HarnessDrawingRevision, manager.create(HarnessDrawingRevision, {
        revisionId: newRevisionId,
        drawingId: newDrawingId,
        revisionCode: dto.revisionCode?.trim() || 'A',
        status: 'DRAFT',
        effectiveFrom: null,
        changeReason: null,
        approvedBy: null,
        approvedAt: null,
        company,
        plant,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
      }));
      await this.saveCircuitRows(manager, newRevisionId, dto.circuits, company, plant, userId);
    });

    const master = await this.masterRepo.findOne({
      where: { drawingId: newDrawingId, ...this.tenantWhere(company, plant) },
    });
    const revision = await this.findRevision(newRevisionId, company, plant);
    return { ...(master ?? { drawingId: newDrawingId }), revision };
  }

  async update(drawingId: number, dto: UpdateProductionSpecificationDto, company: string, plant: string, userId?: string) {
    const existing = await this.masterRepo.findOne({ where: { drawingId, ...this.tenantWhere(company, plant) } });
    if (!existing) throw new NotFoundException(`도면을 찾을 수 없습니다: ${drawingId}`);
    await this.masterRepo.update(
      { drawingId, ...this.tenantWhere(company, plant) },
      {
        ...(dto.drawingNo !== undefined ? { drawingNo: dto.drawingNo.trim() } : {}),
        ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode.trim() } : {}),
        ...(dto.itemName !== undefined ? { itemName: this.normalizeText(dto.itemName) } : {}),
        ...(dto.erpItemNo !== undefined ? { erpItemNo: this.normalizeText(dto.erpItemNo) } : {}),
        ...(dto.customerPartNo !== undefined ? { customerPartNo: this.normalizeText(dto.customerPartNo) } : {}),
        ...(dto.remark !== undefined ? { remark: this.normalizeText(dto.remark) } : {}),
        updatedBy: userId ?? null,
      },
    );
    return this.findOne(drawingId, company, plant);
  }

  async updateRevision(
    revisionId: number,
    dto: UpdateProductionSpecificationRevisionDto,
    company: string,
    plant: string,
    userId?: string,
  ) {
    const revision = await this.revisionRepo.findOne({
      where: { revisionId, ...this.tenantWhere(company, plant) },
    });
    if (!revision) throw new NotFoundException(`도면 Revision을 찾을 수 없습니다: ${revisionId}`);
    if (revision.status === 'APPROVED' && dto.circuits !== undefined) {
      throw new BadRequestException('승인된 Revision은 회로 사양을 직접 수정할 수 없습니다. 새 Revision을 생성하세요.');
    }
    if (dto.circuits !== undefined) {
      const master = await this.masterRepo.findOne({
        where: { drawingId: revision.drawingId, ...this.tenantWhere(company, plant) },
      });
      if (!master) throw new NotFoundException(`도면을 찾을 수 없습니다: ${revision.drawingId}`);
      await this.validateCircuitWireItems(master.itemCode, dto.circuits, company, plant);
    }

    await this.tx.run(async (queryRunner) => {
      const manager = queryRunner.manager;
      await manager.update(HarnessDrawingRevision, { revisionId, company, plant }, {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.changeReason !== undefined ? { changeReason: this.normalizeText(dto.changeReason) } : {}),
        updatedBy: userId ?? null,
      });
      if (dto.circuits !== undefined) {
        await manager.delete(HarnessCircuitSpec, { revisionId, company, plant });
        await this.saveCircuitRows(manager, revisionId, dto.circuits, company, plant, userId);
      }
    });

    return this.findRevision(revisionId, company, plant);
  }

  async approveRevision(revisionId: number, company: string, plant: string, userId?: string) {
    const revision = await this.revisionRepo.findOne({ where: { revisionId, ...this.tenantWhere(company, plant) } });
    if (!revision) throw new NotFoundException(`도면 Revision을 찾을 수 없습니다: ${revisionId}`);
    await this.revisionRepo.update({ revisionId, ...this.tenantWhere(company, plant) }, {
      status: 'APPROVED',
      approvedBy: userId ?? null,
      approvedAt: new Date(),
      updatedBy: userId ?? null,
    });
    return this.findRevision(revisionId, company, plant);
  }

  async revise(
    revisionId: number,
    dto: ReviseProductionSpecificationDto,
    company: string,
    plant: string,
    userId?: string,
  ) {
    const source = await this.revisionRepo.findOne({
      where: { revisionId, ...this.tenantWhere(company, plant) },
    });
    if (!source) throw new NotFoundException(`도면 Revision을 찾을 수 없습니다: ${revisionId}`);
    const sourceCircuits = await this.circuitRepo.find({
      where: { revisionId, ...this.tenantWhere(company, plant) },
      order: { sortOrder: 'ASC' },
    });

    let newRevisionId = 0;
    await this.tx.run(async (queryRunner) => {
      const manager = queryRunner.manager;
      newRevisionId = await this.nextVal(manager, 'SEQ_HARNESS_DRAWING_REV_ID');
      await manager.save(HarnessDrawingRevision, manager.create(HarnessDrawingRevision, {
        revisionId: newRevisionId,
        drawingId: source.drawingId,
        revisionCode: this.nextRevisionCode(source.revisionCode),
        status: 'DRAFT',
        effectiveFrom: null,
        changeReason: this.normalizeText(dto.changeReason),
        approvedBy: null,
        approvedAt: null,
        company,
        plant,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
      }));
      await this.saveCircuitRows(
        manager,
        newRevisionId,
        sourceCircuits.map((c) => ({
          circuitNo: c.circuitNo,
          wireSpec: c.wireSpec ?? undefined,
          wireItemCode: c.wireItemCode ?? undefined,
          wireSize: c.wireSize ?? undefined,
          colorCode: c.colorCode ?? undefined,
          colorName: c.colorName ?? undefined,
          lengthMm: c.lengthMm ?? undefined,
          stripA: c.stripA ?? undefined,
          stripB: c.stripB ?? undefined,
          endAHousing: c.endAHousing ?? undefined,
          endATerminal: c.endATerminal ?? undefined,
          connectionSymbol: c.connectionSymbol ?? undefined,
          endBTerminal: c.endBTerminal ?? undefined,
          endBHousing: c.endBHousing ?? undefined,
          tubeSpec: c.tubeSpec ?? undefined,
          subNo: c.subNo ?? undefined,
          remark: c.remark ?? undefined,
        })),
        company,
        plant,
        userId,
      );
    });

    const revision = await this.findRevision(newRevisionId, company, plant);
    return { drawingId: source.drawingId, revision };
  }

  async delete(drawingId: number, company: string, plant: string) {
    await this.findOne(drawingId, company, plant);
    const revisions = await this.revisionRepo.find({ where: { drawingId, ...this.tenantWhere(company, plant) } });
    const revisionIds = revisions.map((revision) => revision.revisionId);
    if (revisionIds.length > 0) {
      // N+1 제거: 리비전별 개별 삭제 대신 In(...)으로 일괄 삭제
      await this.circuitRepo.delete({ revisionId: In(revisionIds), ...this.tenantWhere(company, plant) });
    }
    await this.revisionRepo.delete({ drawingId, ...this.tenantWhere(company, plant) });
    await this.masterRepo.delete({ drawingId, ...this.tenantWhere(company, plant) });
    return { drawingId };
  }
}
