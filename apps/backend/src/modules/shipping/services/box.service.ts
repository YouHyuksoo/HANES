import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, In, Like, Not, Between, Repository } from 'typeorm';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { OqcRequest } from '../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../entities/oqc-request-box.entity';
import {
  CreateBoxDto,
  UpdateBoxDto,
  BoxQueryDto,
  AddSerialToBoxDto,
  AssignBoxToPalletDto,
  BoxStatus,
} from '../dto/box.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

@Injectable()
export class BoxService {
  private readonly logger = new Logger(BoxService.name);

  constructor(
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    @InjectRepository(PalletMaster)
    private readonly palletRepository: Repository<PalletMaster>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    @InjectRepository(MatLot)
    private readonly lotRepository: Repository<MatLot>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    @InjectRepository(OqcRequest)
    private readonly oqcRequestRepository: Repository<OqcRequest>,
    @InjectRepository(OqcRequestBox)
    private readonly oqcRequestBoxRepository: Repository<OqcRequestBox>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /**
   * 교차 박스 중복 포장 방지: 다른 박스의 SERIAL_LIST에 이미 담긴 시리얼이 있으면 409.
   * FG 라벨 상태는 박스 마감 전까지 바뀌지 않으므로(OPEN 박스 간 중복은 라벨 상태로 못 막음)
   * SERIAL_LIST 자체를 검사한다. LIKE 후보 조회 → JSON 파싱 정확 비교로 오탐 제거.
   */
  private async assertSerialsNotPackedElsewhere(
    serials: string[],
    excludeBoxNo: string | null,
    company?: string,
    plant?: string,
  ) {
    if (serials.length === 0) return;

    const candidates = await this.boxRepository.find({
      where: serials.map((serial) => ({
        serialList: Like(`%"${serial}"%`),
        ...(excludeBoxNo ? { boxNo: Not(excludeBoxNo) } : {}),
        ...this.tenantWhere(company, plant),
      })),
    });

    const conflictBoxBySerial = new Map<string, string>();
    for (const other of candidates) {
      let otherSerials: string[];
      try {
        otherSerials = other.serialList ? JSON.parse(other.serialList) : [];
      } catch {
        this.logger.warn(`박스 ${other.boxNo} serialList 파싱 실패 - 교차 포장 검사 제외`);
        continue;
      }
      for (const serial of serials) {
        if (!conflictBoxBySerial.has(serial) && otherSerials.includes(serial)) {
          conflictBoxBySerial.set(serial, other.boxNo);
        }
      }
    }

    if (conflictBoxBySerial.size > 0) {
      const detail = [...conflictBoxBySerial].map(([serial, boxNo]) => `${serial}(${boxNo})`).join(', ');
      throw new ConflictException(`이미 다른 박스에 포장된 시리얼입니다: ${detail}`);
    }
  }

  private async nextOqcRequestNo() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `OQC-${dateStr}`;

    const lastReq = await this.oqcRequestRepository
      .createQueryBuilder('oqc')
      .where('oqc.requestNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('oqc.requestNo', 'DESC')
      .getOne();

    const seq = lastReq
      ? parseInt(lastReq.requestNo.split('-').pop() || '0', 10) + 1
      : 1;

    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  async findAll(query: BoxQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, boxNo, itemCode, palletId: palletNo, status, unassigned, oqcStatus, createdFrom, createdTo, includeOpen } = query;
    const skip = (page - 1) * limit;

    // 날짜·상태를 제외한 공통 조건(모든 OR 절에 공통 적용)
    const common: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(boxNo && { boxNo: ILike(`%${boxNo}%`) }),
      ...(itemCode && { itemCode }),
      ...(palletNo && { palletNo }),
      ...(unassigned && { palletNo: IsNull() }),
      ...(oqcStatus && { oqcStatus }),
    };

    // 생성일 범위(시작/종료 중 하나만 와도 처리)
    const createdRange =
      createdFrom && createdTo
        ? Between(parseDateStart(createdFrom)!, parseDateEnd(createdTo)!)
        : createdFrom
          ? Between(parseDateStart(createdFrom)!, parseDateEnd(createdFrom)!)
          : createdTo
            ? Between(parseDateStart(createdTo)!, parseDateEnd(createdTo)!)
            : undefined;

    // 검색어(박스번호 OR 품목코드)를 각 기본 절에 곱해 OR 확장
    const withSearch = (base: Record<string, unknown>): Record<string, unknown>[] =>
      search
        ? [
            { ...base, boxNo: ILike(`%${search}%`) },
            { ...base, itemCode: ILike(`%${search}%`) },
          ]
        : [base];

    // 기본 절 구성:
    //  - status 명시 → 해당 상태만(기간 적용, OPEN-always 무시)
    //  - status 미지정 + 기간 있음 → 기간 내 전체 + (includeOpen 시) 기간 밖 OPEN도 포함
    //  - 기간 없음 → 공통 조건만
    let baseClauses: Record<string, unknown>[];
    if (status) {
      baseClauses = [{ ...common, status, ...(createdRange && { createdAt: createdRange }) }];
    } else if (createdRange) {
      baseClauses = [{ ...common, createdAt: createdRange }];
      if (includeOpen) baseClauses.push({ ...common, status: 'OPEN' });
    } else {
      baseClauses = [{ ...common }];
    }
    const where = baseClauses.flatMap(withSearch);

    const [data, total] = await Promise.all([
      this.boxRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.boxRepository.count({ where }),
    ]);

    // 품목명·박스입수량(boxQty) 일괄 보강 (N+1 방지)
    const itemCodes = [...new Set(data.map((b) => b.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));
    const enriched = data.map((box) => {
      const part = partMap.get(box.itemCode);
      const bq = part?.boxQty != null ? Number(part.boxQty) : null;
      return {
        ...box,
        itemName: part?.itemName ?? null,
        itemType: part?.itemType ?? null,
        boxQty: bq != null && Number.isFinite(bq) && bq > 0 ? bq : null,
      };
    });

    return { data: enriched, total, page, limit };
  }

  async findById(boxNo: string, company?: string, plant?: string) {
    const box = await this.boxRepository.findOne({
      where: { boxNo, ...this.tenantWhere(company, plant) },
    });
    if (!box) {
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${boxNo}`);
    }
    return box;
  }

  async findByBoxNo(boxNo: string, company?: string, plant?: string) {
    const box = await this.findById(boxNo, company, plant);
    const part = await this.partRepository.findOne({
      where: { itemCode: box.itemCode, ...this.tenantWhere(company, plant) },
    });

    return {
      ...box,
      part: part
        ? {
            itemCode: part.itemCode,
            itemName: part.itemName,
            itemType: part.itemType,
            unit: part.unit,
          }
        : null,
    };
  }

  /** 포장 대기 FG 시리얼: 검사합격(VISUAL_PASS)이고 박스 미배정(BOX_NO IS NULL) */
  async findPackableSerials(company?: string, plant?: string, itemCode?: string) {
    const labels = await this.fgLabelRepository.find({
      where: {
        status: 'VISUAL_PASS',
        boxNo: IsNull(),
        ...(itemCode ? { itemCode } : {}),
        ...this.tenantWhere(company, plant),
      },
      order: { itemCode: 'ASC', issuedAt: 'ASC' },
    });
    if (labels.length === 0) return [];
    const itemCodes = [...new Set(labels.map((l) => l.itemCode))];
    const parts = await this.partRepository.find({
      where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) },
    });
    const nameMap = new Map(parts.map((p) => [p.itemCode, p.itemName] as const));
    return labels.map((l) => ({
      fgBarcode: l.fgBarcode,
      itemCode: l.itemCode,
      itemName: nameMap.get(l.itemCode) ?? null,
      orderNo: l.orderNo ?? null,
      issuedAt: l.issuedAt ?? null,
    }));
  }

  async findBoxItems(boxNo: string, company?: string, plant?: string) {
    const box = await this.findById(boxNo, company, plant);
    const serials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
    if (serials.length === 0) {
      return [];
    }

    const [labels, part] = await Promise.all([
      this.fgLabelRepository.find({
        where: { fgBarcode: In(serials), ...this.tenantWhere(company, plant) },
      }),
      this.partRepository.findOne({
        where: { itemCode: box.itemCode, ...this.tenantWhere(company, plant) },
      }),
    ]);
    const labelMap = new Map(labels.map((label) => [label.fgBarcode, label] as const));

    return serials.map((serial, index) => {
      const label = labelMap.get(serial);
      return {
        seq: index + 1,
        fgBarcode: serial,
        itemCode: label?.itemCode ?? box.itemCode,
        itemName: part?.itemName ?? null,
        orderNo: label?.orderNo ?? null,
        equipCode: label?.equipCode ?? null,
        workerId: label?.workerId ?? null,
        lineCode: label?.lineCode ?? null,
        status: label?.status ?? null,
        inspectPassYn: label?.inspectPassYn ?? null,
        issuedAt: label?.issuedAt ?? null,
        missingLabel: !label,
      };
    });
  }

  /**
   * 박스별 제품재고 집계 (왼쪽 그리드)
   * 재고 단위 = 시리얼(FG_LABELS). BOX_NO는 포장 식별이고, 창고입고 여부는
   * PRODUCT_TRANSACTIONS(refType=BOX) 입고 이동 이력으로 별도 판정한다.
   */
  async findStockByBox(boxNo: string | undefined, company?: string, plant?: string) {
    const qb = this.fgLabelRepository
      .createQueryBuilder('l')
      .select('l.boxNo', 'boxNo')
      .addSelect('l.itemCode', 'itemCode')
      .addSelect('COUNT(*)', 'qty')
      .addSelect('MIN(l.orderNo)', 'orderNo')
      .addSelect('MAX(l.issuedAt)', 'latestAt')
      .addSelect('MAX(CASE WHEN tx.transNo IS NOT NULL THEN 1 ELSE 0 END)', 'receivedFlag')
      .addSelect('MAX(tx.transDate)', 'receivedAt')
      .addSelect('MAX(COALESCE(tx.toWarehouseId, tx.fromWarehouseId))', 'warehouseCode')
      .leftJoin(
        ProductTransaction,
        'tx',
        [
          'tx.refType = :boxRefType',
          'tx.refId = l.boxNo',
          'tx.status = :doneStatus',
          'tx.transType IN (:...receiveTransTypes)',
          'tx.company = l.company',
          'tx.plant = l.plant',
        ].join(' AND '),
        {
          boxRefType: 'BOX',
          doneStatus: 'DONE',
          receiveTransTypes: ['WIP_OUT', 'FG_IN'],
        },
      )
      .where('l.boxNo IS NOT NULL')
      .andWhere("l.status <> 'SHIPPED'")
      .groupBy('l.boxNo')
      .addGroupBy('l.itemCode')
      .orderBy('l.boxNo', 'DESC');
    if (company) qb.andWhere('l.company = :company', { company });
    if (plant) qb.andWhere('l.plant = :plant', { plant });
    if (boxNo) qb.andWhere('l.boxNo LIKE :boxNo', { boxNo: `%${boxNo}%` });

    const rows = await qb.getRawMany<{
      boxNo: string;
      itemCode: string;
      qty: string | number;
      orderNo: string | null;
      latestAt: Date | null;
      receivedFlag: string | number | null;
      receivedAt: Date | null;
      warehouseCode: string | null;
    }>();

    // 품목명 일괄 보강 (N+1 방지)
    const itemCodes = [...new Set(rows.map((r) => r.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    return rows.map((r) => ({
      boxNo: r.boxNo,
      itemCode: r.itemCode,
      itemName: partMap.get(r.itemCode)?.itemName ?? null,
      qty: Number(r.qty) || 0,
      orderNo: r.orderNo ?? null,
      latestAt: r.latestAt ?? null,
      inventoryState: Number(r.receivedFlag) > 0 ? 'WAREHOUSE_RECEIVED' : 'PACKED_WAITING',
      warehouseCode: r.warehouseCode ?? null,
      receivedAt: r.receivedAt ?? null,
    }));
  }

  /**
   * 박스 내 재고 시리얼 목록 (오른쪽 그리드)
   * 선택 박스의 미출하 시리얼(FG_LABELS)을 반환한다.
   */
  async findStockSerials(boxNo: string, company?: string, plant?: string) {
    const qb = this.fgLabelRepository
      .createQueryBuilder('l')
      .select('l.fgBarcode', 'fgBarcode')
      .addSelect('l.itemCode', 'itemCode')
      .addSelect('l.orderNo', 'orderNo')
      .addSelect('l.equipCode', 'equipCode')
      .addSelect('l.workerId', 'workerId')
      .addSelect('l.lineCode', 'lineCode')
      .addSelect('l.status', 'status')
      .addSelect('l.inspectPassYn', 'inspectPassYn')
      .addSelect('l.issuedAt', 'issuedAt')
      .addSelect('MAX(CASE WHEN tx.transNo IS NOT NULL THEN 1 ELSE 0 END)', 'receivedFlag')
      .addSelect('MAX(tx.transDate)', 'receivedAt')
      .addSelect('MAX(COALESCE(tx.toWarehouseId, tx.fromWarehouseId))', 'warehouseCode')
      .leftJoin(
        ProductTransaction,
        'tx',
        [
          'tx.refType = :boxRefType',
          'tx.refId = l.boxNo',
          'tx.status = :doneStatus',
          'tx.transType IN (:...receiveTransTypes)',
          'tx.company = l.company',
          'tx.plant = l.plant',
        ].join(' AND '),
        {
          boxRefType: 'BOX',
          doneStatus: 'DONE',
          receiveTransTypes: ['WIP_OUT', 'FG_IN'],
        },
      )
      .where('l.boxNo = :boxNo', { boxNo })
      .andWhere("l.status <> 'SHIPPED'");
    if (company) qb.andWhere('l.company = :company', { company });
    if (plant) qb.andWhere('l.plant = :plant', { plant });
    qb
      .groupBy('l.fgBarcode')
      .addGroupBy('l.itemCode')
      .addGroupBy('l.orderNo')
      .addGroupBy('l.equipCode')
      .addGroupBy('l.workerId')
      .addGroupBy('l.lineCode')
      .addGroupBy('l.status')
      .addGroupBy('l.inspectPassYn')
      .addGroupBy('l.issuedAt')
      .orderBy('l.fgBarcode', 'ASC');

    const labels = await qb.getRawMany<{
      fgBarcode: string;
      itemCode: string;
      orderNo: string | null;
      equipCode: string | null;
      workerId: string | null;
      lineCode: string | null;
      status: string | null;
      inspectPassYn: string | null;
      issuedAt: Date | null;
      receivedFlag: string | number | null;
      receivedAt: Date | null;
      warehouseCode: string | null;
    }>();

    const itemCodes = [...new Set(labels.map((l) => l.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    return labels.map((label, index) => ({
      seq: index + 1,
      fgBarcode: label.fgBarcode,
      itemCode: label.itemCode,
      itemName: partMap.get(label.itemCode)?.itemName ?? null,
      orderNo: label.orderNo ?? null,
      equipCode: label.equipCode ?? null,
      workerId: label.workerId ?? null,
      lineCode: label.lineCode ?? null,
      status: label.status ?? null,
      inspectPassYn: label.inspectPassYn ?? null,
      issuedAt: label.issuedAt ?? null,
      inventoryState: Number(label.receivedFlag) > 0 ? 'WAREHOUSE_RECEIVED' : 'PACKED_WAITING',
      warehouseCode: label.warehouseCode ?? null,
      receivedAt: label.receivedAt ?? null,
    }));
  }

  async create(dto: CreateBoxDto, company?: string, plant?: string) {
    // 박스번호 미지정 시 자동 채번 (BX+YYMMDD+4자리, SEQ_BOX_NO_DAILY)
    const boxNo = dto.boxNo ?? await this.numbering.nextBoxNo();

    const existing = await this.boxRepository.findOne({
      where: { boxNo, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 박스번호입니다: ${boxNo}`);
    }

    const part = await this.partRepository.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!part) {
      throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);
    }

    if (dto.serialList && dto.serialList.length > 0) {
      await this.assertSerialsNotPackedElsewhere(dto.serialList, boxNo, company, plant);
    }

    const box = this.boxRepository.create({
      boxNo,
      itemCode: dto.itemCode,
      qty: dto.qty ?? 0,
      serialList: dto.serialList ? JSON.stringify(dto.serialList) : null,
      status: 'OPEN',
      oqcStatus: null,
      company: company || null,
      plant: plant || null,
    });

    return this.boxRepository.save(box);
  }

  async update(id: string, dto: UpdateBoxDto, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status === 'SHIPPED') {
      throw new BadRequestException('출하된 박스는 수정할 수 없습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `박스 상태(${dto.status})는 직접 변경할 수 없습니다. 포장/재오픈/적재/출하 전용 API를 사용해 주세요.`,
      );
    }

    if (dto.serialList && dto.serialList.length > 0) {
      await this.assertSerialsNotPackedElsewhere(dto.serialList, id, company, plant);
    }

    const updateData: Record<string, unknown> = {};
    if (dto.qty !== undefined) updateData.qty = dto.qty;
    if (dto.serialList !== undefined) updateData.serialList = JSON.stringify(dto.serialList);
    if (dto.palletId !== undefined) updateData.palletNo = dto.palletId;

    await this.boxRepository.update({ boxNo: id, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(id, company, plant);
  }

  async delete(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);

    if (box.status === 'SHIPPED') {
      throw new BadRequestException('출하된 박스는 삭제할 수 없습니다.');
    }
    if (box.status !== 'OPEN') {
      throw new BadRequestException(
        '포장된 박스는 직접 삭제할 수 없습니다. 박스 재오픈으로 먼저 정리해 주세요.',
      );
    }
    if (box.palletNo) {
      throw new BadRequestException('팔레트에 할당된 박스는 삭제할 수 없습니다.');
    }
    const serials = box.serialList ? JSON.parse(box.serialList) : [];
    if (serials.length > 0 || box.qty > 0) {
      throw new BadRequestException(
        '시리얼이 담긴 박스는 직접 삭제할 수 없습니다. 시리얼 제거 후 다시 삭제해 주세요.',
      );
    }
    if (box.oqcStatus) {
      throw new BadRequestException(
        'OQC 이력이 있는 박스는 직접 삭제할 수 없습니다. 박스/OQC를 먼저 정리해 주세요.',
      );
    }

    await this.boxRepository.delete({ boxNo: id, ...this.tenantWhere(company, plant) });
    return { id, deleted: true };
  }

  async addSerial(id: string, dto: AddSerialToBoxDto, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 시리얼을 추가할 수 없습니다.`);
    }

    const existingSerials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
    const duplicates = dto.serials.filter((serial) => existingSerials.includes(serial));
    if (duplicates.length > 0) {
      throw new ConflictException(`이미 존재하는 시리얼입니다: ${duplicates.join(', ')}`);
    }

    const lots = dto.serials.length > 0
      ? await this.lotRepository.find({ where: { matUid: In(dto.serials), ...this.tenantWhere(company, plant) } })
      : [];
    const lotMap = new Map(lots.map((lot) => [lot.matUid, lot] as const));
    for (const serial of dto.serials) {
      const lot = lotMap.get(serial);
      if (lot && lot.itemCode !== box.itemCode) {
        throw new BadRequestException(`시리얼 ${serial}은 박스 품목과 일치하지 않습니다.`);
      }
    }

    const part = await this.partRepository.findOne({
      where: { itemCode: box.itemCode, ...this.tenantWhere(company, plant) },
    });
    const fgLabels = dto.serials.length > 0
      ? await this.fgLabelRepository.find({ where: { fgBarcode: In(dto.serials), ...this.tenantWhere(company, plant) } })
      : [];
    const fgLabelMap = new Map(fgLabels.map((label) => [label.fgBarcode, label] as const));
    const invalidLabels = dto.serials.filter((serial) => {
      const label = fgLabelMap.get(serial);
      if (!label) return true;
      if (label.itemCode !== box.itemCode) return true;
      if (label.inspectPassYn !== 'Y') return true;
      // 외관검사 필수 — 외관검사 합격(VISUAL_PASS) 라벨만 포장할 수 있다(ISSUED=외관검사 미실시 차단).
      return label.status !== 'VISUAL_PASS';
    });
    if (invalidLabels.length > 0) {
      throw new BadRequestException(`외관검사 합격(VISUAL_PASS) FG만 포장할 수 있습니다: ${invalidLabels.join(', ')}`);
    }

    await this.assertSerialsNotPackedElsewhere(dto.serials, id, company, plant);

    const boxQty = part?.boxQty != null ? Number(part.boxQty) : 0;
    if (boxQty > 0 && existingSerials.length + dto.serials.length > boxQty) {
      throw new BadRequestException(`박스입수량(${boxQty})를 초과했습니다.`);
    }

    const newSerialList = [...existingSerials, ...dto.serials];
    await this.boxRepository.update(
      { boxNo: id, ...this.tenantWhere(company, plant) },
      {
        serialList: JSON.stringify(newSerialList),
        qty: newSerialList.length,
      },
    );

    return this.findById(id, company, plant);
  }

  async removeSerial(id: string, serials: string[], company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 시리얼을 제거할 수 없습니다.`);
    }

    const existingSerials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
    const notFound = serials.filter((serial) => !existingSerials.includes(serial));
    if (notFound.length > 0) {
      throw new NotFoundException(`존재하지 않는 시리얼입니다: ${notFound.join(', ')}`);
    }

    const newSerialList = existingSerials.filter((serial) => !serials.includes(serial));
    await this.boxRepository.update(
      { boxNo: id, ...this.tenantWhere(company, plant) },
      {
        serialList: JSON.stringify(newSerialList),
        qty: newSerialList.length,
      },
    );

    return this.findById(id, company, plant);
  }

  async closeBox(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);

    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 박스를 닫을 수 없습니다.`);
    }
    if (box.qty <= 0) {
      throw new BadRequestException('빈 박스는 닫을 수 없습니다.');
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { status: 'CLOSED', closeAt: new Date(), oqcStatus: 'PENDING' },
      );

      if (box.serialList) {
        try {
          const fgBarcodes: string[] = JSON.parse(box.serialList);
          if (fgBarcodes.length > 0) {
            const batchSize = 500;
            for (let i = 0; i < fgBarcodes.length; i += batchSize) {
              const batch = fgBarcodes.slice(i, i + batchSize);
              await queryRunner.manager.update(
                FgLabel,
                { fgBarcode: In(batch), ...this.tenantWhere(company, plant) },
                { status: 'PACKED', boxNo: id },
              );
            }
          }
        } catch {
          this.logger.warn(`박스 ${id} serialList 파싱 실패 - FG_LABEL 상태 업데이트 생략`);
        }
      }

      const requestNo = await this.nextOqcRequestNo();
      await queryRunner.manager.save(
        OqcRequest,
        queryRunner.manager.create(OqcRequest, {
          requestNo,
          itemCode: box.itemCode,
          customer: null,
          requestDate: new Date(),
          totalBoxCount: 1,
          totalQty: box.qty,
          sampleSize: null,
          status: 'PENDING',
          company: box.company,
          plant: box.plant,
          remark: `AUTO_CREATED_FROM_BOX:${box.boxNo}`,
        }),
      );
      await queryRunner.manager.save(
        OqcRequestBox,
        queryRunner.manager.create(OqcRequestBox, {
          requestNo,
          boxNo: box.boxNo,
          qty: box.qty,
          isSample: 'N',
          company: box.company,
          plant: box.plant,
        }),
      );
    });

    return this.findById(id, company, plant);
  }

  async reopenBox(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);

    if (box.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 박스를 다시 열 수 없습니다.`);
    }
    if (box.palletNo) {
      throw new BadRequestException('팔레트에 할당된 박스는 다시 열 수 없습니다.');
    }
    if (box.oqcStatus && box.oqcStatus !== 'PENDING') {
      throw new BadRequestException(
        `박스 ${box.boxNo} 는 OQC(${box.oqcStatus})가 이미 처리되어 다시 열 수 없습니다. ` +
          `OQC 단계부터 먼저 정리해 주세요.`,
      );
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { status: 'OPEN', closeAt: null, oqcStatus: null },
      );

      if (box.serialList) {
        try {
          const fgBarcodes: string[] = JSON.parse(box.serialList);
          if (fgBarcodes.length > 0) {
            const batchSize = 500;
            for (let i = 0; i < fgBarcodes.length; i += batchSize) {
              const batch = fgBarcodes.slice(i, i + batchSize);
              await queryRunner.manager.update(
                FgLabel,
                { fgBarcode: In(batch), status: 'PACKED', ...this.tenantWhere(company, plant) },
                { status: 'VISUAL_PASS' },
              );
            }
          }
        } catch {
          this.logger.warn(`박스 ${id} serialList 파싱 실패 - FG_LABEL 상태 복원 생략`);
        }
      }

      const requestBoxes = await queryRunner.manager.find(OqcRequestBox, {
        where: { boxNo: box.boxNo, ...this.tenantWhere(company, plant) },
      });
      const requestNos = requestBoxes.map((requestBox) => requestBox.requestNo);
      if (requestNos.length > 0) {
        const requests = await queryRunner.manager.find(OqcRequest, {
          where: { requestNo: In(requestNos), status: 'PENDING', ...this.tenantWhere(company, plant) },
        });
        const autoRequestNos = requests
          .filter((request) => request.remark === `AUTO_CREATED_FROM_BOX:${box.boxNo}`)
          .map((request) => request.requestNo);

        if (autoRequestNos.length > 0) {
          await queryRunner.manager.delete(OqcRequestBox, { requestNo: In(autoRequestNos), ...this.tenantWhere(company, plant) });
          await queryRunner.manager.delete(OqcRequest, { requestNo: In(autoRequestNos), ...this.tenantWhere(company, plant) });
        }
      }
    });

    return this.findById(id, company, plant);
  }

  async assignToPallet(id: string, dto: AssignBoxToPalletDto, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 팔레트에 할당할 수 없습니다.`);
    }
    if (box.palletNo && box.palletNo !== dto.palletId) {
      throw new BadRequestException('이미 다른 팔레트에 할당된 박스입니다.');
    }

    const pallet = await this.palletRepository.findOne({
      where: { palletNo: dto.palletId, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${dto.palletId}`);
    }
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`팔레트 상태(${pallet.status})가 OPEN이 아닙니다.`);
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { palletNo: dto.palletId },
      );

      const summaryQb = queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo: dto.palletId });
      if (company) summaryQb.andWhere('box.company = :company', { company });
      if (plant) summaryQb.andWhere('box.plant = :plant', { plant });
      const palletSummary = await summaryQb
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(PalletMaster, { palletNo: dto.palletId, ...this.tenantWhere(company, plant) }, {
        boxCount: parseInt(palletSummary.count) || 0,
        totalQty: parseInt(palletSummary.totalQty) || 0,
      });
    });

    return this.findById(id, company, plant);
  }

  async removeFromPallet(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (!box.palletNo) {
      throw new BadRequestException('팔레트에 할당되지 않은 박스입니다.');
    }

    const pallet = await this.palletRepository.findOne({
      where: { palletNo: box.palletNo, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) {
      throw new NotFoundException('팔레트를 찾을 수 없습니다.');
    }
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`팔레트 상태(${pallet.status})가 OPEN이 아닙니다.`);
    }

    const palletNo = box.palletNo;
    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { palletNo: null },
      );

      const summaryQb = queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo });
      if (company) summaryQb.andWhere('box.company = :company', { company });
      if (plant) summaryQb.andWhere('box.plant = :plant', { plant });
      const palletSummary = await summaryQb
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(PalletMaster, { palletNo, ...this.tenantWhere(company, plant) }, {
        boxCount: parseInt(palletSummary?.count) || 0,
        totalQty: parseInt(palletSummary?.totalQty) || 0,
      });
    });

    return this.findById(id, company, plant);
  }

  async findByPalletId(palletNo: string, company?: string, plant?: string) {
    return this.boxRepository.find({
      where: { palletNo, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'ASC' },
    });
  }

  async findByPartId(itemCode: string, status?: BoxStatus) {
    const where: Record<string, unknown> = {
      itemCode,
      ...(status && { status }),
    };

    return this.boxRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findUnassignedBoxes(company?: string, plant?: string) {
    return this.boxRepository.find({
      where: {
        palletNo: IsNull(),
        status: 'CLOSED',
        ...this.tenantWhere(company, plant),
      },
      order: { createdAt: 'ASC' },
    });
  }
}
