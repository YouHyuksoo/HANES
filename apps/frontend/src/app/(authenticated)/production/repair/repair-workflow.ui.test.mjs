/** 실제 3002 렌더+조작 테스트. 모든 /api 요청은 모의 응답이며 실제 DB 검증이 아니다.
 * 실행: node --test <이 파일>. 정상 실행 중인 localhost:3002가 필요하다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const runScenario = async page => {
  const order={repairDate:'2026-09-05',seq:99991,status:'RECEIVED',itemCode:'UI-REPAIR-FG',itemName:'수리 화면 테스트',qty:1,fgBarcode:null,prdUid:null,sourceProcess:'P1',returnProcess:'P1',repairResult:null,genuineType:null,defectType:null,defectCause:null,defectPosition:null,disposition:null,workerId:'W1',remark:null,usedParts:[]};
  const user={id:'repair-ui-fixture',email:'fixture@example.invalid',name:'UI fixture',role:'ADMIN',status:'ACTIVE',company:'40',plant:'1000',allowedMenus:[]};
  const codes={REPAIR_STATUS:[['RECEIVED','입고'],['IN_REPAIR','수리중'],['COMPLETED','완료']],REPAIR_RESULT:[['COMPLETED','수리완료'],['IMPOSSIBLE','수리불가'],['IN_PROGRESS','수리중']],REPAIR_DISPOSITION:[['REUSE','재사용'],['REINSPECT','재검후재사용'],['SCRAP','폐기'],['PENDING','판정대기']]};
  const calls=[];
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let data=[];
    if(path.endsWith('/auth/me'))data=user;
    else if(path.endsWith('/master/com-codes/all-active'))data=Object.fromEntries(Object.entries(codes).map(([group,values])=>[group,values.map(([detailCode,codeName])=>({groupCode:group,detailCode,codeName,useYn:'Y'}))]));
    else if(path.includes('/master/workers'))data=[{workerCode:'W1',workerName:'수리작업자',useYn:'Y'}];
    else if(path.endsWith('/equipment/equips/metadata/processes'))data=[{processCode:'P1',processName:'조립',useYn:'Y'}];
    else if(path.includes('/warehouses'))data=[{warehouseCode:'FG_WIP',warehouseName:'완제품공정',warehouseType:'WIP',useYn:'Y'}];
    else if(path.endsWith('/production/repairs/stock-options'))data=[{warehouseCode:'FG_WIP',availableQty:5}];
    else if(path.endsWith('/inspections'))data=[];
    else if(path==='/api/production/repairs')data=[order];
    else if(path.endsWith('/start')){order.status='IN_REPAIR';order.repairResult='IN_PROGRESS';order.disposition='PENDING';calls.push('start');data=order;}
    else if(path.endsWith('/complete')){const body=req.postDataJSON();Object.assign(order,body);order.status=body.disposition==='REINSPECT'?'IN_REPAIR':'COMPLETED';calls.push('complete:'+body.disposition);data=order;}
    else if(path.endsWith('/inspect')){const body=req.postDataJSON();if(body.result==='PASS')order.status='COMPLETED';else Object.assign(order,{status:'IN_REPAIR',repairResult:'IN_PROGRESS',disposition:'PENDING'});calls.push('inspect:'+body.result);data=order;}
    else if(path.includes('/production/repairs/2026-09-05/99991')){if(req.method()==='PUT'){Object.assign(order,req.postDataJSON());calls.push('save');}data=order;}
    else if(path.includes('/health'))data={status:'ok',database:{status:'up'},details:{database:{status:'up'}}};
    else if(path.endsWith('/system/configs/active'))data={};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data,total:Array.isArray(data)?data.length:undefined})});
  });
  await page.goto('http://localhost:3002/login');
  await page.evaluate(user=>{
    localStorage.setItem('harness-auth',JSON.stringify({state:{user,token:'UI-FIXTURE-NOT-A-CREDENTIAL',isAuthenticated:true,selectedCompany:'40',selectedPlant:'1000',allowedMenus:[]},version:0}));
    localStorage.setItem('harness-token','UI-FIXTURE-NOT-A-CREDENTIAL');
    localStorage.setItem('i18nextLng','ko');
  },user);
  await page.goto('http://localhost:3002/production/repair');
  await page.getByText('UI-REPAIR-FG',{exact:true}).first().click();
  await page.getByRole('button',{name:'수리 시작',exact:true}).waitFor();
  const check=async(name)=>{
    await page.getByRole('button',{name,exact:true}).click();
    await page.getByRole('button',{name:'확인',exact:true}).click();
  };
  await page.getByRole('textbox',{name:'비고',exact:true}).fill('수리 변경 테스트');
  if(await page.getByRole('button',{name:'수리 시작',exact:true}).isEnabled())throw Error('unsaved start is enabled');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByRole('combobox',{name:'수리대상 출고 창고',exact:true}).selectOption('FG_WIP');
  await check('수리 시작');
  await page.getByRole('button',{name:'수리 완료 처리',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'수리후재처리',exact:true}).selectOption('REINSPECT');
  await check('수리 완료 처리');
  await page.getByRole('button',{name:'재검사 판정',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'재검사 판정',exact:true}).selectOption('FAIL');
  await page.getByRole('combobox',{name:'수리자',exact:true}).last().selectOption('W1');
  await check('재검사 판정');
  await page.getByRole('button',{name:'수리 완료 처리',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'수리후재처리',exact:true}).selectOption('REINSPECT');
  await check('수리 완료 처리');
  await page.getByRole('button',{name:'재검사 판정',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'수리자',exact:true}).last().selectOption('W1');
  await page.getByRole('combobox',{name:'복귀 창고',exact:true}).selectOption('FG_WIP');
  await check('재검사 판정');
  await page.getByText('종결된 수리는 조회만 가능합니다.',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:'저장',exact:true}).isEnabled())throw Error('completed save is enabled');
  return {url:page.url(),calls,status:order.status,mode:'mock API UI flow; no database writes'};
}
;

test('repair UI saves changes and flows through start, failed reinspection, retry and completion', {timeout:90000}, async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const result=await runScenario(page);
    assert.deepEqual(result.calls,['save','start','complete:REINSPECT','inspect:FAIL','complete:REINSPECT','inspect:PASS']);
    assert.equal(result.status,'COMPLETED');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
