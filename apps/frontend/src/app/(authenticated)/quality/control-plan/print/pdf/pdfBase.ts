import type { jsPDF } from 'jspdf';

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer); let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

export async function loadNotoSansKrFont(doc: jsPDF) {
  const [regular, bold] = await Promise.all([fetch('/fonts/NotoSansKR-Regular.ttf').then((res) => res.arrayBuffer()), fetch('/fonts/NotoSansKR-Bold.ttf').then((res) => res.arrayBuffer())]);
  doc.addFileToVFS('NotoSansKR-Regular.ttf', toBase64(regular));
  doc.addFileToVFS('NotoSansKR-Bold.ttf', toBase64(bold));
  doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal', 'Identity-H');
  doc.addFont('NotoSansKR-Bold.ttf', 'NotoSansKR', 'bold', 'Identity-H');
  doc.setFont('NotoSansKR', 'normal');
}

export interface OfficialHeader { title: string; documentNo: string; revision: string; formNo: string; itemCode: string; itemName: string; project: string; customer: string; phase: string; issueDate: string; author: string; publisher: string; }

export function drawFormTitle(doc: jsPDF, title: string, attachment: string, width: number) {
  doc.setFont('NotoSansKR', 'normal'); doc.setFontSize(7); doc.text(attachment, 8, 8);
  doc.setFont('NotoSansKR', 'bold'); doc.setFontSize(14); doc.text(title, width / 2, 11, { align: 'center' });
}

export function drawInfoGrid(doc: jsPDF, rows: string[][], width: number, startY = 14, rowHeight = 5) {
  const left = 8; const usable = width - 16;
  doc.setLineWidth(0.18); doc.setDrawColor(75, 75, 75); doc.setFontSize(6.3);
  rows.forEach((cells, rowIndex) => {
    const pairs = cells.length / 2; const pairWidth = usable / pairs; const y = startY + rowIndex * rowHeight;
    for (let pair = 0; pair < pairs; pair += 1) {
      const x = left + pair * pairWidth; const labelWidth = Math.min(30, pairWidth * 0.38);
      doc.setFillColor(242, 242, 242); doc.rect(x, y, labelWidth, rowHeight, 'FD');
      doc.rect(x + labelWidth, y, pairWidth - labelWidth, rowHeight);
      doc.setFont('NotoSansKR', 'normal'); doc.text(cells[pair * 2], x + 1, y + 3.3);
      doc.text(cells[pair * 2 + 1] || '', x + labelWidth + 1, y + 3.3);
    }
  });
}

export function addPageFooters(doc: jsPDF, formNo: string, revision = '00', paper = '') {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) { doc.setPage(page); const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight(); doc.setFont('NotoSansKR', 'normal'); doc.setFontSize(7); doc.text(`${formNo}  REV. ${revision}`, 8, height - 5); doc.text(`${page} / ${total}`, width / 2, height - 5, { align: 'center' }); if (paper) doc.text(paper, width - 8, height - 5, { align: 'right' }); }
}

export function padTableRows(rows: string[][], columnCount: number, minimumRows: number) {
  return [...rows, ...Array.from({ length: Math.max(0, minimumRows - rows.length) }, () => Array(columnCount).fill(''))];
}
