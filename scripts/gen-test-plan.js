/**
 * @file scripts/gen-test-plan.js
 * @description HARNESS MES 테스트계획서 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440; const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', crit: 'FCE4EC', high: 'FFF2CC', med: 'E8F0FE', low: 'E8F5E9' };
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
      ...data.map((r,idx)=>new TableRow({children:r.map((v,i)=>c(v,ws[i],{sz:15,sh:idx%2===1?C.alt:C.w,al:i===0?AlignmentType.CENTER:AlignmentType.LEFT}))})),
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
function bullet(t) { return new Paragraph({spacing:{before:40,after:40},indent:{left:360},children:[new TextRun({text:'\u2022 '+t,font:'Arial',size:18})]}); }
function check(t) { return new Paragraph({spacing:{before:40,after:40},indent:{left:360},children:[new TextRun({text:'\u2610 '+t,font:'Arial',size:18})]}); }

function buildDoc() {
  const cover = {
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    children:[
      new Paragraph({spacing:{before:4000},children:[]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'HARNESS MES',font:'Arial',size:56,bold:true,color:C.primary})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:600},children:[new TextRun({text:'Manufacturing Execution System',font:'Arial',size:28,color:'666666'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'\uD14C\uC2A4\uD2B8\uACC4\uD68D\uC11C',font:'Arial',size:48,bold:true,color:'333333'})]}),
      new Paragraph({spacing:{before:2000},children:[]}),
      new Table({width:{size:5000,type:WidthType.DXA},columnWidths:[2000,3000],
        rows:[['프로젝트명','HARNESS MES'],['산출물명','테스트계획서'],['버전','v1.0'],['작성일','2026-03-18'],['작성자','HANES MES팀']].map(([k,v])=>
          new TableRow({children:[c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}),c(v,3000,{sz:18})]}))}),
    ],
  };

  const body = [];
  body.push(h1('\uAC1C\uC815\uC774\uB825'),tbl(['버전','일자','작성자','변경내용'],[['1.0','2026-03-18','HANES MES팀','최초 작성']],[1500,1500,2000,8440]),pb());
  body.push(h1('\uBAA9\uCC28'),new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}),pb());

  // 1. 개요
  body.push(h1('1. \uAC1C\uC694'),
    h2('1.1 \uBAA9\uC801'),p('본 문서는 HARNESS MES 시스템의 테스트 전략, 범위, 환경, 일정, 진입/종료 기준, 결함 관리 방안을 정의한다.'),
    h2('1.2 \uBC94\uC704'),p('전체 18개 백엔드 모듈, 144개 프론트엔드 화면, 125개 엔티티, 101개 컨트롤러, 105개 서비스에 대한 테스트를 포함한다.'),
    h2('1.3 \uCC38\uACE0 \uBB38\uC11C'),
    tbl(['문서명','설명'],[
      ['요구사항 정의서','기능/비기능 요구사항 95건'],
      ['기능설계서','기능별 상세 설계 (입력/처리/출력/예외)'],
      ['DB설계서','테이블/컬럼/관계 정의'],
      ['화면설계서','화면 레이아웃/항목/버튼 정의'],
      ['단위테스트 결과서','서비스별 단위테스트 결과'],
    ],[3000,10440]),pb());

  // 2. 테스트 전략
  body.push(h1('2. \uD14C\uC2A4\uD2B8 \uC804\uB7B5'),
    h2('2.1 \uD14C\uC2A4\uD2B8 \uB808\uBCA8'),
    tbl(['레벨','설명','도구','담당','자동화'],[
      ['단위 테스트','서비스/컨트롤러 개별 메서드 검증','Jest + @golevelup/ts-jest','개발팀','자동'],
      ['통합 테스트','API 엔드포인트 → DB 연동 검증','Jest + Supertest','개발팀','자동'],
      ['시스템 테스트','전체 프로세스 흐름 검증','수동 테스트 (브라우저)','QA팀','수동'],
      ['인수 테스트','고객 요구사항 충족 여부 확인','수동 테스트','고객/PM','수동'],
    ],[1500,3500,2500,1500,4440]),sp(),

    h2('2.2 \uD14C\uC2A4\uD2B8 \uC720\uD615'),
    tbl(['유형','설명','적용 시점'],[
      ['기능 테스트','요구사항 대비 기능 동작 검증','모든 기능 개발 완료 후'],
      ['경계값 테스트','입력값 최소/최대/경계 조건 검증','DTO 검증, 수량 제한'],
      ['비기능 테스트','성능, 보안, 호환성 검증','시스템 테스트 단계'],
      ['회귀 테스트','변경 후 기존 기능 영향 검증','매 릴리스 전'],
      ['동시성 테스트','동시 사용자 처리 검증','재고 관련 (pessimistic lock)'],
      ['호환성 테스트','브라우저/디바이스 호환 검증','인수 테스트 단계'],
    ],[2000,5000,6440]),pb());

  // 3. 테스트 환경
  body.push(h1('3. \uD14C\uC2A4\uD2B8 \uD658\uACBD'),
    h2('3.1 \uC18C\uD504\uD2B8\uC6E8\uC5B4 \uD658\uACBD'),
    infoTbl([
      ['프론트엔드','Next.js 15.2 + React 19 + TailwindCSS 4'],
      ['백엔드','NestJS 11 + TypeORM 0.3 + Oracle DB'],
      ['Node.js','v24.x'],
      ['패키지 매니저','pnpm@10.28.1'],
      ['빌드 시스템','Turborepo'],
      ['프로세스 관리','PM2'],
    ]),sp(),
    h2('3.2 \uD14C\uC2A4\uD2B8 \uB3C4\uAD6C'),
    tbl(['도구','용도','버전'],[
      ['Jest','단위/통합 테스트 프레임워크','내장'],
      ['@golevelup/ts-jest','NestJS Mock 생성 (createMock/DeepMocked)','최신'],
      ['@nestjs/testing','NestJS 테스트 모듈','11.x'],
      ['Supertest','HTTP API 통합 테스트','최신'],
      ['pnpm build','빌드 검증 (TypeScript 컴파일 에러 0건)','10.28.1'],
      ['브라우저','Chrome/Edge (수동 시스템 테스트)','최신'],
    ],[3000,6000,4440]),sp(),
    h2('3.3 \uD14C\uC2A4\uD2B8 \uB370\uC774\uD130'),
    tbl(['구분','설명'],[
      ['단위 테스트','Mock 데이터 (실제 DB 미사용)'],
      ['통합 테스트','테스트 전용 Oracle 스키마'],
      ['시스템 테스트','시드 데이터 (ComCode, 품목, 창고 등)'],
      ['인수 테스트','실제 운영 데이터 기반'],
    ],[3000,10440]),pb());

  // 4. 테스트 범위
  body.push(h1('4. \uD14C\uC2A4\uD2B8 \uBC94\uC704'),
    h2('4.1 \uBAA8\uB4C8\uBCC4 \uD14C\uC2A4\uD2B8 \uBC94\uC704'),
    tbl(['No','모듈','서비스 수','spec 파일','테스트 케이스','페이지 수','우선순위'],[
      ['1','material (자재관리)','15','15','~150','14','상'],
      ['2','master (기준정보)','15','15','~130','13','상'],
      ['3','quality (품질관리)','15','15','~120','19','상'],
      ['4','production (생산관리)','10','8','~100','13','상'],
      ['5','shipping (출하관리)','7','7','~70','9','상'],
      ['6','inventory (재고관리)','6','6','~60','6','상'],
      ['7','equipment (설비관리)','5','5','~55','11','상'],
      ['8','system (시스템관리)','7','7','~60','9','중'],
      ['9','scheduler (스케줄러)','4','4','~40','1','중'],
      ['10','consumables (소모품)','3','2','~25','6','중'],
      ['11','customs (보세관리)','1','1','~10','3','중'],
      ['12','outsourcing (외주관리)','1','1','~10','3','중'],
      ['13','기타 (auth,user,role,etc)','5','5','~15','2','중'],
      ['','합계','105','96','~845','144',''],
    ],[500,2800,1200,1200,1500,1200,5040]),sp(),

    h2('4.2 \uD14C\uC2A4\uD2B8 \uC81C\uC678 \uD56D\uBAA9'),
    tbl(['항목','사유'],[
      ['Playwright E2E 테스트','프로젝트 규칙상 금지 (수동 테스트 대체)'],
      ['설비 PLC 연동','3차 개발 범위 (보류)'],
      ['ERP 인터페이스','3차 개발 범위 (보류)'],
      ['계측장비 RS-232','하드웨어 의존 (별도 현장 테스트)'],
    ],[3000,10440]),pb());

  // 5. 테스트 일정
  body.push(h1('5. \uD14C\uC2A4\uD2B8 \uC77C\uC815'),
    tbl(['단계','활동','시작일','종료일','담당','산출물'],[
      ['1','단위 테스트 작성/실행','개발 병행','개발 완료 시','개발팀','단위테스트 결과서'],
      ['2','통합 테스트','단위 테스트 완료 후','1주','개발팀','통합테스트 결과서'],
      ['3','시스템 테스트','통합 테스트 완료 후','2주','QA팀','결함 보고서'],
      ['4','결함 수정 및 회귀 테스트','시스템 테스트 병행','1주','개발팀','수정 확인서'],
      ['5','인수 테스트 (UAT)','시스템 테스트 완료 후','1주','고객/PM','인수 확인서'],
    ],[500,2500,2000,1800,1200,5440]),pb());

  // 6. 테스트 케이스 요약
  body.push(h1('6. \uD14C\uC2A4\uD2B8 \uCF00\uC774\uC2A4 \uC694\uC57D'),
    h2('6.1 \uD604\uD669'),
    infoTbl([
      ['단위 테스트 파일','96개 (*.spec.ts)'],
      ['단위 테스트 케이스','~845건 (it 블록)'],
      ['테스트 패턴','AAA (Arrange-Act-Assert) / Given-When-Then'],
      ['Mock 방식','@golevelup/ts-jest createMock (DeepMocked)'],
      ['커버리지 목표','CUD 메서드 100%, 전체 70% 이상'],
    ]),sp(),
    h2('6.2 \uC6B0\uC120\uC21C\uC704\uBCC4 \uBD84\uD3EC'),
    tbl(['우선순위','테스트 범위','예상 케이스 수','비율'],[
      ['상 (Must)','핵심 업무 흐름 (입하→IQC→입고→생산→출하)','~500','60%'],
      ['중 (Should)','보조 기능 (재고실사, 소모품, 보세, 외주)','~250','30%'],
      ['하 (Could)','편의 기능 (다크모드, 내보내기, 라벨 재발행)','~95','10%'],
    ],[1500,5000,2000,4940]),pb());

  // 7. 진입/종료 기준
  body.push(h1('7. \uC9C4\uC785/\uC885\uB8CC \uAE30\uC900'),
    h2('7.1 \uD14C\uC2A4\uD2B8 \uC9C4\uC785 \uAE30\uC900'),
    check('개발 완료 및 pnpm build 에러 0건'),
    check('단위 테스트 전체 PASS (Jest)'),
    check('테스트 환경 구성 완료 (DB, 시드 데이터)'),
    check('테스트 데이터 준비 완료'),
    check('요구사항 정의서 확정'),
    sp(),
    h2('7.2 \uD14C\uC2A4\uD2B8 \uC885\uB8CC \uAE30\uC900'),
    check('전체 테스트 케이스 실행 완료 (실행률 100%)'),
    check('심각도 치명적(Critical) 결함 0건'),
    check('심각도 높음(High) 결함 해결률 100%'),
    check('심각도 중간(Medium) 결함 해결률 95% 이상'),
    check('고객 인수 테스트(UAT) 통과'),
    check('성능 목표 달성 (페이지 로딩 3초 이내)'),
    sp(),
    h2('7.3 \uC911\uB2E8/\uC7AC\uAC1C \uAE30\uC900'),
    tbl(['조건','기준'],[
      ['중단','치명적 결함 3건 이상 동시 발생'],
      ['중단','테스트 환경 장애로 테스트 불가'],
      ['재개','중단 원인 해결 확인 후'],
      ['재개','회귀 테스트 통과 후 계속'],
    ],[2000,11440]),pb());

  // 8. 결함 관리
  body.push(h1('8. \uACB0\uD568 \uAD00\uB9AC'),
    h2('8.1 \uACB0\uD568 \uC2EC\uAC01\uB3C4'),
    tbl(['심각도','설명','예시','목표 해결 시간'],[
      ['치명적 (Critical)','시스템 중단, 데이터 손실','재고 수량 불일치, 트랜잭션 롤백 실패','4시간 이내'],
      ['높음 (High)','핵심 기능 사용 불가','입고 등록 실패, 라벨 발행 오류','1일 이내'],
      ['중간 (Medium)','기능 일부 제한, 우회 가능','필터 미작동, 페이지네이션 오류','3일 이내'],
      ['낮음 (Low)','UI/UX 개선사항','정렬 순서, 텍스트 오타, 색상','1주 이내'],
    ],[1800,3000,4000,4640]),sp(),
    h2('8.2 \uACB0\uD568 \uCC98\uB9AC \uD504\uB85C\uC138\uC2A4'),
    bullet('발견 → 등록 (GitHub Issues)'),
    bullet('분류 (심각도/우선순위 지정)'),
    bullet('할당 (담당 개발자 지정)'),
    bullet('수정 (코드 수정 + 단위테스트 추가)'),
    bullet('검증 (QA 재테스트)'),
    bullet('종결 (확인 후 Close)'),
    sp(),
    h2('8.3 \uACB0\uD568 \uAD00\uB9AC \uB3C4\uAD6C'),
    infoTbl([['도구','GitHub Issues'],['라벨','bug, critical, high, medium, low'],['템플릿','결함 제목, 재현 단계, 기대결과, 실제결과, 스크린샷']]),
    pb());

  // 9. 리스크
  body.push(h1('9. \uB9AC\uC2A4\uD06C \uBC0F \uB300\uC751 \uBC29\uC548'),
    tbl(['No','리스크','영향','확률','대응 방안'],[
      ['1','Oracle DB 연결 불안정','테스트 중단','중','테스트 전용 DB 별도 구성, Mock 테스트 병행'],
      ['2','바코드 스캐너 현장 미확보','인터페이스 테스트 불가','높','시뮬레이터로 대체, 현장 테스트 별도 일정'],
      ['3','요구사항 변경','테스트 범위 변동','중','변경 시 영향도 분석 후 테스트 케이스 갱신'],
      ['4','동시 사용자 부하','성능 이슈 발견 지연','낮','pessimistic lock 단위테스트로 사전 검증'],
      ['5','PLC 연동 미확정','설비 인터락 테스트 불가','높','3차 개발로 이관, 소프트웨어 인터락만 테스트'],
    ],[500,2800,2500,800,6840]),pb());

  // 10. 역할 및 책임
  body.push(h1('10. \uC5ED\uD560 \uBC0F \uCC45\uC784'),
    tbl(['역할','담당','책임'],[
      ['테스트 관리자','PM','테스트 계획/일정 관리, 진행 보고'],
      ['개발팀','개발자','단위/통합 테스트 작성 및 실행, 결함 수정'],
      ['QA팀','QA 담당자','시스템 테스트 실행, 결함 등록, 재테스트'],
      ['고객/현업','고객사 담당자','인수 테스트 실행, 승인'],
    ],[2000,2000,9440]));

  const bodySection = {
    properties:{page:{size:{width:11906,height:16838,orientation:'landscape'},margin:{top:MARGIN,right:MARGIN,bottom:MARGIN,left:MARGIN}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'HARNESS MES - \uD14C\uC2A4\uD2B8\uACC4\uD68D\uC11C',font:'Arial',size:16,color:'999999'})]})]})},
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
  fs.mkdirSync('exports/system',{recursive:true});
  const outPath = 'exports/system/테스트계획서_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
