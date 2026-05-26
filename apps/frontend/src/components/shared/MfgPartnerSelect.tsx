"use client";

/**
 * @file components/shared/MfgPartnerSelect.tsx
 * @description 제조사(PARTNER_TYPE='MFG') 선택 드롭다운
 *
 * 초보자 가이드:
 * - GET /master/partners?type=MFG&useYn=Y 결과를 컴포넌트 모듈 단위 캐시에 저장 후 옵션으로 노출
 * - required=true 이면서 미선택이면 빨간 테두리 표시
 */

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui';
import api from '@/services/api';

interface MfgPartner {
  partnerCode: string;
  partnerName: string;
}

interface MfgPartnerSelectProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

let cachedOptions: MfgPartner[] | null = null;

export default function MfgPartnerSelect({
  value, onChange, placeholder = '제조사 선택', required, disabled, fullWidth,
}: MfgPartnerSelectProps) {
  const [options, setOptions] = useState<MfgPartner[]>(cachedOptions ?? []);
  const [loading, setLoading] = useState(!cachedOptions);

  useEffect(() => {
    if (cachedOptions) return;
    let active = true;
    (async () => {
      try {
        // GET /master/partners 는 PartnerQueryDto 사용 (partnerType 키, useYn enum 검증)
        const res = await api.get('/master/partners', {
          params: { partnerType: 'MFG', useYn: 'Y', limit: 200 },
        });
        const raw = res.data?.data ?? res.data ?? [];
        const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        const data: MfgPartner[] = list.map((p: any) => ({
          partnerCode: p.partnerCode ?? p.PARTNER_CODE,
          partnerName: p.partnerName ?? p.PARTNER_NAME,
        })).filter((p) => p.partnerCode);
        if (active) {
          cachedOptions = data;
          setOptions(data);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={loading ? '로딩중...' : placeholder}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      options={options.map((p) => ({
        value: p.partnerCode,
        label: `${p.partnerCode} · ${p.partnerName}`,
      }))}
      className={required && !value ? 'border-red-500 focus:border-red-500' : ''}
    />
  );
}
