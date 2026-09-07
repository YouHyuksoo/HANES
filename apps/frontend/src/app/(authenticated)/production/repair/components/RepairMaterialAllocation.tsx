"use client";
/** 저장된 사용부품 수량을 실제 원자재 LOT에 배분한다. PRD_UID와 MAT_UID를 혼용하지 않는다. */
import {useEffect,useState} from 'react';
import {Button,Select} from '@/components/ui';
import {QtyInput} from '@/components/shared';
import api from '@/services/api';
import {useRepairText} from '../repairText';
export interface MaterialAllocation {itemCode:string;matUid:string;warehouseCode:string;qty:number}
interface StockOption {itemCode:string;matUid:string;warehouseCode:string;availableQty:number}
interface Props {parts:{itemCode:string;qty:number}[];value:MaterialAllocation[];onChange:(rows:MaterialAllocation[])=>void;disabled?:boolean}
export default function RepairMaterialAllocation({parts,value,onChange,disabled}:Props) {
  const text=useRepairText();
  const [stocks,setStocks]=useState<Record<string,StockOption[]>>({});
  const [error,setError]=useState('');
  const key=parts.map(p=>p.itemCode).join('|');
  useEffect(()=>{
    let active=true;
    setStocks({});setError('');
    Promise.all(parts.map(async p=>[p.itemCode,(await api.get('/production/repairs/material-options',{params:{itemCode:p.itemCode}})).data.data] as const))
      .then(rows=>{if(active)setStocks(Object.fromEntries(rows));})
      .catch(()=>{if(active)setError(text.failed);});
    return ()=>{active=false;};
  // 품목 목록이 바뀔 때만 후보 재조회
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  if(!parts.length)return null;
  return <div className="space-y-2">
    <h4 className="font-semibold text-sm">{text.lot}</h4>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {parts.map(part=><div key={part.itemCode} className="space-y-2 border-b border-border pb-2">
      <div className="flex justify-between text-sm"><span>{part.itemCode} · {part.qty}</span>
        <Button size="sm" variant="outline" disabled={disabled} onClick={()=>onChange([...value,{itemCode:part.itemCode,qty:part.qty,matUid:'',warehouseCode:''}])}>{text.addLot}</Button></div>
      {value.map((row,index)=>row.itemCode!==part.itemCode?null:<div key={index} className="flex gap-2 items-center">
        <Select fullWidth value={row.matUid?JSON.stringify([row.warehouseCode,row.matUid]):''} disabled={disabled}
          options={[{value:'',label:text.selectLot},...(stocks[part.itemCode]??[]).map(s=>({value:JSON.stringify([s.warehouseCode,s.matUid]),label:`${s.warehouseCode} / ${s.matUid} (${s.availableQty})`}))]}
          onChange={v=>{const [warehouseCode,matUid]=v?JSON.parse(v):['',''];onChange(value.map((r,i)=>i===index?{...r,warehouseCode,matUid}:r));}}/>
        <QtyInput className="w-24" value={row.qty} onChange={qty=>onChange(value.map((r,i)=>i===index?{...r,qty}:r))} disabled={disabled}/>
        <Button size="sm" variant="outline" disabled={disabled} aria-label="Remove LOT" onClick={()=>onChange(value.filter((_,i)=>i!==index))}>×</Button>
      </div>)}
    </div>)}
  </div>;
}
