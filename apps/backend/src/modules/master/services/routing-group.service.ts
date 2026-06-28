/**
 * @file src/modules/master/services/routing-group.service.ts
 * @description ?쇱슦??洹몃９ + 怨듭젙?쒖꽌 + ?묓뭹議곌굔 鍮꾩쫰?덉뒪 濡쒖쭅
 *
 * 珥덈낫??媛?대뱶:
 * 1. ?쇱슦??洹몃９ CRUD: ROUTING_GROUPS ?뚯씠釉?
 * 2. 怨듭젙?쒖꽌 CRUD: ROUTING_PROCESSES ?뚯씠釉?
 * 3. ?묓뭹議곌굔 CRUD + bulk: PROCESS_QUALITY_CONDITIONS ?뚯씠釉?
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ProcessQualityCondition } from '../../../entities/process-quality-condition.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingMaterial } from '../../../entities/routing-material.entity';
import { HarnessCircuitSpec } from '../../../entities/harness-circuit-spec.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import {
  CreateRoutingGroupDto, UpdateRoutingGroupDto, RoutingGroupQueryDto,
  CreateRoutingProcessDto, UpdateRoutingProcessDto,
  BulkSaveConditionDto, BulkSaveRoutingMaterialDto,
} from '../dto/routing-group.dto';

@Injectable()
export class RoutingGroupService {
  constructor(
    @InjectRepository(RoutingGroup)
    private readonly groupRepo: Repository<RoutingGroup>,
    @InjectRepository(RoutingProcess)
    private readonly processRepo: Repository<RoutingProcess>,
    @InjectRepository(ProcessMaster)
    private readonly processMasterRepo: Repository<ProcessMaster>,
    @InjectRepository(ProcessQualityCondition)
    private readonly conditionRepo: Repository<ProcessQualityCondition>,
    @InjectRepository(ItemMaster)
    private readonly partRepo: Repository<ItemMaster>,
    @InjectRepository(BomMaster)
    private readonly bomRepo: Repository<BomMaster>,
    @InjectRepository(RoutingMaterial)
    private readonly materialRepo: Repository<RoutingMaterial>,
    @InjectRepository(HarnessCircuitSpec)
    private readonly circuitRepo: Repository<HarnessCircuitSpec>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private async findCircuitOptions(itemCode: string, childCodes: string[], company?: string, plant?: string) {
    if (childCodes.length === 0) return [];
    const binds: unknown[] = [itemCode];
    const bind = (value: unknown) => {
      binds.push(value);
      return `:${binds.length}`;
    };
    let tenantFilter = '';
    if (company) {
      tenantFilter += ` AND m.COMPANY = ${bind(company)} AND r.COMPANY = ${bind(company)} AND c.COMPANY = ${bind(company)}`;
    }
    if (plant) {
      tenantFilter += ` AND m.PLANT_CD = ${bind(plant)} AND r.PLANT_CD = ${bind(plant)} AND c.PLANT_CD = ${bind(plant)}`;
    }
    const childPlaceholders = childCodes.map((code) => bind(code)).join(', ');

    return this.circuitRepo.query(
      `SELECT c.CIRCUIT_ID AS "circuitId",
              c.CIRCUIT_NO AS "circuitNo",
              c.WIRE_ITEM_CODE AS "wireItemCode",
              c.LENGTH_MM AS "lengthMm",
              c.STRIP_A_MM AS "stripA",
              c.STRIP_B_MM AS "stripB"
         FROM HARNESS_DRAWING_MASTERS m
         JOIN HARNESS_DRAWING_REVISIONS r ON r.DRAWING_ID = m.DRAWING_ID
         JOIN HARNESS_CIRCUIT_SPECS c ON c.REVISION_ID = r.REVISION_ID
        WHERE m.ITEM_CODE = :1
          AND m.USE_YN = 'Y'
          AND c.WIRE_ITEM_CODE IN (${childPlaceholders})
          ${tenantFilter}
        ORDER BY r.CREATED_AT DESC, c.SORT_ORDER ASC`,
      binds,
    );
  }

  private async validateMaterialCircuitLinks(
    itemCode: string,
    materials: BulkSaveRoutingMaterialDto['materials'],
    company?: string,
    plant?: string,
  ) {
    // 회로 연결이 지정된 자재만 검증 대상
    const targets = materials.filter((m) => m.circuitId != null);
    if (targets.length === 0) return;

    // 자식코드를 모아 한 번의 쿼리로 회로사양 조회 후 메모리에서 매칭(N+1 제거)
    const childCodes = [...new Set(targets.map((m) => m.childItemCode))];
    const rows = await this.findCircuitOptions(itemCode, childCodes, company, plant);
    const valid = new Set(
      (rows as { circuitId: number | string; wireItemCode: string }[]).map(
        (r) => `${r.wireItemCode}::${Number(r.circuitId)}`,
      ),
    );

    for (const material of targets) {
      if (!valid.has(`${material.childItemCode}::${Number(material.circuitId)}`)) {
        throw new ConflictException(`라우팅 자재와 연결할 수 없는 회로 사양입니다: ${material.childItemCode}/${material.circuitId}`);
      }
    }
  }

  private async resolveProcessMaster(processCode: string, company?: string, plant?: string) {
    const processMaster = await this.processMasterRepo.findOne({
      where: { processCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
    });
    if (!processMaster) throw new NotFoundException(`공정마스터를 찾을 수 없습니다: ${processCode}`);
    return processMaster;
  }

  // ??? ?쇱슦??洹몃９ CRUD ???

  async findAllGroups(query: RoutingGroupQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, useYn, itemType } = query;
    const skip = (page - 1) * limit;
    const qb = this.groupRepo.createQueryBuilder('g')
      .leftJoin('ITEM_MASTERS', 'p', 'g.ITEM_CODE = p.ITEM_CODE AND g.COMPANY = p.COMPANY AND g.PLANT_CD = p.PLANT_CD')
      .addSelect('p.ITEM_NAME', 'itemName')
      .addSelect('p.ITEM_TYPE', 'itemType');

    if (company) qb.andWhere('g.company = :company', { company });
    if (plant) qb.andWhere('g.plant = :plant', { plant });
    if (useYn) qb.andWhere('g.useYn = :useYn', { useYn });
    if (itemType) qb.andWhere('p.ITEM_TYPE = :itemType', { itemType });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(g.routingCode LIKE :s OR g.routingName LIKE :sRaw OR g.itemCode LIKE :s OR p.ITEM_NAME LIKE :sRaw)',
        { s: `%${upper}%`, sRaw: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const rawAndEntities = await qb
      .orderBy('g.routingCode', 'ASC')
      .skip(skip).take(limit)
      .getRawAndEntities();

    const data = rawAndEntities.entities.map((entity, i) => ({
      ...entity,
      itemName: rawAndEntities.raw[i]?.itemName || null,
      itemType: rawAndEntities.raw[i]?.itemType || null,
    }));

    return { data, total, page, limit };
  }

  /** ?덈ぉ肄붾뱶濡??쇱슦??洹몃９ 議고쉶 (BOM ?섏씠吏?? */
  async findByItemCode(itemCode: string, company?: string, plant?: string) {
    const group = await this.groupRepo.findOne({ where: { itemCode, useYn: 'Y', ...this.tenantWhere(company, plant) } });
    if (!group) return null;

    const processes = await this.processRepo.find({
      where: { routingCode: group.routingCode, ...this.tenantWhere(company, plant) },
      order: { seq: 'ASC' },
    });

    return { ...group, processes };
  }

  async findGroupByCode(routingCode: string, company?: string, plant?: string) {
    const group = await this.groupRepo.findOne({ where: { routingCode, ...this.tenantWhere(company, plant) } });
    if (!group) throw new NotFoundException(`?쇱슦??洹몃９??李얠쓣 ???놁뒿?덈떎: ${routingCode}`);
    return group;
  }

  async createGroup(dto: CreateRoutingGroupDto, company?: string, plant?: string) {
    const existing = await this.groupRepo.findOne({ where: { routingCode: dto.routingCode, ...this.tenantWhere(company, plant) } });
    if (existing) throw new ConflictException(`?대? 議댁옱?섎뒗 ?쇱슦??洹몃９: ${dto.routingCode}`);

    const group = this.groupRepo.create({
      routingCode: dto.routingCode,
      routingName: dto.routingName,
      itemCode: dto.itemCode ?? null,
      description: dto.description ?? null,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
    });
    return this.groupRepo.save(group);
  }

  async updateGroup(routingCode: string, dto: UpdateRoutingGroupDto, company?: string, plant?: string) {
    await this.findGroupByCode(routingCode, company, plant);
    const updateData: Partial<Pick<RoutingGroup, 'routingName' | 'itemCode' | 'description' | 'useYn'>> = {
      ...(dto.routingName !== undefined ? { routingName: dto.routingName } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.groupRepo.update({ routingCode, ...this.tenantWhere(company, plant) }, updateData);
    return this.findGroupByCode(routingCode, company, plant);
  }

  async deleteGroup(routingCode: string, company?: string, plant?: string) {
    await this.findGroupByCode(routingCode, company, plant);
    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.delete(ProcessQualityCondition, { routingCode, ...this.tenantWhere(company, plant) });
      await queryRunner.manager.delete(RoutingMaterial, { routingCode, ...this.tenantWhere(company, plant) });
      await queryRunner.manager.delete(RoutingProcess, { routingCode, ...this.tenantWhere(company, plant) });
      await queryRunner.manager.delete(RoutingGroup, { routingCode, ...this.tenantWhere(company, plant) });
    });
    return { routingCode };
  }

  // ??? 怨듭젙?쒖꽌 CRUD ???

  async findProcesses(routingCode: string, company?: string, plant?: string) {
    return this.processRepo.find({
      where: { routingCode, ...this.tenantWhere(company, plant) },
      order: { seq: 'ASC' },
    });
  }

  async createProcess(dto: CreateRoutingProcessDto, company?: string, plant?: string) {
    const existing = await this.processRepo.findOne({
      where: { routingCode: dto.routingCode, seq: dto.seq, ...this.tenantWhere(company, plant) },
    });
    if (existing) throw new ConflictException(`?대? 議댁옱?섎뒗 怨듭젙?쒖꽌: ${dto.routingCode} / seq ${dto.seq}`);
    const processMaster = await this.resolveProcessMaster(dto.processCode, company, plant);

    const proc = this.processRepo.create({
      routingCode: dto.routingCode,
      seq: dto.seq,
      processCode: dto.processCode,
      processName: processMaster.processName,
      processType: processMaster.processType ?? dto.processType ?? null,
      equipType: dto.equipType ?? null,
      executionType: dto.executionType ?? 'IN_HOUSE',
      jobOrderYn: dto.jobOrderYn ?? 'Y',
      subconVendorCode: dto.executionType === 'SUBCON' ? dto.subconVendorCode ?? null : null,
      stdTime: dto.stdTime ?? null,
      setupTime: dto.setupTime ?? null,
      sampleInspectYn: dto.sampleInspectYn ?? 'N',
      issueLabelType: dto.issueLabelType ?? 'NONE',
      useYn: dto.useYn ?? 'Y',
      qcSelfYn: dto.qcSelfYn ?? 'N',
      inspectMethod: dto.inspectMethod ?? 'DIRECT',
      destructiveYn: dto.destructiveYn ?? 'N',
      sampleQty: dto.sampleQty ?? 1,
      company,
      plant,
    });
    return this.processRepo.save(proc);
  }

  async updateProcess(routingCode: string, seq: number, dto: UpdateRoutingProcessDto, company?: string, plant?: string) {
    const existing = await this.processRepo.findOne({ where: { routingCode, seq, ...this.tenantWhere(company, plant) } });
    if (!existing) throw new NotFoundException(`怨듭젙?쒖꽌瑜?李얠쓣 ???놁뒿?덈떎: ${routingCode}/${seq}`);
    const processMaster = dto.processCode !== undefined
      ? await this.resolveProcessMaster(dto.processCode, company, plant)
      : null;
    const nextExecutionType = dto.executionType ?? existing.executionType ?? 'IN_HOUSE';
    const nextSubconVendorCode = dto.executionType !== undefined && nextExecutionType !== 'SUBCON'
      ? null
      : dto.subconVendorCode !== undefined
        ? nextExecutionType === 'SUBCON'
          ? dto.subconVendorCode || null
          : null
        : undefined;

    const updateData: Partial<Pick<
      RoutingProcess,
      | 'processCode'
      | 'processName'
      | 'processType'
      | 'equipType'
      | 'executionType'
      | 'jobOrderYn'
      | 'subconVendorCode'
      | 'stdTime'
      | 'setupTime'
      | 'sampleInspectYn'
      | 'issueLabelType'
      | 'useYn'
      | 'qcSelfYn'
      | 'inspectMethod'
      | 'destructiveYn'
      | 'sampleQty'
    >> = {
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(processMaster ? { processName: processMaster.processName, processType: processMaster.processType ?? dto.processType ?? null } : {}),
      ...(!processMaster && dto.processType !== undefined ? { processType: dto.processType } : {}),
      ...(dto.equipType !== undefined ? { equipType: dto.equipType } : {}),
      ...(dto.executionType !== undefined ? { executionType: dto.executionType } : {}),
      ...(dto.jobOrderYn !== undefined ? { jobOrderYn: dto.jobOrderYn } : {}),
      ...(nextSubconVendorCode !== undefined ? { subconVendorCode: nextSubconVendorCode } : {}),
      ...(dto.stdTime !== undefined ? { stdTime: dto.stdTime } : {}),
      ...(dto.setupTime !== undefined ? { setupTime: dto.setupTime } : {}),
      ...(dto.sampleInspectYn !== undefined ? { sampleInspectYn: dto.sampleInspectYn } : {}),
      ...(dto.issueLabelType !== undefined ? { issueLabelType: dto.issueLabelType } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.qcSelfYn !== undefined ? { qcSelfYn: dto.qcSelfYn } : {}),
      ...(dto.inspectMethod !== undefined ? { inspectMethod: dto.inspectMethod } : {}),
      ...(dto.destructiveYn !== undefined ? { destructiveYn: dto.destructiveYn } : {}),
      ...(dto.sampleQty !== undefined ? { sampleQty: dto.sampleQty } : {}),
    };
    await this.processRepo.update({ routingCode, seq, ...this.tenantWhere(company, plant) }, updateData);
    return this.processRepo.findOne({ where: { routingCode, seq, ...this.tenantWhere(company, plant) } });
  }

  async deleteProcess(routingCode: string, seq: number, company?: string, plant?: string) {
    const existing = await this.processRepo.findOne({ where: { routingCode, seq, ...this.tenantWhere(company, plant) } });
    if (!existing) throw new NotFoundException(`怨듭젙?쒖꽌瑜?李얠쓣 ???놁뒿?덈떎: ${routingCode}/${seq}`);

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.delete(ProcessQualityCondition, { routingCode, seq, ...this.tenantWhere(company, plant) });
      await queryRunner.manager.delete(RoutingMaterial, { routingCode, seq, ...this.tenantWhere(company, plant) });
      await queryRunner.manager.delete(RoutingProcess, { routingCode, seq, ...this.tenantWhere(company, plant) });
    });
    return { routingCode, seq };
  }

  // ??? ?묓뭹議곌굔 CRUD ???

  async findConditions(routingCode: string, seq: number, company?: string, plant?: string) {
    return this.conditionRepo.find({
      where: { routingCode, seq, ...this.tenantWhere(company, plant) },
      order: { conditionSeq: 'ASC' },
    });
  }

  private async resolveProcessTenant(routingCode: string, seq: number, company?: string, plant?: string) {
    const process = await this.processRepo.findOne({
      where: { routingCode, seq },
      select: ['routingCode', 'seq', 'company', 'plant'],
    });
    if (!process) throw new NotFoundException(`공정순서를 찾을 수 없습니다: ${routingCode}/${seq}`);

    if (company && company !== process.company) {
      throw new ConflictException(
        `요청 회사와 라우팅 공정 회사가 일치하지 않습니다. request=${company}, process=${process.company}`,
      );
    }
    if (plant && plant !== process.plant) {
      throw new ConflictException(
        `요청 사업장과 라우팅 공정 사업장이 일치하지 않습니다. request=${plant}, process=${process.plant}`,
      );
    }

    return {
      company: company ?? process.company,
      plant: plant ?? process.plant,
    };
  }

  async bulkSaveConditions(
    routingCode: string, seq: number,
    dto: BulkSaveConditionDto,
    company?: string, plant?: string,
  ) {
    const tenant = await this.resolveProcessTenant(routingCode, seq, company, plant);

    return this.tx.run(async (queryRunner) => {
      await queryRunner.manager.delete(ProcessQualityCondition, { routingCode, seq, company: tenant.company, plant: tenant.plant });
      if (dto.conditions.length === 0) return [];

      const entities = dto.conditions.map((c) =>
        queryRunner.manager.create(ProcessQualityCondition, {
          routingCode, seq,
          conditionSeq: c.conditionSeq,
          conditionCode: c.conditionCode,
          minValue: c.minValue,
          maxValue: c.maxValue,
          unit: c.unit,
          equipInterfaceYn: c.equipInterfaceYn ?? 'N',
          useYn: 'Y',
          company: tenant.company,
          plant: tenant.plant,
        }),
      );
      return queryRunner.manager.save(ProcessQualityCondition, entities);
    });
  }

  async findMaterials(routingCode: string, seq: number, company?: string, plant?: string) {
    const group = await this.findGroupByCode(routingCode, company, plant);
    if (!group.itemCode) return [];

    const bomItems = await this.bomRepo.find({
      where: { parentItemCode: group.itemCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return [];

    const childCodes = bomItems.map((b) => b.childItemCode);
    const [materials, parts] = await Promise.all([
      this.materialRepo.find({
        where: { routingCode, seq, useYn: 'Y', ...this.tenantWhere(company, plant) },
      }),
      this.partRepo.find({
        where: { itemCode: In(childCodes), ...this.tenantWhere(company, plant) },
        select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'unit'],
      }),
    ]);

    const materialMap = new Map(materials.map((m) => [m.childItemCode, m]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const circuitOptions = await this.findCircuitOptions(group.itemCode, childCodes, company, plant);
    const circuitOptionsByWire = new Map<string, any[]>();
    for (const circuit of circuitOptions) {
      const key = String(circuit.wireItemCode);
      circuitOptionsByWire.set(key, [...(circuitOptionsByWire.get(key) ?? []), circuit]);
    }

    return bomItems.map((bom) => {
      const material = materialMap.get(bom.childItemCode);
      const part = partMap.get(bom.childItemCode);
      const options = circuitOptionsByWire.get(bom.childItemCode) ?? [];
      const linkedCircuit = options.find((circuit) => Number(circuit.circuitId) === Number(material?.circuitId));
      return {
        routingCode,
        seq,
        childItemCode: bom.childItemCode,
        childItemName: part?.itemName ?? null,
        childItemNo: part?.itemNo ?? null,
        childItemType: part?.itemType ?? null,
        unit: part?.unit ?? null,
        qtyPer: bom.qtyPer,
        selected: !!material,
        circuitId: material?.circuitId ?? null,
        circuitNo: linkedCircuit?.circuitNo ?? null,
        lengthMm: linkedCircuit?.lengthMm != null ? Number(linkedCircuit.lengthMm) : null,
        stripA: linkedCircuit?.stripA != null ? Number(linkedCircuit.stripA) : null,
        stripB: linkedCircuit?.stripB != null ? Number(linkedCircuit.stripB) : null,
        circuitOptions: options,
        allocQty: material?.allocQty ?? null,
        issueMethod: material?.issueMethod ?? 'BACKFLUSH',
        useYn: material?.useYn ?? 'Y',
      };
    });
  }

  async bulkSaveMaterials(
    routingCode: string, seq: number,
    dto: BulkSaveRoutingMaterialDto,
    company?: string, plant?: string,
  ) {
    const group = await this.findGroupByCode(routingCode, company, plant);
    if (!group.itemCode) throw new ConflictException(`라우팅 그룹에 품목이 연결되어 있지 않습니다: ${routingCode}`);

    const tenant = await this.resolveProcessTenant(routingCode, seq, company, plant);
    const bomItems = await this.bomRepo.find({
      where: { parentItemCode: group.itemCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      select: ['parentItemCode', 'childItemCode', 'revision'],
    });
    const bomChildSet = new Set(bomItems.map((b) => b.childItemCode));
    const invalid = dto.materials.find((m) => !bomChildSet.has(m.childItemCode));
    if (invalid) {
      throw new ConflictException(`BOM에 없는 자재는 공정에 매핑할 수 없습니다: ${invalid.childItemCode}`);
    }
    await this.validateMaterialCircuitLinks(group.itemCode, dto.materials, company, plant);

    return this.tx.run(async (queryRunner) => {
      await queryRunner.manager.delete(RoutingMaterial, { routingCode, seq, company: tenant.company, plant: tenant.plant });
      if (dto.materials.length === 0) return [];

      const entities = dto.materials.map((m) =>
        queryRunner.manager.create(RoutingMaterial, {
          routingCode,
          seq,
          childItemCode: m.childItemCode,
          circuitId: m.circuitId ?? null,
          allocQty: m.allocQty ?? 0,
          issueMethod: m.issueMethod ?? 'BACKFLUSH',
          useYn: 'Y',
          company: tenant.company,
          plant: tenant.plant,
        }),
      );
      return queryRunner.manager.save(RoutingMaterial, entities);
    });
  }
}
