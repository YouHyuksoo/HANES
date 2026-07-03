'use client';

import { useEffect, useMemo, useState } from 'react';
import bwipjs from 'bwip-js';
import { formatDateOnly } from '@/utils/date';

export const MATERIAL_ARRIVAL_LABEL_WIDTH_MM = 80;
export const MATERIAL_ARRIVAL_LABEL_HEIGHT_MM = 40;

export interface MaterialArrivalLabelItem {
  matUid: string;
  itemCode: string;
  itemName?: string | null;
  qty?: number | null;
  unit?: string | null;
  vendor?: string | null;
  arrivalDate?: string | Date | null;
  lotNo?: string | null;
  spec?: string | null;
  productionType?: string | null;
  chargeType?: string | null;
}

interface MaterialArrivalLabelProps {
  item: MaterialArrivalLabelItem;
}

function formatDate(value?: string | Date | null) {
  return formatDateOnly(value);
}

function formatQtyUnit(item: MaterialArrivalLabelItem) {
  const qty = item.qty ?? '';
  const unit = item.unit || 'EA';
  return qty === '' ? unit : `${qty} ${unit}`;
}

function QrCodeImage({ value }: { value: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!value) {
      setSrc('');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: value,
        scale: 3,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      });
      setSrc(canvas.toDataURL('image/png'));
    } catch {
      setSrc('');
    }
  }, [value]);

  if (!src) {
    return <div style={{ width: '100%', height: '100%', background: '#f8fafc' }} />;
  }

  return (
    <img
      src={src}
      alt=""
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
}

export default function MaterialArrivalLabel({ item }: MaterialArrivalLabelProps) {
  const dateText = formatDate(item.arrivalDate);
  const qtyUnit = formatQtyUnit(item);
  const specLines = useMemo(() => {
    const text = [item.itemName, item.spec].filter(Boolean).join('  ');
    return text || '-';
  }, [item.itemName, item.spec]);

  return (
    <div
      className="material-arrival-label"
      style={{
        width: `${MATERIAL_ARRIVAL_LABEL_WIDTH_MM}mm`,
        height: `${MATERIAL_ARRIVAL_LABEL_HEIGHT_MM}mm`,
        boxSizing: 'border-box',
        border: '1px solid #475569',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: 'Arial, "Malgun Gothic", sans-serif',
        position: 'relative',
        overflow: 'hidden',
        padding: '3.1mm 2.5mm 2.4mm 2.5mm',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '2.7mm',
          top: '3.1mm',
          width: '17.5mm',
          height: '17.5mm',
        }}
      >
        <QrCodeImage value={item.matUid} />
      </div>

      <div style={{ marginLeft: '20.6mm', marginRight: '14.5mm', minWidth: 0 }}>
        <div
          style={{
            fontSize: '3.3mm',
            lineHeight: '3.9mm',
            fontWeight: 800,
            color: '#020617',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.itemCode || '-'} / {qtyUnit}
        </div>
        <div
          style={{
            marginTop: '1.4mm',
            fontSize: '2.4mm',
            lineHeight: '3.0mm',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.vendor || '-'}
        </div>
        <div style={{ marginTop: '1.5mm', fontSize: '2.5mm', lineHeight: '3.2mm' }}>
          <b>IN</b> : {dateText || '-'}
        </div>
        <div
          style={{
            fontSize: '2.4mm',
            lineHeight: '3.1mm',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <b>SERIAL</b> : {item.matUid || '-'}
        </div>
        <div
          style={{
            fontSize: '2.4mm',
            lineHeight: '3.1mm',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <b>LOT</b> <span style={{ display: 'inline-block', width: '3.1mm' }} />: {item.lotNo || '-'}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: '2.4mm',
          top: '3.4mm',
          display: 'flex',
          gap: '1mm',
          alignItems: 'center',
          fontSize: '2.6mm',
          lineHeight: '3.7mm',
          fontWeight: 800,
          color: '#020617',
        }}
      >
        <span>{item.productionType || 'MP'}</span>
        <span
          style={{
            minWidth: '8.8mm',
            height: '4.2mm',
            padding: '0 1mm',
            background: '#000',
            color: '#fff',
            textAlign: 'center',
          }}
        >
          {item.chargeType || 'CM'}
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '2.7mm',
          right: '29mm',
          bottom: '2.2mm',
          fontSize: '2.5mm',
          lineHeight: '3.05mm',
          color: '#1e293b',
          whiteSpace: 'pre-line',
          overflow: 'hidden',
          maxHeight: '10.8mm',
        }}
      >
        {specLines}
      </div>
    </div>
  );
}
