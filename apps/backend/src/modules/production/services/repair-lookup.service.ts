/** 수리 폼의 제품 스캔, 불량 창고/사용부품 LOT 후보 및 검사 이력 조회. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, MoreThan } from 'typeorm';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { RepairService } from './repair.service';
@Injectable()
export class RepairLookupService {
  constructor(private readonly db:DataSource,private readonly repairs:RepairService) {}
  async barcode(barcode:string,company:string,plant:string) {
    if(!barcode?.trim()) throw new BadRequestException('제품 바코드를 스캔하세요.');
    const label=await this.db.manager.findOne(FgLabel,{where:{fgBarcode:barcode.trim(),company,plant}});
    if(!label) throw new NotFoundException('완제품 라벨을 찾을 수 없습니다. 품목 단위 수리는 바코드를 비우고 품목을 선택하세요.');
    if(label.status!=='VISUAL_FAIL' || label.boxNo || label.replacedBy) throw new BadRequestException('포장되지 않은 외관불합격 제품만 수리할 수 있습니다.');
    const item=await this.db.manager.findOne(ItemMaster,{where:{itemCode:label.itemCode,company,plant,useYn:'Y'}});
    if(!item) throw new NotFoundException('사용 중인 품목을 찾을 수 없습니다.');
    return {fgBarcode:label.fgBarcode,prdUid:label.fgBarcode,itemCode:item.itemCode,itemName:item.itemName,qty:1};
  }
  async stock(itemCode:string,company:string,plant:string,barcode?:string) {
    if(!itemCode?.trim()) throw new BadRequestException('품목을 지정하세요.');
    if(barcode) { const target=await this.barcode(barcode,company,plant);if(target.itemCode!==itemCode)throw new BadRequestException('바코드 품목이 일치하지 않습니다.'); }
    return this.db.manager.find(ProductStock,{where:{itemCode,company,plant,qualityStatus:barcode?'GOOD':'DEFECT',availableQty:MoreThan(0)},order:{warehouseCode:'ASC'}});
  }
  async materials(itemCode:string,company:string,plant:string) {
    if(!itemCode?.trim()) throw new BadRequestException('부품을 지정하세요.');
    return this.db.manager.find(MatStock,{where:{itemCode,company,plant,availableQty:MoreThan(0)},order:{warehouseCode:'ASC',matUid:'ASC'}});
  }
  async inspections(date:string,seq:number,company:string,plant:string) {
    await this.repairs.findOne(date,seq,company,plant);
    return this.db.getRepository(InspectResult).createQueryBuilder('i')
      .where('i.COMPANY = :company AND i.PLANT_CD = :plant',{company,plant})
      .andWhere("JSON_VALUE(i.INSPECT_DATA, '$.repairRef') = :ref",{ref:String(seq)})
      .orderBy('i.INSPECT_TIME','ASC').getMany();
  }
}
