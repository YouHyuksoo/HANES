/** 수리 액션은 오더 잠금, 재고 수불, 검사 증거를 같은 트랜잭션에서 처리한다. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { repairStage, repairCompletionError } from '@harness/shared';
import { TransactionService } from '../../../shared/transaction.service';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { RepairTargetService } from './repair-target.service';
import { RepairStockService } from './repair-stock.service';
import { repairDay, repairDateOnly } from './repair-date';
import { StartRepairDto, CompleteRepairDto, InspectRepairDto } from '../dto/repair.dto';

@Injectable()
export class RepairWorkflowService {
  constructor(private readonly tx: TransactionService, private readonly stock: RepairStockService,
    private readonly seq: SeqGeneratorService, private readonly target: RepairTargetService) {}

  private async locked(qr: QueryRunner, date: string, seq: number, company: string, plant: string) {
    const order=await qr.manager.findOne(RepairOrder, {where:{repairDate:repairDay(date),seq,company,plant},lock:{mode:'pessimistic_write'}});
    if(!order) throw new NotFoundException('수리오더를 찾을 수 없습니다.');
    return order;
  }
  private key(order: RepairOrder) { return {repairDate:order.repairDate,seq:order.seq,company:order.company,plant:order.plant}; }
  private async worker(qr:QueryRunner,order:RepairOrder,workerCode?:string|null) {
    if(!workerCode || !await qr.manager.findOne(WorkerMaster,{where:{workerCode,company:order.company,plant:order.plant,useYn:'Y'}}))
      throw new BadRequestException('사용 중인 작업자를 선택하세요.');
  }
  private async returnProcess(qr:QueryRunner,order:RepairOrder) {
    if(order.disposition==='SCRAP') return;
    if(!order.returnProcess || !await qr.manager.findOne(ProcessMaster,{where:{processCode:order.returnProcess,company:order.company,plant:order.plant,useYn:'Y'}}))
      throw new BadRequestException('사용 중인 복귀 공정을 선택하세요.');
  }
  async start(date:string,seq:number,dto:StartRepairDto,company:string,plant:string) {
    return this.tx.run(async qr=>{
      const order=await this.locked(qr,date,seq,company,plant);
      if(repairStage(order)!=='received') throw new BadRequestException('접수 상태에서만 수리를 시작할 수 있습니다.');
      await this.worker(qr,order,order.workerId);
      await this.target.validateStartInTx(qr,order);
      await this.stock.startInTx(qr,order,dto.warehouseCode);
      await qr.manager.update(RepairOrder,this.key(order),{status:'IN_REPAIR',repairResult:'IN_PROGRESS',disposition:'PENDING',completedAt:null});
      return {repairDate:repairDateOnly(order.repairDate),seq,status:'IN_REPAIR'};
    });
  }
  async complete(date:string,seq:number,dto:CompleteRepairDto,company:string,plant:string) {
    return this.tx.run(async qr=>{
      const existing=await this.locked(qr,date,seq,company,plant);
      if(repairStage(existing)!=='repairing') throw new BadRequestException('수리중 상태에서만 수리완료를 처리할 수 있습니다.');
      const order={...existing,repairResult:dto.repairResult,disposition:dto.disposition,returnProcess:dto.returnProcess || existing.returnProcess};
      const error=repairCompletionError(order);
      if(error) {
        const messages={notRepairing:'수리중 상태에서만 완료할 수 있습니다.',workerRequired:'수리자를 선택하세요.',dispositionRequired:'재사용·재검후재사용·폐기 중 하나를 선택하세요.',resultRequired:'수리 완료 결과를 선택하세요. 수리불가는 폐기만 가능합니다.',returnProcessRequired:'복귀 공정을 선택하세요.'};
        throw new BadRequestException(messages[error]);
      }
      await this.worker(qr,order,order.workerId);
      await this.returnProcess(qr,order);
      await this.stock.assertStartedInTx(qr,order);
      const pending=order.disposition==='REINSPECT';
      if(!pending) {
        await this.stock.finishInTx(qr,order,dto.returnWarehouseCode,dto.materialAllocations ?? []);
        await this.target.finishLabelInTx(qr,order,false);
      }
      await qr.manager.update(RepairOrder,this.key(order),{
        repairResult:order.repairResult,disposition:order.disposition,returnProcess:order.returnProcess,
        status:pending?'IN_REPAIR':'COMPLETED',completedAt:pending?null:new Date(),
      });
      return {repairDate:repairDateOnly(order.repairDate),seq,status:pending?'IN_REPAIR':'COMPLETED',inspectionPending:pending};
    });
  }
  async inspect(date:string,seq:number,dto:InspectRepairDto,company:string,plant:string) {
    return this.tx.run(async qr=>{
      const order=await this.locked(qr,date,seq,company,plant);
      if(repairStage(order)!=='inspection') throw new BadRequestException('재검사 대기 중인 수리만 판정할 수 있습니다.');
      if(!['PASS','FAIL'].includes(dto.result)) throw new BadRequestException('검사 판정이 올바르지 않습니다.');
      await this.worker(qr,order,dto.workerId);
      const pass=dto.result==='PASS';
      if(pass) {
        await this.returnProcess(qr,order);
        await this.stock.finishInTx(qr,order,dto.returnWarehouseCode,dto.materialAllocations ?? []);
        await this.target.finishLabelInTx(qr,order,true);
      }
      const resultNo=await this.seq.getNo('INSPECT_RESULT',qr);
      // 기존 검사 상세 JSON에 수리오더 참조와 전량 판정 근거를 기록한다.
      await qr.manager.save(InspectResult,qr.manager.create(InspectResult,{
        resultNo,serialNo:order.prdUid,fgBarcode:order.fgBarcode?.length<=30?order.fgBarcode:null,
        inspectScope:'FULL',passYn:pass?'Y':'N',inspectAt:new Date(),inspectorId:dto.workerId,
        inspectData:JSON.stringify({repairRef:String(seq),repairDate:repairDateOnly(order.repairDate),qty:order.qty,result:dto.result,remark:dto.remark ?? ''}),
        company,plant,
      }));
      if(pass && order.fgBarcode) await qr.manager.update(FgLabel,{fgBarcode:order.fgBarcode,company,plant},{inspectResultId:resultNo});
      await qr.manager.update(RepairOrder,this.key(order),pass
        ?{status:'COMPLETED',completedAt:new Date()}
        :{status:'IN_REPAIR',repairResult:'IN_PROGRESS',disposition:'PENDING',completedAt:null});
      return {repairDate:repairDateOnly(order.repairDate),seq,resultNo,status:pass?'COMPLETED':'IN_REPAIR'};
    });
  }
}
