import { createMock } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { RepairWorkflowService } from './repair-workflow.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { RepairTargetService } from './repair-target.service';
import { RepairStockService } from './repair-stock.service';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';

describe('RepairWorkflowService', () => {
  const make = (status='RECEIVED', extra={}) => {
    const qr=createMock<QueryRunner>();
    const tx=createMock<TransactionService>();
    const stock=createMock<RepairStockService>();
    const seq=createMock<SeqGeneratorService>();
    const order={repairDate:new Date(2026,8,5,13),seq:9,company:'40',plant:'1000',status,qty:2,itemCode:'FG1',workerId:'W1',...extra};
    qr.manager.findOne.mockImplementation(async (entity:any) => entity===RepairOrder ? order : entity===WorkerMaster || entity===ProcessMaster ? {useYn:'Y'} : null);
    qr.manager.create.mockImplementation((_:any,data:any)=>data);
    tx.run.mockImplementation(async fn=>fn(qr));
    seq.getNo.mockResolvedValue('IR1');
    return {service:new RepairWorkflowService(tx,stock,seq,createMock<RepairTargetService>()),qr,stock,order};
  };
  it('starts with inventory and updates status in the same locked transaction',async()=>{
    const {service,qr,stock}=make();
    await service.start('2026-09-05',9,{warehouseCode:'FG_WIP'},'40','1000');
    expect(qr.manager.findOne).toHaveBeenCalledWith(RepairOrder,expect.objectContaining({lock:{mode:'pessimistic_write'}}));
    expect(stock.startInTx).toHaveBeenCalledWith(qr,expect.objectContaining({seq:9}),'FG_WIP');
    expect(qr.manager.update).toHaveBeenCalledWith(RepairOrder,expect.anything(),expect.objectContaining({status:'IN_REPAIR'}));
  });
  it('blocks double start and terminal edits',async()=>{
    const {service,stock}=make('IN_REPAIR');
    await expect(service.start('2026-09-05',9,{warehouseCode:'FG_WIP'},'40','1000')).rejects.toThrow();
    expect(stock.startInTx).not.toHaveBeenCalled();
  });
  it('does not update status when stock withdrawal fails',async()=>{
    const {service,stock,qr}=make();stock.startInTx.mockRejectedValue(new Error('shortage'));
    await expect(service.start('2026-09-05',9,{warehouseCode:'FG_WIP'},'40','1000')).rejects.toThrow('shortage');
    expect(qr.manager.update).not.toHaveBeenCalled();
  });
  it('keeps reinspection pending without returning GOOD stock',async()=>{
    const {service,stock,qr}=make('IN_REPAIR',{repairResult:'IN_PROGRESS'});
    await service.complete('2026-09-05',9,{repairResult:'COMPLETED',disposition:'REINSPECT',returnProcess:'P1'},'40','1000');
    expect(stock.finishInTx).not.toHaveBeenCalled();
    expect(qr.manager.update).toHaveBeenCalledWith(RepairOrder,expect.anything(),expect.objectContaining({status:'IN_REPAIR',disposition:'REINSPECT'}));
  });
  it('FAIL records inspection and returns to repair without stock movement',async()=>{
    const {service,stock,qr}=make('IN_REPAIR',{repairResult:'COMPLETED',disposition:'REINSPECT'});
    await service.inspect('2026-09-05',9,{result:'FAIL',workerId:'W1',remark:'재수리'},'40','1000');
    expect(stock.finishInTx).not.toHaveBeenCalled();
    expect(qr.manager.save).toHaveBeenCalledWith(InspectResult,expect.objectContaining({passYn:'N'}));
    expect(qr.manager.update).toHaveBeenCalledWith(RepairOrder,expect.anything(),expect.objectContaining({repairResult:'IN_PROGRESS',disposition:'PENDING'}));
  });
  it('PASS finishes only after material and product stock have succeeded',async()=>{
    const {service,stock,qr}=make('IN_REPAIR',{repairResult:'COMPLETED',disposition:'REINSPECT',returnProcess:'P1'});
    stock.finishInTx.mockRejectedValue(new Error('material shortage'));
    await expect(service.inspect('2026-09-05',9,{result:'PASS',workerId:'W1',returnWarehouseCode:'FG_WIP'},'40','1000')).rejects.toThrow('material shortage');
    expect(qr.manager.update).not.toHaveBeenCalled();
    expect(qr.manager.save).not.toHaveBeenCalled();
  });
});
