'use client';

import { documentHeader, getText, type QualityPlanPrintModel } from '../print/controlPlanPrintModel';

const widths = ['3%','3%','3%','4%','7%','9%','3%','7%','7%','4%','10%','8%','4%','5%','9%','3%','10%','9%'];

const dateText = (value: string) => value ? value.slice(0, 10) : '-';
const cell = 'border border-black px-1.5 py-1 align-middle';
const head = `${cell} bg-[#f2f2f2] text-center font-medium`;

export default function ControlPlanDocumentPreview({ model }: { model: QualityPlanPrintModel }) {
  const header = documentHeader(model, 'CONTROL_PLAN');
  const document = model.documents.find((row) => getText(row, 'DOCUMENT_TYPE') === 'CONTROL_PLAN');
  const participants = model.participants
    .map((row) => [getText(row, 'ORGANIZATION'), getText(row, 'USER_NAME')].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' · ');
  const rows = model.controlPlanRows.length ? model.controlPlanRows : [{}];

  const flowMark = (row: Record<string, unknown>, lane: string) => {
    if (getText(row, 'FLOW_LANE') !== lane) return '';
    return getText(row, 'FLOW_SYMBOL') === 'INSPECTION' ? '◎' : '○';
  };

  return (
    <div className="h-[320px] w-full max-w-full overflow-scroll [scrollbar-gutter:stable_both-edges]">
      <article
        aria-label="Control Plan A3 출력 미리보기"
        className="min-w-[1500px] border border-slate-300 bg-white p-6 text-black shadow-sm"
        style={{ aspectRatio: '420 / 297' }}
      >
        <h3 className="mb-3 text-center text-xl font-medium tracking-[0.08em]">CONTROL PLAN</h3>
        <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
          <colgroup>
            {['9%','13%','7%','6%','10%','17%','10%','15%','8%','15%'].map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
          <tbody>
            <tr><td className={`${head}`}>Document No.</td><td className={cell}>{header.documentNo || '-'}</td><td className={head}>REV. No.</td><td className={cell}>{header.revision || '-'}</td><td className={head}>Project Name</td><td className={cell}>{header.project || '-'}</td><td className={head}>Phase Covered</td><td className={cell}>{header.phase || '-'}</td><td className={head}>Prepared by/Date</td><td className={cell}>{`${header.author || '-'} / ${dateText(header.issueDate)}`}</td></tr>
            <tr><td className={head}>Issue Date</td><td className={cell} colSpan={3}>{dateText(header.issueDate)}</td><td className={head}>Part No.</td><td className={cell}>{getText(model.package, 'PART_NUMBER') || header.itemCode || '-'}</td><td className={head}>Organization/Site</td><td className={cell}>{getText(model.package, 'ORGANIZATION') || `${getText(model.package, 'COMPANY')} / ${getText(model.package, 'PLANT_CD')}`}</td><td className={head}>Verified by/Date</td><td className={cell}>-</td></tr>
            <tr><td className={head}>Revision Date</td><td className={cell} colSpan={3}>{dateText(getText(document, 'REVISION_DATE'))}</td><td className={head}>Part Name</td><td className={cell}>{header.itemName || '-'}</td><td className={head}>Key Contact</td><td className={cell}>{getText(model.package, 'KEY_CONTACT') || '-'}</td><td className={head}>Approved by/Date</td><td className={cell}>-</td></tr>
            <tr><td className={head}>Customer</td><td className={cell} colSpan={3}>{header.customer || '-'}</td><td className={head}>Latest Change Level</td><td className={cell}>{getText(model.package, 'LATEST_CHANGE_LEVEL') || '-'}</td><td className={head}>CFT/Area Responsible</td><td className={cell} colSpan={3}>{participants || '-'}</td></tr>
            <tr><td className={`${cell} text-center`} colSpan={4}>Customer Engineering Approval/Date (If Req&apos;D): N/A</td><td className={`${cell} text-center`} colSpan={3}>Customer Quality Approval/Date (If Req&apos;D): N/A</td><td className={`${cell} text-center`} colSpan={3}>Other Approval/Date (If Req&apos;D): N/A</td></tr>
          </tbody>
        </table>
        <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
          <colgroup>{widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
          <thead>
            <tr><th className={head} rowSpan={3}>Process<br/>No.</th><th className={head} colSpan={3}>Process flow</th><th className={head} rowSpan={3}>Process Name</th><th className={head} rowSpan={3}>Machines/Jigs<br/>Fixtures/Tools</th><th className={head} colSpan={3}>Control Characteristics</th><th className={head} rowSpan={3}>Special<br/>Characteristics</th><th className={head} colSpan={5}>Method</th><th className={head} colSpan={2}>Reaction Plan</th><th className={head} rowSpan={3}>Document<br/>(Record)</th></tr>
            <tr><th className={head} rowSpan={2}>Sub</th><th className={head} rowSpan={2}>Main</th><th className={head} rowSpan={2}>Out<br/>Sourcing</th><th className={head} rowSpan={2}>No.</th><th className={head} rowSpan={2}>Product</th><th className={head} rowSpan={2}>Process</th><th className={head} rowSpan={2}>Specification<br/>/Tolerance</th><th className={head} rowSpan={2}>Evaluation Measurement<br/>Technique</th><th className={head} colSpan={2}>Sample</th><th className={head} rowSpan={2}>Control Method<br/>(Error Proofing)</th><th className={head} rowSpan={2}>Contact</th><th className={head} rowSpan={2}>Corrective action</th></tr>
            <tr><th className={head}>Size</th><th className={head}>Freq.</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => <tr key={getText(row, 'ROW_ID') || index} className="h-11">
              <td className={cell}>{getText(row, 'PROCESS_NO')}</td><td className={`${cell} text-center text-base`}>{flowMark(row, 'SUB')}</td><td className={`${cell} text-center text-base`}>{flowMark(row, 'MAIN')}</td><td className={`${cell} text-center text-base`}>{flowMark(row, 'OUTSOURCING')}</td><td className={cell}>{getText(row, 'PROCESS_NAME')}</td><td className={cell}>{getText(row, 'EQUIPMENT_NAME')}</td><td className={cell}>{getText(row, 'CHARACTERISTIC_NO') || String(index + 1)}</td><td className={cell}>{getText(row, 'PRODUCT_CHARACTERISTIC')}</td><td className={cell}>{getText(row, 'PROCESS_CHARACTERISTIC')}</td><td className={`${cell} text-center font-medium`}>{getText(row, 'SPECIAL_CHAR_CODE')}</td><td className={cell}>{getText(row, 'SPECIFICATION')}</td><td className={cell}>{getText(row, 'EVALUATION_METHOD')}</td><td className={cell}>{getText(row, 'SAMPLE_SIZE')}</td><td className={cell}>{getText(row, 'SAMPLE_FREQUENCY')}</td><td className={cell}>{getText(row, 'CONTROL_METHOD')}</td><td className={cell}>{getText(row, 'RESPONSIBLE_ROLE')}</td><td className={cell}>{getText(row, 'REACTION_PLAN')}</td><td className={cell}>{getText(row, 'RECORD_FORM')}</td>
            </tr>)}
          </tbody>
        </table>
        <footer className="mt-4 flex justify-between text-[10px]"><span>QREKA-PR-025-04 REV.00 기반 HANES 전산양식</span><strong>1 / 1</strong><span>A3 (420 mm × 297 mm)</span></footer>
      </article>
    </div>
  );
}
