import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DefectCategoryMaster } from '../../../../entities/defect-category-master.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
import { DefectCodeProductType } from '../../../../entities/defect-code-product-type.entity';
import {
  CreateDefectCategoryDto,
  CreateDefectCodeDto,
  DefectCodeQueryDto,
  UpdateDefectCategoryDto,
  UpdateDefectCodeDto,
} from '../dto/defect-code.dto';
import { TransactionService } from '../../../../shared/transaction.service';

type CategoryNode = DefectCategoryMaster & { children: CategoryNode[] };
type CodeWithProducts = DefectCodeMaster & { productTypes: string[] };

@Injectable()
export class DefectCodeService {
  constructor(
    @InjectRepository(DefectCategoryMaster)
    private readonly categoryRepository: Repository<DefectCategoryMaster>,
    @InjectRepository(DefectCodeMaster)
    private readonly codeRepository: Repository<DefectCodeMaster>,
    @InjectRepository(DefectCodeProductType)
    private readonly productTypeRepository: Repository<DefectCodeProductType>,
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company: string, plant: string) {
    return { company, plant };
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private async findCategoryOrThrow(rawCategoryCode: string, company: string, plant: string) {
    const categoryCode = this.normalizeCode(rawCategoryCode);
    const category = await this.categoryRepository.findOne({
      where: { categoryCode, ...this.tenantWhere(company, plant) },
    });
    if (!category) {
      throw new NotFoundException(`불량 분류를 찾을 수 없습니다: ${categoryCode}`);
    }
    return category;
  }

  private async assertValidParent(dto: CreateDefectCategoryDto | UpdateDefectCategoryDto, company: string, plant: string) {
    if (dto.levelNo === 1 && dto.parentCategoryCode) {
      throw new BadRequestException('1레벨 분류는 상위 분류를 가질 수 없습니다.');
    }
    if ((dto.levelNo ?? 1) > 1 && !dto.parentCategoryCode) {
      throw new BadRequestException('2/3레벨 분류는 상위 분류가 필요합니다.');
    }
    if (!dto.parentCategoryCode) return;

    const parent = await this.findCategoryOrThrow(dto.parentCategoryCode, company, plant);
    if (dto.levelNo && parent.levelNo !== dto.levelNo - 1) {
      throw new BadRequestException('상위 분류 레벨이 현재 분류와 맞지 않습니다.');
    }
  }

  private async assertLeafCategory(categoryCode: string, company: string, plant: string) {
    const category = await this.findCategoryOrThrow(categoryCode, company, plant);
    if (category.useYn !== 'Y') {
      throw new BadRequestException('사용중인 불량 분류만 연결할 수 있습니다.');
    }
    if (category.levelNo !== 3) {
      throw new BadRequestException('불량코드는 3레벨 분류에만 연결할 수 있습니다.');
    }
    return category;
  }

  /** 모델구분이 공통코드(DEFECT_MODEL_GROUP, 사용 중)에 있는지 확인한다(화면은 공통코드 선택) */
  private async assertProductTypes(productTypes: string[], company: string, plant: string): Promise<void> {
    for (const productType of productTypes) {
      const rows: Array<{ cnt: number | string }> = await this.dataSource.query(
        `SELECT COUNT(*) AS "cnt" FROM COM_CODES
          WHERE GROUP_CODE = :1 AND DETAIL_CODE = :2 AND USE_YN = 'Y' AND COMPANY = :3 AND PLANT_CD = :4`,
        ['DEFECT_MODEL_GROUP', productType, company, plant],
      );
      if (Number(rows[0]?.cnt ?? 0) === 0) {
        throw new BadRequestException(`모델구분 값이 공통코드(DEFECT_MODEL_GROUP)에 없습니다: ${productType}`);
      }
    }
  }

  private normalizeProductTypes(productTypes: string[]): string[] {
    return [...new Set(productTypes.map((value) => this.normalizeCode(value)).filter(Boolean))];
  }

  private async loadProductTypes(defectCodes: string[], company: string, plant: string) {
    if (!defectCodes.length) return new Map<string, string[]>();
    const mappings = await this.productTypeRepository.find({ where: { ...this.tenantWhere(company, plant) } });
    const codeSet = new Set(defectCodes);
    const map = new Map<string, string[]>();
    for (const mapping of mappings) {
      if (!codeSet.has(mapping.defectCode)) continue;
      const values = map.get(mapping.defectCode) ?? [];
      values.push(mapping.productType);
      map.set(mapping.defectCode, values);
    }
    return map;
  }

  async findCategoryTree(company: string, plant: string) {
    const categories = await this.categoryRepository.find({
      where: this.tenantWhere(company, plant),
      order: { levelNo: 'ASC', sortOrder: 'ASC', categoryCode: 'ASC' },
    });
    const nodeMap = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodeMap.set(category.categoryCode, { ...category, children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentCategoryCode && nodeMap.has(node.parentCategoryCode)) {
        nodeMap.get(node.parentCategoryCode)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async createCategory(dto: CreateDefectCategoryDto, company: string, plant: string, userId: string) {
    const categoryCode = this.normalizeCode(dto.categoryCode);
    const existing = await this.categoryRepository.findOne({
      where: { categoryCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 불량 분류입니다: ${categoryCode}`);
    }
    await this.assertValidParent({ ...dto, categoryCode }, company, plant);
    return this.categoryRepository.save(this.categoryRepository.create({
      categoryCode,
      categoryName: dto.categoryName.trim(),
      levelNo: dto.levelNo,
      parentCategoryCode: dto.parentCategoryCode ? this.normalizeCode(dto.parentCategoryCode) : null,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
      description: dto.description ?? null,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    }));
  }

  async updateCategory(categoryCode: string, dto: UpdateDefectCategoryDto, company: string, plant: string, userId: string) {
    const current = await this.findCategoryOrThrow(categoryCode, company, plant);
    // null 로 온 값은 비울 수 없는 칸(이름·레벨·정렬·사용여부)이라 그대로 두고, 상위 분류·설명만 비울 수 있다
    const next = {
      ...current,
      categoryName: dto.categoryName ?? current.categoryName,
      levelNo: dto.levelNo ?? current.levelNo,
      sortOrder: dto.sortOrder ?? current.sortOrder,
      useYn: dto.useYn ?? current.useYn,
      description: dto.description === undefined ? current.description : dto.description,
      categoryCode: current.categoryCode,
      parentCategoryCode: dto.parentCategoryCode === undefined
        ? current.parentCategoryCode
        : dto.parentCategoryCode ? this.normalizeCode(dto.parentCategoryCode) : null,
      updatedBy: userId,
    };
    await this.assertValidParent(next, company, plant);
    if (next.parentCategoryCode === current.categoryCode) {
      throw new BadRequestException('자기 자신을 상위 분류로 지정할 수 없습니다.');
    }
    if (next.levelNo !== current.levelNo) {
      const children = await this.categoryRepository.count({
        where: { parentCategoryCode: current.categoryCode, ...this.tenantWhere(company, plant) },
      });
      if (children > 0) {
        throw new BadRequestException('하위 분류가 있어 레벨을 바꿀 수 없습니다.');
      }
      if (next.levelNo !== 3) {
        const linkedCodes = await this.codeRepository.count({
          where: { categoryCode: current.categoryCode, ...this.tenantWhere(company, plant) },
        });
        if (linkedCodes > 0) {
          throw new BadRequestException('불량코드가 연결되어 있어 3레벨이 아닌 값으로 바꿀 수 없습니다.');
        }
      }
    }
    return this.categoryRepository.save(next);
  }

  async createCode(dto: CreateDefectCodeDto, company: string, plant: string, userId: string): Promise<CodeWithProducts> {
    const defectCode = this.normalizeCode(dto.defectCode);
    const existing = await this.codeRepository.findOne({
      where: { defectCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 불량코드입니다: ${defectCode}`);
    }
    await this.assertLeafCategory(dto.categoryCode, company, plant);
    const productTypes = this.normalizeProductTypes(dto.productTypes ?? []);
    await this.assertProductTypes(productTypes, company, plant);

    // 코드와 모델구분 매핑은 한 트랜잭션(중간에 실패하면 매핑만 사라지거나 코드만 남던 것)
    return this.tx.run(async (qr) => {
      const codeRepository = qr.manager.getRepository(DefectCodeMaster);
      const saved = await codeRepository.save(codeRepository.create({
        defectCode,
        defectName: dto.defectName.trim(),
        categoryCode: this.normalizeCode(dto.categoryCode),
        defectGrade: dto.defectGrade,
        defectScope: dto.defectScope,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
        useYn: dto.useYn ?? 'Y',
        company,
        plant,
        createdBy: userId,
        updatedBy: userId,
      }));
      await this.replaceProductTypes(qr.manager, defectCode, productTypes, company, plant, userId);
      return { ...saved, productTypes };
    });
  }

  async updateCode(defectCodeParam: string, dto: UpdateDefectCodeDto, company: string, plant: string, userId: string): Promise<CodeWithProducts> {
    const defectCode = this.normalizeCode(defectCodeParam);
    const current = await this.codeRepository.findOne({
      where: { defectCode, ...this.tenantWhere(company, plant) },
    });
    if (!current) {
      throw new NotFoundException(`불량코드를 찾을 수 없습니다: ${defectCode}`);
    }
    if (dto.categoryCode) {
      await this.assertLeafCategory(dto.categoryCode, company, plant);
    }
    // productTypes 가 배열로 오면 매핑을 교체하고, 빠졌거나 null 이면 그대로 둔다
    const nextTypes = Array.isArray(dto.productTypes) ? this.normalizeProductTypes(dto.productTypes) : undefined;
    if (nextTypes) {
      await this.assertProductTypes(nextTypes, company, plant);
    }

    return this.tx.run(async (qr) => {
      const saved = await qr.manager.getRepository(DefectCodeMaster).save({
        ...current,
        defectName: dto.defectName ?? current.defectName,
        categoryCode: dto.categoryCode ? this.normalizeCode(dto.categoryCode) : current.categoryCode,
        defectGrade: dto.defectGrade ?? current.defectGrade,
        defectScope: dto.defectScope ?? current.defectScope,
        description: dto.description === undefined ? current.description : dto.description,
        sortOrder: dto.sortOrder ?? current.sortOrder,
        useYn: dto.useYn ?? current.useYn,
        updatedBy: userId,
      });
      const productTypes = nextTypes === undefined
        ? (await this.loadProductTypes([defectCode], company, plant)).get(defectCode) ?? []
        : await this.replaceProductTypes(qr.manager, defectCode, nextTypes, company, plant, userId);
      return { ...saved, productTypes };
    });
  }

  async disableCode(defectCodeParam: string, company: string, plant: string, userId: string) {
    return this.updateCode(defectCodeParam, { useYn: 'N' }, company, plant, userId);
  }

  async findAll(query: DefectCodeQueryDto, company: string, plant: string) {
    const { page = 1, limit = 20 } = query;
    let rows = await this.codeRepository.find({
      where: { ...this.tenantWhere(company, plant) },
      order: { sortOrder: 'ASC', defectCode: 'ASC' },
    });
    const productMap = await this.loadProductTypes(rows.map((row) => row.defectCode), company, plant);

    rows = rows.filter((row) => {
      if (query.useYn && row.useYn !== query.useYn) return false;
      if (query.categoryCode && row.categoryCode !== query.categoryCode) return false;
      if (query.defectGrade && row.defectGrade !== query.defectGrade) return false;
      if (query.defectScope && row.defectScope !== query.defectScope) return false;
      if (query.productType) {
        const mapped = productMap.get(row.defectCode) ?? [];
        if (!mapped.includes(query.productType)) return false;
      }
      if (query.search) {
        const keyword = query.search.toUpperCase();
        return row.defectCode.includes(keyword) || row.defectName.toUpperCase().includes(keyword);
      }
      return true;
    });

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit).map((row) => ({
      ...row,
      productTypes: productMap.get(row.defectCode) ?? [],
    }));
    return { data, total, page, limit };
  }

  async findOptions(query: Pick<DefectCodeQueryDto, 'productType' | 'defectScope'>, company: string, plant: string) {
    const rows = await this.codeRepository.find({
      where: { ...this.tenantWhere(company, plant), useYn: 'Y' },
      order: { sortOrder: 'ASC', defectCode: 'ASC' },
    });
    const productMap = await this.loadProductTypes(rows.map((row) => row.defectCode), company, plant);
    return rows
      .filter((row) => !query.defectScope || row.defectScope === query.defectScope || row.defectScope === 'COMMON')
      .filter((row) => {
        if (!query.productType) return true;
        const mapped = productMap.get(row.defectCode) ?? [];
        return mapped.includes(query.productType);
      })
      .map((row) => ({
        defectCode: row.defectCode,
        defectName: row.defectName,
        categoryCode: row.categoryCode,
        defectGrade: row.defectGrade,
        defectScope: row.defectScope,
        productTypes: productMap.get(row.defectCode) ?? [],
      }));
  }

  private async replaceProductTypes(manager: EntityManager, defectCode: string, productTypes: string[], company: string, plant: string, userId: string) {
    const repository = manager.getRepository(DefectCodeProductType);
    await repository.delete({ defectCode, ...this.tenantWhere(company, plant) });
    if (!productTypes.length) return [];
    await repository.save(productTypes.map((productType) => repository.create({
      defectCode,
      productType,
      company,
      plant,
      createdBy: userId,
    })));
    return productTypes;
  }
}
