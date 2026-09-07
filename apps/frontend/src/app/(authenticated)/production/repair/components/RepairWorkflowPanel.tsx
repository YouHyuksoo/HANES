"use client";
/** 상태별 다음 액션. 폼의 미저장 값으로 재고를 처리하지 않는다. */
import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {repairStage} from '@harness/shared';
import {Button,Input,Select,ConfirmModal} from '@/components/ui';
import {ComCodeSelect,ProcessSelect,WarehouseSelect,WorkerSelect} from '@/components/shared';
import api from '@/services/api';
import type {RepairOrderData} from './RepairFormModal';
import RepairMaterialAllocation,{type MaterialAllocation} from './RepairMaterialAllocation';
import {useRepairText} from '../repairText';
interface Props {order:RepairOrderData;dirty:boolean;onDone:()=>Promise<void>}
export default function RepairWorkflowPanel({order,dirty,onDone}:Props) {
  const {t}=useTranslation();const text=useRepairText();const stage=repairStage(order);
  const [source,setSource]=useState('');const [destination,setDestination]=useState('');
  const [process,setProcess]=useState(order.returnProcess??'');
  const [result,setResult]=useState('COMPLETED');const [disposition,setDisposition]=useState('REUSE');
  const [judgment,setJudgment]=useState('PASS');const [inspector,setInspector]=useState('');const [remark,setRemark]=useState('');
  const [allocations,setAllocations]=useState<MaterialAllocation[]>([]);
  const [sources,setSources]=useState<{warehouseCode:string;availableQty:number}[]>([]);
  const [history,setHistory]=useState<{resultNo:string;passYn:string;inspectAt:string;inspectorId:string}[]>([]);
  const [saving,setSaving]=useState(false);const [confirm,setConfirm]=useState(false);const [error,setError]=useState('');
  const base=`/production/repairs/${order.repairDate}/${order.seq}`;
  useEffect(()=>setProcess(order.returnProcess??''),[order.returnProcess]);
  useEffect(()=>{
    let active=true;
    if(stage==='received') api.get('/production/repairs/stock-options',{params:{itemCode:order.itemCode,barcode:order.fgBarcode||undefined}}).then(r=>{if(active)setSources(r.data.data??[]);}).catch(()=>{if(active)setError(text.failed);});
    api.get(`${base}/inspections`).then(r=>{if(active)setHistory(r.data.data??[]);}).catch(()=>{if(active)setError(text.failed);});
    return ()=>{active=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[base,stage,order.itemCode]);
  const terminal=(stage==='repairing'&&disposition!=='REINSPECT')||(stage==='inspection'&&judgment==='PASS');
  const needsDestination=terminal&&!(stage==='repairing'&&disposition==='SCRAP');
  const disabled=dirty||saving||stage==='unknown';
  const run=async()=>{
    setSaving(true);setError('');setConfirm(false);
    try {
      if(stage==='received')await api.post(`${base}/start`,{warehouseCode:source});
      else if(stage==='repairing')await api.post(`${base}/complete`,{repairResult:result,disposition,returnProcess:process,returnWarehouseCode:destination||undefined,materialAllocations:allocations});
      else if(stage==='inspection')await api.post(`${base}/inspect`,{result:judgment,workerId:inspector,remark,returnWarehouseCode:destination||undefined,materialAllocations:allocations});
      await onDone();
    } catch(err:unknown){const response=(err as {response?:{data?:{message?:string|string[]}}}).response;setError(String(response?.data?.message??text.failed));}
    finally{setSaving(false);}
  };
  return <section className="space-y-3 border-t border-border pt-4">
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {dirty&&<p className="text-sm text-text-muted">{text.saveFirst}</p>}
    {stage==='completed'?<p className="text-sm">{text.readOnly}</p>:<>
      <h4 className="font-semibold">{stage==='received'?text.start:stage==='inspection'?text.pending:text.finish}</h4>
      <p className="text-sm text-text-muted">{stage==='received'?text.startHelp:stage==='inspection'?text.inspectHelp:text.completeHelp}</p>
      <fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
        {stage==='received'&&<Select fullWidth label={text.warehouse} value={source} onChange={setSource}
          options={[{value:'',label:text.selectWarehouse},...sources.map(s=>({value:s.warehouseCode,label:`${s.warehouseCode} (${s.availableQty})`}))]}/>}
        {stage==='received'&&!sources.length&&<p className="text-sm">{text.noStock}</p>}
        {stage==='repairing'&&<>
          <ComCodeSelect groupCode="REPAIR_RESULT" label={t('production.repair.repairResult')} value={result} onChange={setResult} includeAll={false} fullWidth/>
          <ComCodeSelect groupCode="REPAIR_DISPOSITION" label={t('production.repair.disposition')} value={disposition} onChange={setDisposition} includeAll={false} fullWidth/>
          {disposition!=='SCRAP'&&<ProcessSelect id="repair-return-process" label={t('production.repair.returnProcess')} value={process} onChange={setProcess} fullWidth/>}
        </>}
        {stage==='inspection'&&<>
          <Select label={text.inspect} value={judgment} onChange={setJudgment} options={[{value:'PASS',label:text.pass},{value:'FAIL',label:text.fail}]} fullWidth/>
          <WorkerSelect id="repair-inspector" label={t('production.repair.worker')} value={inspector} onChange={setInspector} fullWidth/>
          <Input id="repair-inspection-remark" label={t('production.repair.remark')} value={remark} onChange={e=>setRemark(e.target.value)} fullWidth/>
        </>}
        {needsDestination&&<WarehouseSelect label={text.returnWarehouse} value={destination} onChange={setDestination} fullWidth/>}
      </fieldset>
      {terminal&&<RepairMaterialAllocation parts={order.usedParts??[]} value={allocations} onChange={setAllocations} disabled={disabled}/>}
      <div className="flex justify-end"><Button disabled={disabled||(stage==='received'&&!source)||(needsDestination&&!destination)||(stage==='inspection'&&!inspector)} onClick={()=>setConfirm(true)}>
        {stage==='received'?text.start:stage==='inspection'?text.inspect:text.finish}
      </Button></div>
    </>}
    {!!history.length&&<div className="text-sm space-y-1"><h4 className="font-semibold">{text.history}</h4>{history.map(h=><p key={h.resultNo}>{h.inspectAt} · {h.inspectorId} · {h.passYn==='Y'?text.pass:text.fail}</p>)}</div>}
    <ConfirmModal isOpen={confirm} onClose={()=>setConfirm(false)} onConfirm={run} title={stage==='inspection'?text.inspect:stage==='received'?text.start:text.finish} message={text.actionConfirm}/>
  </section>;
}
