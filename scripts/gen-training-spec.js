/**
 * @file scripts/gen-training-spec.js
 * @description HARNESS MES 교육 명세서 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440; const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', basic: 'E8F5E9', mid: 'FFF2CC', adv: 'FCE4EC' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(t,w,o={}) {
  return new TableCell({ borders:tbs, width:{size:w,type:WidthType.DXA},
    shading:o.sh?{fill:o.sh,type:ShadingType.CLEAR}:undefined,
    margins:{top:50,bottom:50,left:80,right:80}, columnSpan:o.span, verticalAlign:'center',
    children:[new Paragraph({alignment:o.al||AlignmentType.LEFT,spacing:{before:0,after:0},
      children:[new TextRun({text:t||'',bold:o.b||false,font:'Arial',size:o.sz||17,color:o.cl||'000000'})]})]});
}
function tbl(hds,data,ws) {
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ws,
    rows:[
      new TableRow({tableHeader:true,children:hds.map((h,i)=>c(h,ws[i],{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:15}))}),
      ...data.map((r,idx)=>new TableRow({children:r.map((v,i)=>{
        const isLv = hds[i]==='수준';
        let sh = idx%2===1?C.alt:C.w;
        if(isLv) sh = v==='초급'?C.basic:v==='중급'?C.mid:C.adv;
        return c(v,ws[i],{sz:15,sh,al:i===0||isLv?AlignmentType.CENTER:AlignmentType.LEFT});
      })})),
    ]});
}
function infoTbl(rows) {
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[3000,10440],
    rows:rows.map(([k,v])=>new TableRow({children:[c(k,3000,{b:true,sh:C.hdr}),c(v,10440)]}))});
}
function sp() { return new Paragraph({spacing:{after:200},children:[]}); }
function pb() { return new Paragraph({children:[new PageBreak()]}); }
function h1(t) { return new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:t,font:'Arial'})]}); }
function h2(t) { return new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:t,font:'Arial'})]}); }
function p(t) { return new Paragraph({spacing:{after:120},children:[new TextRun({text:t,font:'Arial',size:20})]}); }

// ── 교육 과정 데이터 ──
const courses = [
  { id:'TR-000', name:'시스템 기본 교육', target:'전체 사용자', type:'집합교육', hours:'2시간', level:'초급', prereq:'-', menus:'로그인, 대시보드, 메뉴 구조',
    units:[
      ['1','시스템 접속 및 로그인','30분','PC/PDA 접속, 로그인, 비밀번호 변경','O'],
      ['2','대시보드 및 메뉴 구조','30분','대시보드 위젯, 사이드바 메뉴 탐색','O'],
      ['3','공통 기능 사용법','30분','DataGrid 필터/정렬, 엑셀 내보내기, 다국어 전환','O'],
      ['4','다크모드 및 개인 설정','30분','테마 변경, 알림 설정','O'],
    ]},
  { id:'TR-001', name:'기준정보 관리 교육', target:'시스템관리자, 생산관리자', type:'집합교육(실습)', hours:'4시간', level:'중급', prereq:'TR-000', menus:'품목, BOM, 라우팅, 공정, 설비, 창고 등 13개 화면',
    units:[
      ['1','품목 등록/수정','40분','품목유형, IQC 설정, 포장단위, 유수명','O'],
      ['2','BOM 관리','40분','BOM 구조 등록, 엑셀 업/다운로드, 라우팅 연동','O'],
      ['3','라우팅/공정 관리','40분','공정 등록, 라우팅 설정, 품질조건 설정','O'],
      ['4','설비/창고/작업자 관리','40분','설비 등록, 점검항목, 창고/로케이션, 작업자 QR','O'],
      ['5','거래처/바코드 매핑','30분','거래처 등록, 제조사 바코드 1:1 매핑','O'],
      ['6','라벨/작업지도서','30분','라벨 양식 관리, 작업지도서 이미지 업로드','O'],
    ]},
  { id:'TR-002', name:'자재관리 교육', target:'자재관리자', type:'집합교육(실습)', hours:'4시간', level:'중급', prereq:'TR-000', menus:'입하, IQC, 라벨발행, 입고, 출고, LOT 등 14개 화면',
    units:[
      ['1','PO 관리 및 현황','30분','PO 등록, PO 대비 입고 현황 조회','O'],
      ['2','입하관리','60분','PO 입하, 수동 입하, 입하 취소(역분개)','O'],
      ['3','IQC 검사/라벨 발행','60분','IQC 항목 입력, 합부 판정, 라벨 발행/재발행','O'],
      ['4','입고관리','40분','일괄/분할 입고, 자동입고, 입고 이력 조회','O'],
      ['5','출고/LOT 관리','40분','출고요청, 자재출고, LOT 분할/병합, 폐기','O'],
      ['6','재고 관리','30분','재고현황, 수불이력, 재고실사, 유수명 관리','O'],
    ]},
  { id:'TR-003', name:'생산관리 교육', target:'생산관리자, 현장작업자', type:'집합교육(실습)', hours:'4시간', level:'중급', prereq:'TR-000', menus:'작업지시, 실적입력(4유형), 샘플검사, 포장 등 13개 화면',
    units:[
      ['1','월간생산계획','30분','계획 등록/확정/마감','O'],
      ['2','작업지시 관리','40분','완제품 기준 작업지시 생성, 자재 불출요청서','O'],
      ['3','실적입력 - 수작업/가공','60분','설비 QR 스캔, 자재 확인, 실적 등록','O'],
      ['4','실적입력 - 검사/통전','60분','단순검사, 장비검사, 마스터 샘플 검사','O'],
      ['5','재작업/수리','30분','NG 제품 수리 등록, 재검사, 신규 라벨','O'],
      ['6','포장/제품재고','30분','포장 관리, 제품 입출고, 재고 조회','O'],
    ]},
  { id:'TR-004', name:'품질관리 교육', target:'품질관리자', type:'집합교육(실습)', hours:'4시간', level:'고급', prereq:'TR-000, TR-002', menus:'IQC, 불량, 공정검사, OQC, SPC, CAPA 등 19개 화면',
    units:[
      ['1','수입검사(IQC)','40분','검사항목 관리, 계측값 입력, 합부 판정','O'],
      ['2','공정검사/출하검사(OQC)','40분','공정별 검사, 외관검사, 검사원 실명제','O'],
      ['3','불량/재작업 관리','40분','불량 접수→분석→해결, 재작업 검사','O'],
      ['4','SPC/Control Plan','60분','관리도 차트, Cpk 계산, 관리방법 설정','O'],
      ['5','변경관리/CAPA/FAI/PPAP','40분','설계변경, 시정예방, 초도품, 생산부품 승인','O'],
      ['6','추적관리/감사','30분','제품 시리얼 역추적, 내부/외부 감사 관리','O'],
    ]},
  { id:'TR-005', name:'설비관리 교육', target:'설비관리자, 현장작업자', type:'집합교육(실습)', hours:'3시간', level:'중급', prereq:'TR-000', menus:'금형, 일상/정기점검, 예방보전, 계측기 등 14개 화면',
    units:[
      ['1','금형/소모부품 관리','40분','금형 등록, 타수 카운팅, 수명 관리','O'],
      ['2','일상/정기 점검','60분','PDA 점검, 캘린더 조회, 점검 이력','O'],
      ['3','예방보전 계획/실적','40분','PM 계획 등록, 주기 설정, 실적 기록','O'],
      ['4','계측기 관리','30분','계측기 등록, 교정 관리, 교정 이력','O'],
    ]},
  { id:'TR-006', name:'출하관리 교육', target:'출하담당자', type:'집합교육(실습)', hours:'3시간', level:'초급', prereq:'TR-000', menus:'포장, 팔렛, 출하확정, 오더, 반품 등 9개 화면',
    units:[
      ['1','포장/팔렛 관리','60분','포장 스캔, 혼입/과포장 방지, 팔렛 적재','O'],
      ['2','출하오더/확정','60분','출하지시 등록, 바코드 스캔 출하 처리','O'],
      ['3','출하이력/반품','30분','출하 이력 조회, 반품 등록','O'],
      ['4','고객PO 관리','30분','고객 PO 등록, 현황 조회','O'],
    ]},
  { id:'TR-007', name:'PDA 현장 교육', target:'현장작업자 (PDA)', type:'현장교육(실습)', hours:'2시간', level:'초급', prereq:'TR-000', menus:'PDA 입고, 출고, 설비점검, 재고실사',
    units:[
      ['1','PDA 접속 및 기본 조작','30분','PWA 설치, 로그인, 메뉴 탐색','O'],
      ['2','PDA 자재 입출고','40분','바코드 스캔 입고, 출고 처리','O'],
      ['3','PDA 설비 점검','30분','일상점검 체크리스트 입력','O'],
      ['4','PDA 재고실사','20분','재고실사 바코드 스캔 입력','O'],
    ]},
  { id:'TR-008', name:'시스템관리 교육', target:'시스템관리자', type:'집합교육', hours:'3시간', level:'고급', prereq:'TR-000, TR-001', menus:'사용자, 권한, 코드, 스케줄러, 문서 등 9개 화면',
    units:[
      ['1','사용자/권한 관리','40분','사용자 등록, RBAC 역할/권한 설정','O'],
      ['2','PDA 권한/코드 관리','30분','PDA 권한, 공통코드 등록/수정','O'],
      ['3','시스템설정/통신','30분','자동입고, 재고동결, 시리얼포트 설정','O'],
      ['4','스케줄러/문서 관리','40분','배치 작업 등록, 로그 조회, 문서 관리','O'],
      ['5','교육 관리','30분','교육 계획, 실적, 수료 관리','O'],
    ]},
];

function buildDoc() {
  const cover = {
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    children:[
      new Paragraph({spacing:{before:4000},children:[]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'HARNESS MES',font:'Arial',size:56,bold:true,color:C.primary})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:600},children:[new TextRun({text:'Manufacturing Execution System',font:'Arial',size:28,color:'666666'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'\uAD50\uC721 \uBA85\uC138\uC11C',font:'Arial',size:48,bold:true,color:'333333'})]}),
      new Paragraph({spacing:{before:2000},children:[]}),
      new Table({width:{size:5000,type:WidthType.DXA},columnWidths:[2000,3000],
        rows:[['프로젝트명','HARNESS MES'],['산출물명','교육 명세서'],['버전','v1.0'],['작성일','2026-03-18'],['작성자','HANES MES팀']].map(([k,v])=>
          new TableRow({children:[c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}),c(v,3000,{sz:18})]}))}),
    ],
  };

  const body = [];
  body.push(h1('\uAC1C\uC815\uC774\uB825'),tbl(['버전','일자','작성자','변경내용'],[['1.0','2026-03-18','HANES MES팀','최초 작성']],[1500,1500,2000,8440]),pb());
  body.push(h1('\uBAA9\uCC28'),new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}),pb());

  // 1. 개요
  body.push(h1('1. \uAC1C\uC694'),
    h2('1.1 \uBAA9\uC801'),p('본 문서는 HARNESS MES 시스템 도입에 따른 사용자 교육 계획을 수립하고, 교육 대상, 과정, 내용, 일정, 평가 방법을 정의한다.'),
    h2('1.2 \uBC94\uC704'),p(`전체 ${courses.length}개 교육 과정, 총 ${courses.reduce((s,c)=>s+parseInt(c.hours),0)}시간`),
    h2('1.3 \uAD50\uC721 \uBAA9\uD45C'),
    tbl(['목표','설명'],[
      ['업무 숙련도 확보','각 역할별 MES 시스템 조작 능력 확보'],
      ['프로세스 이해','입하→IQC→입고→생산→출하 전체 흐름 이해'],
      ['품질 관리 역량','IQC, SPC, CAPA 등 품질 관리 시스템 활용 능력'],
      ['자립 운영','교육 후 매뉴얼 없이 일상 업무 수행 가능'],
    ],[3000,10440]),pb());

  // 2. 교육 대상
  body.push(h1('2. \uAD50\uC721 \uB300\uC0C1'),
    tbl(['대상 유형','설명','예상 인원','수준','필수 과정'],[
      ['시스템 관리자','전체 시스템 설정/관리, 사용자/권한 관리','2명','고급','TR-000, TR-001, TR-008'],
      ['생산 관리자','작업지시, 생산계획, 실적 관리','3명','중급','TR-000, TR-001, TR-003'],
      ['자재 관리자','입하, 입고, 출고, 재고 관리','3명','중급','TR-000, TR-002'],
      ['품질 관리자','IQC, 검사, SPC, CAPA','3명','고급','TR-000, TR-002, TR-004'],
      ['설비 관리자','설비 등록, 점검, 예방보전','2명','중급','TR-000, TR-005'],
      ['현장 작업자','실적입력, 설비점검 (PC/PDA)','20명','초급','TR-000, TR-003, TR-007'],
      ['출하 담당자','포장, 출하','3명','초급','TR-000, TR-006'],
    ],[2000,3000,1200,800,6440]),pb());

  // 3. 교육 과정 목록
  body.push(h1('3. \uAD50\uC721 \uACFC\uC815 \uBAA9\uB85D'),
    tbl(['No','과정ID','과정명','대상','유형','시간','수준'],[
      ...courses.map((c,i)=>[String(i+1),c.id,c.name,c.target,c.type,c.hours,c.level]),
    ],[500,1200,2500,2500,2000,1000,3740]),pb());

  // 4. 교육 과정 상세
  body.push(h1('4. \uAD50\uC721 \uACFC\uC815 \uC0C1\uC138'));
  courses.forEach((course,ci) => {
    body.push(h2(`4.${ci+1} ${course.name} (${course.id})`));
    body.push(infoTbl([
      ['과정 ID',course.id],['과정명',course.name],['교육 대상',course.target],
      ['교육 유형',course.type],['교육 시간',course.hours],['교육 수준',course.level],
      ['선수 과정',course.prereq],['관련 메뉴',course.menus],
    ]),sp());

    const unitWs = [500,2500,1000,5000,3940];  // 실습 → 비고 변경
    body.push(tbl(['단원','주제','시간','내용','실습'],
      course.units.map(u => [u[0],u[1],u[2],u[3],u[4]]),
      unitWs),sp());

    if(ci < courses.length-1 && ci%2===1) body.push(pb());
  });
  body.push(pb());

  // 5. 교육 일정
  body.push(h1('5. \uAD50\uC721 \uC77C\uC815'),
    h2('5.1 \uB2E8\uACC4\uBCC4 \uAD50\uC721 \uC77C\uC815'),
    tbl(['단계','기간','대상','과정','비고'],[
      ['1단계: 관리자 교육','시스템 오픈 2주 전','시스템/생산/자재/품질 관리자','TR-000~004, TR-008','선행 교육'],
      ['2단계: 현장 교육','시스템 오픈 1주 전','현장작업자, 출하담당자','TR-003, TR-006, TR-007','현장 실습 중심'],
      ['3단계: 설비/PDA 교육','시스템 오픈 직전','설비관리자, PDA 사용자','TR-005, TR-007','현장 장비 연동'],
      ['4단계: 보충 교육','시스템 오픈 후 1주','전체 (필요 시)','해당 과정','업무 중 발생 이슈'],
    ],[1500,2000,2500,3000,4440]),sp(),

    h2('5.2 \uAD50\uC721 \uBC29\uBC95'),
    tbl(['방법','설명','적용 과정'],[
      ['집합교육','회의실에서 강사 주도 교육 + 프로젝터','TR-000~004, TR-008'],
      ['현장교육','생산 현장에서 실제 장비/PDA 활용','TR-005~007'],
      ['OJT (On-the-Job)','업무 중 선배 직원의 1:1 지도','시스템 오픈 후 보충'],
      ['자습 (매뉴얼)','사용자 매뉴얼 기반 자율 학습','전체'],
    ],[2000,6000,5440]),pb());

  // 6. 교육 자료
  body.push(h1('6. \uAD50\uC721 \uC790\uB8CC'),
    tbl(['No','자료명','형태','대상','비고'],[
      ['1','시스템 사용자 매뉴얼','Word/PDF','전체','화면별 조작법'],
      ['2','교육용 PPT','PowerPoint','강사용','과정별 슬라이드'],
      ['3','실습 시나리오','Word/PDF','교육생','단계별 실습 지침서'],
      ['4','Quick Reference Card','A4 1장','현장 부착','주요 기능 요약'],
      ['5','PDA 가이드','Word/PDF','PDA 사용자','PDA 전용 조작법'],
      ['6','교육 동영상','MP4','전체','추후 제작 (선택)'],
    ],[500,2500,1500,2000,6940]),sp(),
    p('* 교육 환경: 테스트 서버 + 시드 데이터 (실제 운영 데이터와 분리)'),
    pb());

  // 7. 교육 평가
  body.push(h1('7. \uAD50\uC721 \uD3C9\uAC00'),
    h2('7.1 \uD3C9\uAC00 \uBC29\uBC95'),
    tbl(['평가 방법','설명','적용'],[
      ['실습 평가','교육 과정 중 실습 과제 수행 여부 확인','전체 과정'],
      ['이해도 테스트','핵심 기능 10문항 (객관식+실습형)','관리자 과정'],
      ['현장 적용 확인','시스템 오픈 후 1주간 실무 적용 여부 모니터링','전체'],
      ['교육 만족도 조사','교육 내용/강사/환경 만족도 설문','전체 과정'],
    ],[2000,6000,5440]),sp(),

    h2('7.2 \uC218\uB8CC \uAE30\uC900'),
    tbl(['기준','설명'],[
      ['출석률','교육 시간의 80% 이상 출석'],
      ['실습 완료','모든 실습 과제 수행 완료'],
      ['이해도 테스트','70점 이상 (관리자 과정)'],
      ['미수료 시','보충 교육 후 재평가'],
    ],[3000,10440]));

  const bodySection = {
    properties:{page:{size:{width:11906,height:16838,orientation:'landscape'},margin:{top:MARGIN,right:MARGIN,bottom:MARGIN,left:MARGIN}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'HARNESS MES - \uAD50\uC721 \uBA85\uC138\uC11C',font:'Arial',size:16,color:'999999'})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Page ',font:'Arial',size:16,color:'999999'}),new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:16,color:'999999'})]})]})},
    children:body,
  };

  return new Document({
    styles:{default:{document:{run:{font:'Arial',size:20}}},
      paragraphStyles:[
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:32,bold:true,font:'Arial',color:C.primary},paragraph:{spacing:{before:360,after:240},outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:26,bold:true,font:'Arial',color:'333333'},paragraph:{spacing:{before:240,after:180},outlineLevel:1}},
      ]},
    sections:[cover,bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync('docs/deliverables/system',{recursive:true});
  const outPath = 'docs/deliverables/system/교육명세서_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
