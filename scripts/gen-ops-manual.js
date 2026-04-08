/**
 * @file scripts/gen-ops-manual.js
 * @description HARNESS MES 운영자 매뉴얼 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 9026;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', tip: 'E8F5E9', warn: 'FFF2CC', danger: 'FCE4EC', code: 'F0F4F8' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(t,w,o={}) {
  return new TableCell({ borders:tbs, width:{size:w,type:WidthType.DXA},
    shading:o.sh?{fill:o.sh,type:ShadingType.CLEAR}:undefined,
    margins:{top:60,bottom:60,left:100,right:100}, columnSpan:o.span, verticalAlign:'center',
    children:[new Paragraph({alignment:o.al||AlignmentType.LEFT,spacing:{before:0,after:0},
      children:[new TextRun({text:t||'',bold:o.b||false,font:o.fn||'Arial',size:o.sz||20,color:o.cl||'000000'})]})]});
}
function tbl(hds,data,ws) {
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ws,
    rows:[
      new TableRow({tableHeader:true,children:hds.map((h,i)=>c(h,ws[i],{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}))}),
      ...data.map((r,idx)=>new TableRow({children:r.map((v,i)=>c(v,ws[i],{sz:18,sh:idx%2===1?C.alt:C.w}))})),
    ]});
}
function infoTbl(rows){return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[2500,6526],rows:rows.map(([k,v])=>new TableRow({children:[c(k,2500,{b:true,sh:C.hdr}),c(v,6526)]}))});}
function sp(){return new Paragraph({spacing:{after:200},children:[]});}
function pb(){return new Paragraph({children:[new PageBreak()]});}
function h1(t){return new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:t,font:'Arial'})]});}
function h2(t){return new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:t,font:'Arial'})]});}
function p(t,o={}){return new Paragraph({spacing:{after:o.after||120},indent:o.indent?{left:o.indent}:undefined,children:[new TextRun({text:t,font:o.fn||'Arial',size:o.sz||20,bold:o.b,color:o.cl})]});}
function cmd(text){
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[CW],
    rows:[new TableRow({children:[new TableCell({borders:tbs,width:{size:CW,type:WidthType.DXA},
      shading:{fill:C.code,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},
      children:[new Paragraph({children:[new TextRun({text:text,font:'Consolas',size:18})]})]})]})]});
}
function tip(icon,text,bg){
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[CW],
    rows:[new TableRow({children:[new TableCell({borders:tbs,width:{size:CW,type:WidthType.DXA},
      shading:{fill:bg,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},
      children:[new Paragraph({children:[new TextRun({text:icon+' '+text,font:'Arial',size:18})]})]})]})]});
}

function buildDoc(){
  const cover={
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    children:[
      new Paragraph({spacing:{before:4000},children:[]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'HARNESS MES',font:'Arial',size:56,bold:true,color:C.primary})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:600},children:[new TextRun({text:'Manufacturing Execution System',font:'Arial',size:28,color:'666666'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'\uC6B4\uC601\uC790 \uB9E4\uB274\uC5BC',font:'Arial',size:48,bold:true,color:'333333'})]}),
      new Paragraph({spacing:{before:2000},children:[]}),
      new Table({width:{size:5000,type:WidthType.DXA},columnWidths:[2000,3000],
        rows:[['프로젝트명','HARNESS MES'],['산출물명','운영자 매뉴얼'],['버전','v1.0'],['작성일','2026-03-19'],['작성자','HANES MES팀']].map(([k,v])=>
          new TableRow({children:[c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER}),c(v,3000)]}))}),
    ],
  };

  const body=[];
  body.push(h1('\uAC1C\uC815\uC774\uB825'),tbl(['버전','일자','작성자','변경내용'],[['1.0','2026-03-19','HANES MES팀','최초 작성']],[1500,1500,2000,4026]),pb());
  body.push(h1('\uBAA9\uCC28'),new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}),pb());

  // 1. 시스템 개요
  body.push(h1('1. \uC2DC\uC2A4\uD15C \uAC1C\uC694'),
    h2('1.1 \uC2DC\uC2A4\uD15C \uAD6C\uC131'),
    infoTbl([
      ['프로젝트 경로','C:\\Project\\HANES'],
      ['프론트엔드','Next.js 15 (포트: 3002)'],
      ['백엔드','NestJS 11 (포트: 3003)'],
      ['데이터베이스','Oracle Database (oracledb 드라이버)'],
      ['프로세스 관리','PM2'],
      ['빌드 시스템','Turborepo + pnpm@10.28.1'],
      ['CI/CD','GitHub Actions (self-hosted runner)'],
      ['로그 경로','C:\\Project\\HANES\\logs\\'],
    ]),sp(),
    h2('1.2 \uC11C\uBC84 \uD658\uACBD'),
    infoTbl([
      ['OS','Windows Server'],
      ['Node.js','v24.x'],
      ['pnpm','10.28.1'],
      ['PM2','최신 (전역 설치)'],
      ['Oracle Instant Client','설치 필요'],
    ]),pb());

  // 2. 설치 및 배포
  body.push(h1('2. \uC124\uCE58 \uBC0F \uBC30\uD3EC'),
    h2('2.1 \uC0AC\uC804 \uC694\uAD6C\uC0AC\uD56D'),
    p('1. Node.js v24+ 설치',{indent:360}),
    p('2. pnpm 설치: npm install -g pnpm@10.28.1',{indent:360}),
    p('3. PM2 설치: npm install -g pm2',{indent:360}),
    p('4. Oracle Instant Client 설치 및 환경변수 설정',{indent:360}),
    p('5. Git 설치 및 GitHub 접근 권한 설정',{indent:360}),
    sp(),
    h2('2.2 \uCD5C\uCD08 \uC124\uCE58'),
    cmd('git clone https://github.com/YouHyuksoo/HANES.git C:\\Project\\HANES'),sp(80),
    cmd('cd C:\\Project\\HANES && pnpm install'),sp(80),
    cmd('pnpm build'),sp(80),
    cmd('pm2 start ecosystem.config.js'),sp(80),
    cmd('pm2 save'),sp(),

    h2('2.3 GitHub Actions \uC790\uB3D9 \uBC30\uD3EC'),
    p('main 브랜치에 push하면 자동 배포됩니다:'),
    p('1. PM2 프로세스 중지 (hanes-frontend, hanes-backend)',{indent:360}),
    p('2. git fetch + git reset --hard origin/main',{indent:360}),
    p('3. pnpm install --frozen-lockfile',{indent:360}),
    p('4. pnpm build',{indent:360}),
    p('5. pm2 start ecosystem.config.js --update-env',{indent:360}),
    p('6. pm2 save',{indent:360}),
    sp(),
    tip('\u26A0\uFE0F','배포 파일: .github/workflows/deploy.yml',C.warn),
    pb());

  // 3. 시스템 시작/중지
  body.push(h1('3. \uC2DC\uC2A4\uD15C \uC2DC\uC791/\uC911\uC9C0'),
    h2('3.1 PM2 \uD504\uB85C\uC138\uC2A4'),
    tbl(['프로세스명','역할','포트','스크립트','로그 파일'],[
      ['hanes-frontend','Next.js 프론트엔드','3002','next start -p 3002','logs/frontend-*.log'],
      ['hanes-backend','NestJS 백엔드','3003','dist/main.js','logs/backend-*.log'],
    ],[2000,2000,800,2200,2026]),sp(),

    h2('3.2 \uC8FC\uC694 \uBA85\uB839\uC5B4'),
    tbl(['작업','명령어','비고'],[
      ['전체 시작','pm2 start ecosystem.config.js','최초 또는 재등록 시'],
      ['전체 재시작','pm2 restart hanes-frontend hanes-backend','코드 변경 후'],
      ['전체 중지','pm2 stop hanes-frontend hanes-backend','유지보수 시'],
      ['상태 확인','pm2 status','프로세스 상태 조회'],
      ['로그 실시간','pm2 logs hanes-backend','실시간 로그 모니터링'],
      ['로그 초기화','pm2 flush','로그 파일 비우기'],
      ['PM2 설정 저장','pm2 save','서버 재부팅 시 자동 시작용'],
    ],[2500,3500,3026]),sp(),
    tip('\uD83D\uDEA8','pm2 kill 절대 금지! 같은 서버의 다른 프로젝트도 죽습니다. 반드시 프로세스 이름으로 제어하세요.',C.danger),sp(),
    tip('\u26A0\uFE0F','PM2 재시작은 반드시 PowerShell에서 실행하세요. cmd는 exit code 문제가 발생합니다.',C.warn),
    pb());

  // 4. 설정 관리
  body.push(h1('4. \uC124\uC815 \uAD00\uB9AC'),
    h2('4.1 \uD658\uACBD \uBCC0\uC218 (.env)'),
    tbl(['변수','설명','위치'],[
      ['DB_HOST','Oracle DB 호스트','apps/backend/.env'],
      ['DB_PORT','Oracle DB 포트 (기본 1521)','apps/backend/.env'],
      ['DB_SID','Oracle SID','apps/backend/.env'],
      ['DB_USERNAME','DB 사용자명','apps/backend/.env'],
      ['DB_PASSWORD','DB 비밀번호','apps/backend/.env'],
      ['JWT_SECRET','JWT 토큰 시크릿','apps/backend/.env'],
      ['JWT_EXPIRES_IN','토큰 만료 시간','apps/backend/.env'],
      ['PORT','백엔드 포트 (3003)','ecosystem.config.js'],
      ['NEXT_PUBLIC_API_URL','프론트→백엔드 API URL','apps/frontend/.env'],
    ],[2500,3500,3026]),sp(),
    tip('\u26A0\uFE0F','.env 파일은 절대 Git에 커밋하지 마세요. .gitignore에 포함되어 있습니다.',C.warn),sp(),

    h2('4.2 \uC2DC\uC2A4\uD15C \uC124\uC815 (SYS_CONFIGS)'),
    p('시스템관리 > 시스템설정 화면에서 관리하는 설정:'),
    tbl(['설정 키','설명','기본값'],[
      ['IQC_AUTO_RECEIVE','라벨 발행 시 자동입고 여부','OFF'],
      ['INVENTORY_FREEZE','재고동결 기간 설정','OFF'],
      ['DEFAULT_WAREHOUSE','기본 입고 창고','WH01'],
    ],[2500,4000,2526]),sp(),

    h2('4.3 \uC2A4\uCF00\uC904\uB7EC \uC124\uC815'),
    p('시스템관리 > 스케줄러 관리 화면에서 배치 작업을 관리합니다.'),
    p('Cron 표현식으로 실행 주기를 설정하고, 실행 이력/로그를 조회할 수 있습니다.'),
    pb());

  // 5. 모니터링
  body.push(h1('5. \uBAA8\uB2C8\uD130\uB9C1'),
    h2('5.1 PM2 \uBAA8\uB2C8\uD130\uB9C1'),
    cmd('pm2 monit                    # 실시간 CPU/메모리 모니터'),sp(80),
    cmd('pm2 status                   # 프로세스 상태 요약'),sp(80),
    cmd('pm2 logs hanes-backend --lines 100  # 최근 100줄 로그'),sp(),

    h2('5.2 \uB85C\uADF8 \uD30C\uC77C'),
    tbl(['로그 파일','내용','경로'],[
      ['frontend-out.log','프론트엔드 정상 로그','C:\\Project\\HANES\\logs\\'],
      ['frontend-error.log','프론트엔드 에러 로그','C:\\Project\\HANES\\logs\\'],
      ['backend-out.log','백엔드 정상 로그','C:\\Project\\HANES\\logs\\'],
      ['backend-error.log','백엔드 에러 로그','C:\\Project\\HANES\\logs\\'],
    ],[2500,3000,3526]),sp(),
    p('로그 날짜 형식: YYYY-MM-DD HH:mm:ss'),sp(),

    h2('5.3 \uC2A4\uCF00\uC904\uB7EC \uB85C\uADF8'),
    p('시스템관리 > 스케줄러 관리 > 로그 탭에서 배치 작업 실행 이력을 조회합니다.'),
    p('상태: SUCCESS(녹색) / FAIL(빨강) / RUNNING(파랑) / SKIPPED(회색)'),
    pb());

  // 6. 백업 및 복구
  body.push(h1('6. \uBC31\uC5C5 \uBC0F \uBCF5\uAD6C'),
    h2('6.1 DB \uBC31\uC5C5 (Oracle)'),
    cmd('expdp SCHEMA_NAME/PASSWORD@SID directory=BACKUP_DIR dumpfile=hanes_YYYYMMDD.dmp logfile=export.log'),sp(),
    p('권장 주기: 매일 1회 (새벽 2시)'),
    p('보관 기간: 최소 30일'),sp(),

    h2('6.2 \uD30C\uC77C \uBC31\uC5C5'),
    p('백업 대상:'),
    p('\u2022 .env 파일 (apps/backend/.env, apps/frontend/.env)',{indent:360}),
    p('\u2022 ecosystem.config.js',{indent:360}),
    p('\u2022 업로드 파일 (작업지도서 이미지 등)',{indent:360}),
    p('\u2022 로그 파일 (logs/ 폴더)',{indent:360}),
    sp(),
    tip('\u2139\uFE0F','소스 코드는 GitHub에 저장되므로 별도 백업 불필요',C.tip),sp(),

    h2('6.3 \uBCF5\uAD6C \uC808\uCC28'),
    p('1. PM2 프로세스 중지',{indent:360}),
    p('2. Oracle DB 복구: impdp 실행',{indent:360}),
    p('3. .env 파일 복원',{indent:360}),
    p('4. pnpm install && pnpm build',{indent:360}),
    p('5. PM2 프로세스 시작',{indent:360}),
    pb());

  // 7. 장애 대응
  body.push(h1('7. \uC7A5\uC560 \uB300\uC751'),
    h2('7.1 \uC77C\uBC18\uC801\uC778 \uC7A5\uC560'),
    tbl(['장애 유형','증상','원인','대응 방법'],[
      ['프론트엔드 접속 불가','브라우저에서 페이지 안 열림','PM2 프로세스 중지','pm2 restart hanes-frontend'],
      ['백엔드 API 에러','500 Internal Server Error','DB 연결 실패 또는 코드 오류','pm2 logs hanes-backend로 로그 확인'],
      ['DB 연결 실패','ORA-12541: TNS 에러','Oracle 서비스 중지 또는 네트워크','Oracle 서비스 상태 확인, .env DB설정 확인'],
      ['메모리 부족','프로세스 자동 재시작 반복','메모리 누수','pm2 monit로 메모리 확인, max_memory_restart=1G'],
      ['빌드 실패','pnpm build 에러','TypeScript 컴파일 에러','에러 메시지 확인 후 코드 수정'],
      ['배포 실패','GitHub Actions 실패','네트워크 또는 빌드 에러','GitHub Actions 로그 확인'],
    ],[1500,2000,2000,3526]),sp(),

    h2('7.2 \uC7A5\uC560 \uB300\uC751 \uC808\uCC28'),
    p('1. 장애 인지 (사용자 신고 또는 모니터링 알림)',{indent:360}),
    p('2. PM2 상태 확인: pm2 status',{indent:360}),
    p('3. 로그 확인: pm2 logs hanes-backend --lines 200',{indent:360}),
    p('4. 원인 파악 및 조치',{indent:360}),
    p('5. 서비스 정상화 확인',{indent:360}),
    p('6. 장애 보고서 작성',{indent:360}),
    pb());

  // 8. 정기 점검
  body.push(h1('8. \uC815\uAE30 \uC810\uAC80'),
    h2('8.1 \uC77C\uC77C \uC810\uAC80'),
    tbl(['점검 항목','확인 방법','기준'],[
      ['PM2 프로세스 상태','pm2 status','online 상태 확인'],
      ['로그 에러 확인','pm2 logs --err','에러 로그 없음'],
      ['디스크 사용량','dir C:\\Project\\HANES\\logs','로그 파일 크기 확인'],
      ['스케줄러 실행 확인','스케줄러 관리 > 로그','FAIL 건 없음'],
    ],[2500,3000,3526]),sp(),

    h2('8.2 \uC8FC\uAC04 \uC810\uAC80'),
    tbl(['점검 항목','확인 방법','기준'],[
      ['DB 백업 확인','백업 파일 존재 확인','최근 7일 백업 존재'],
      ['PM2 로그 정리','pm2 flush','로그 파일 크기 축소'],
      ['서버 자원 확인','작업 관리자','CPU/메모리/디스크 여유'],
    ],[2500,3000,3526]),sp(),

    h2('8.3 \uC6D4\uAC04 \uC810\uAC80'),
    tbl(['점검 항목','확인 방법','기준'],[
      ['Node.js/pnpm 버전','node -v, pnpm -v','보안 패치 적용'],
      ['의존성 취약점','pnpm audit','Critical/High 0건'],
      ['DB 테이블스페이스','Oracle DBA 확인','사용률 80% 이하'],
      ['SSL 인증서 만료','인증서 확인','만료 30일 전 갱신'],
    ],[2500,3000,3526]),
  );

  const bodySection={
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'HARNESS MES - \uC6B4\uC601\uC790 \uB9E4\uB274\uC5BC',font:'Arial',size:16,color:'999999'})]})]})},
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

async function main(){
  const doc=buildDoc();
  const buffer=await Packer.toBuffer(doc);
  fs.mkdirSync('exports/system',{recursive:true});
  const out='exports/system/운영자매뉴얼_2026-03-19.docx';
  fs.writeFileSync(out,buffer);
  console.log('Generated: '+out);
}
main().catch(console.error);
