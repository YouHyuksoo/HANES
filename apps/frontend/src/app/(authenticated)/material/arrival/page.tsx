"use client";

/**
 * @file material/arrival/page.tsx
 * @description IQC005 — 자재 입하관리 (PO 라인 단위 메인 그리드)
 *
 * 초보자 가이드:
 * 1. PO 라인 그리드: 메인 영역. 행 클릭 또는 [자재입하] 버튼 → PoLineReceiptModal
 * 2. 저장 흐름: PoLineReceiptModal → SerialIssueConfirmModal → POST → MatLabelPreviewModal
 * 3. 4단계 행 배경: 미입하/일부입하/잔량0/CLOSE
 * 4. ManualArrivalModal은 유지 (별도 워크플로)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, RefreshCw, Plus, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import api from '@/services/api';
import PoLineGrid from './components/PoLineGrid';
import PoLineReceiptModal from './components/PoLineReceiptModal';
import SerialIssueConfirmModal from './components/SerialIssueConfirmModal';
import MatLabelPreviewModal from './components/MatLabelPreviewModal';
import ManualArrivalPanel from './components/ManualArrivalPanel';
import type { PoLineRow, PoLineReceiptInput, PoLineReceiptResponse } from './components/types';
import {
  LabelDesign,
  createDefaultLabelDesign,
  ensureObjectLabelDesign,
} from '../../master/label/types';

interface TemplateInfo {
  templateKey: string;
  templateName: string;
  category: string;
  printMode: string;
  designData: LabelDesign;
  isDefault?: boolean;
}

const DEFAULT_TEMPLATE_KEY = '__default__';

export default function ArrivalPage() {
  const { t } = useTranslation();

  // 데이터
  const [rows, setRows] = useState<PoLineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [poNo, setPoNo] = useState('');


  // 흐름 상태
  const [selectedLine, setSelectedLine] = useState<PoLineRow | null>(null);
  const [pendingInput, setPendingInput] = useState<{ input: PoLineReceiptInput; expectedCount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [labelData, setLabelData] = useState<PoLineReceiptResponse | null>(null);
  const [labelMeta, setLabelMeta] = useState<{ itemName?: string; receivedDate?: string; mfgPartnerLabel?: string }>({});
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign('mat_lot'));
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);

  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/arrivals/po-lines', {
        params: {
          ...(itemCode && { itemCode }),
          ...(poNo && { poNo }),
        },
      });
      setRows(res.data?.data ?? []);
    } catch { setRows([]); }
    setLoading(false);
  }, [itemCode, poNo]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/master/label-templates', { params: { category: 'mat_lot' } });
        const rawTemplates = res.data?.data ?? [];
        const nextTemplates: TemplateInfo[] = rawTemplates.map((tpl: {
          templateKey?: string;
          templateName: string;
          category: string;
          printMode?: string;
          designData: string | LabelDesign;
          isDefault?: boolean;
        }) => {
          const rawDesign = typeof tpl.designData === 'string' ? JSON.parse(tpl.designData) : tpl.designData;
          return {
            templateKey: tpl.templateKey ?? `${tpl.templateName}::${tpl.category}`,
            templateName: tpl.templateName,
            category: tpl.category,
            printMode: tpl.printMode ?? 'BROWSER',
            designData: ensureObjectLabelDesign(rawDesign, 'mat_lot'),
            isDefault: tpl.isDefault,
          };
        });
        if (cancelled) return;

        setTemplates(nextTemplates);
        const preferred = nextTemplates.find((item) => item.isDefault) ?? nextTemplates[0];
        if (!preferred) {
          setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
          setLabelDesign(createDefaultLabelDesign('mat_lot'));
          return;
        }
        const rawDesign = preferred.designData;
        setSelectedTemplateKey(preferred.templateKey);
        setLabelDesign(ensureObjectLabelDesign(rawDesign, 'mat_lot'));
      } catch {
        if (cancelled) return;
        setTemplates([]);
        setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
        setLabelDesign(createDefaultLabelDesign('mat_lot'));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const templateOptions = useMemo(() => [
    { value: DEFAULT_TEMPLATE_KEY, label: t('material.arrival.defaultDesign', '기본 디자인') },
    ...templates.map((tpl) => ({
      value: tpl.templateKey,
      label: `${tpl.templateName}${tpl.printMode ? ` / ${tpl.printMode}` : ''}`,
    })),
  ], [templates, t]);

  const handleTemplateChange = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === DEFAULT_TEMPLATE_KEY) {
      setLabelDesign(createDefaultLabelDesign('mat_lot'));
      return;
    }
    const tpl = templates.find((item) => item.templateKey === templateKey);
    if (!tpl) return;
    const rawDesign = tpl.designData;
    setLabelDesign(ensureObjectLabelDesign(rawDesign, 'mat_lot'));
  }, [templates]);

  const handleConfirmInput = (input: PoLineReceiptInput, expectedCount: number) => {
    setPendingInput({ input, expectedCount });
  };

  const handleSubmit = async () => {
    if (!pendingInput) return;
    setSubmitting(true);
    try {
      const res = await api.post('/material/arrivals/po-line', pendingInput.input);
      const data: PoLineReceiptResponse = res.data?.data;
      const enrichedSerials = (data?.serials ?? []).map((s) => ({
        matUid: s.matUid,
        initQty: s.initQty,
        arrivalSeq: s.arrivalSeq,
        itemCode: selectedLine?.itemCode ?? s.itemCode ?? '',
      }));
      setLabelMeta({
        itemName: selectedLine?.itemName,
        receivedDate: pendingInput.input.receivedDate,
        mfgPartnerLabel: pendingInput.input.mfgPartnerCode,
      });
      setLabelData({ ...data, serials: enrichedSerials });
      fetchLines();
      setPendingInput(null);
      setSelectedLine(null);
    } catch (err) {
      console.error('PO 라인 입하 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            {t('material.arrival.iqc005Title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.arrival.iqc005Description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-72">
            <Select
              aria-label={t('material.arrival.labelTemplate', '입하 라벨 템플릿')}
              options={templateOptions}
              value={selectedTemplateKey}
              onChange={handleTemplateChange}
              fullWidth
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchLines}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsManualOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('material.arrival.manualArrival')}
          </Button>
        </div>
      </div>

      {/* 그리드 + 수동입하 패널 */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <PoLineGrid
              data={rows}
              isLoading={loading}
              onSelectLine={setSelectedLine}
              toolbarLeft={
                <div className="flex gap-2 flex-1 min-w-0 items-center">
                  <Input
                    placeholder={t('common.partCode')}
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="w-44 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t('material.arrival.col.poNo')}
                      value={poNo}
                      onChange={(e) => setPoNo(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={fetchLines}>
                    <Search className="w-4 h-4 mr-1" />{t('common.search')}
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* 우측 수동입하 패널 */}
        {isManualOpen && (
          <div className="w-80 flex-shrink-0 border border-border rounded-xl bg-surface overflow-hidden flex flex-col">
            <ManualArrivalPanel
              onClose={() => setIsManualOpen(false)}
              onSuccess={() => { setIsManualOpen(false); fetchLines(); }}
            />
          </div>
        )}
      </div>

      {/* 1라인 입하 모달 */}
      <PoLineReceiptModal
        isOpen={!!selectedLine}
        line={selectedLine}
        onClose={() => setSelectedLine(null)}
        onConfirm={handleConfirmInput}
      />

      {/* 시리얼 발급 확인 */}
      <SerialIssueConfirmModal
        isOpen={!!pendingInput}
        expectedCount={pendingInput?.expectedCount ?? 0}
        onConfirm={handleSubmit}
        onCancel={() => setPendingInput(null)}
        submitting={submitting}
      />

      {/* 라벨 미리보기 */}
      <MatLabelPreviewModal
        isOpen={!!labelData}
        data={labelData}
        itemName={labelMeta.itemName}
        receivedDate={labelMeta.receivedDate}
        mfgPartnerLabel={labelMeta.mfgPartnerLabel}
        labelDesign={labelDesign}
        templateOptions={templateOptions}
        selectedTemplateKey={selectedTemplateKey}
        onTemplateChange={handleTemplateChange}
        onClose={() => setLabelData(null)}
      />

    </div>
  );
}
