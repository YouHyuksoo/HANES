"use client";

/**
 * @file src/pages/interface/ManualPage.tsx
 * @description ERP 인터페이스 수동 전송 페이지
 */
import { useState } from 'react';
import { Send, RefreshCw, ArrowDownCircle, ArrowUpCircle, FileText, Package, Clipboard, Database } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';

interface TransferOption {
  id: string;
  direction: string;
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const inboundOptions: TransferOption[] = [
  {
    id: 'job_order',
    direction: 'IN',
    type: 'JOB_ORDER',
    name: '작업지시 수신',
    description: 'ERP에서 작업지시 데이터를 수신합니다.',
    icon: <FileText className="w-6 h-6" />,
  },
  {
    id: 'bom_sync',
    direction: 'IN',
    type: 'BOM_SYNC',
    name: 'BOM 동기화',
    description: 'ERP에서 BOM 정보를 동기화합니다.',
    icon: <Clipboard className="w-6 h-6" />,
  },
  {
    id: 'part_sync',
    direction: 'IN',
    type: 'PART_SYNC',
    name: '품목 마스터 동기화',
    description: 'ERP에서 품목 마스터를 동기화합니다.',
    icon: <Database className="w-6 h-6" />,
  },
];

const outboundOptions: TransferOption[] = [
  {
    id: 'prod_result',
    direction: 'OUT',
    type: 'PROD_RESULT',
    name: '생산실적 전송',
    description: 'MES 생산실적을 ERP로 전송합니다.',
    icon: <Package className="w-6 h-6" />,
  },
  {
    id: 'stock_sync',
    direction: 'OUT',
    type: 'STOCK_SYNC',
    name: '재고 동기화',
    description: 'MES 재고 정보를 ERP로 전송합니다.',
    icon: <Database className="w-6 h-6" />,
  },
];

function InterfaceManualPage() {
  const [selectedOption, setSelectedOption] = useState<TransferOption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTransfer = async () => {
    if (!selectedOption) return;

    setIsProcessing(true);
    setResult(null);

    // 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsProcessing(false);
    setResult({
      success: Math.random() > 0.2,
      message: Math.random() > 0.2
        ? `${selectedOption.name} 처리가 완료되었습니다. (3건 처리됨)`
        : 'ERP 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Send className="w-7 h-7 text-primary" />수동 전송</h1>
          <p className="text-text-muted mt-1">ERP 연동 데이터를 수동으로 전송합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Inbound 옵션 */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="w-5 h-5 text-blue-500" /><span className="font-medium text-text">수신 (Inbound)</span></div>
            <p className="text-sm text-text-muted mb-3">ERP → MES 데이터 수신</p>
            <div className="space-y-3">
              {inboundOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedOption?.id === option.id
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedOption?.id === option.id
                        ? 'bg-primary text-white'
                        : 'bg-surface text-primary'
                    }`}>
                      {option.icon}
                    </div>
                    <div>
                      <p className="font-medium text-text">{option.name}</p>
                      <p className="text-sm text-text-muted mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Outbound 옵션 */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="w-5 h-5 text-purple-500" /><span className="font-medium text-text">송신 (Outbound)</span></div>
            <p className="text-sm text-text-muted mb-3">MES → ERP 데이터 전송</p>
            <div className="space-y-3">
              {outboundOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedOption?.id === option.id
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedOption?.id === option.id
                        ? 'bg-primary text-white'
                        : 'bg-surface text-primary'
                    }`}>
                      {option.icon}
                    </div>
                    <div>
                      <p className="font-medium text-text">{option.name}</p>
                      <p className="text-sm text-text-muted mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 선택된 옵션 상세 */}
      {selectedOption && (
        <Card>
          <CardContent>
            <div className="font-medium text-text mb-1">{selectedOption.name} 실행</div>
            <p className="text-sm text-text-muted mb-4">{selectedOption.description}</p>
            <div className="space-y-4">
              {/* 옵션별 추가 설정 */}
              {selectedOption.type === 'JOB_ORDER' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="계획일 (시작)" type="date" fullWidth />
                  <Input label="계획일 (종료)" type="date" fullWidth />
                </div>
              )}

              {selectedOption.type === 'PROD_RESULT' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="생산일 (시작)" type="date" fullWidth />
                  <Input label="생산일 (종료)" type="date" fullWidth />
                  <Select
                    label="전송 범위"
                    options={[
                      { value: 'all', label: '전체 미전송 실적' },
                      { value: 'today', label: '오늘 실적만' },
                      { value: 'selected', label: '선택 실적만' },
                    ]}
                    fullWidth
                  />
                </div>
              )}

              {selectedOption.type === 'BOM_SYNC' && (
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-text-muted">
                    ERP에서 변경된 BOM 정보를 모두 가져옵니다.
                    기존 BOM과 동일한 경우 업데이트하지 않습니다.
                  </p>
                </div>
              )}

              {selectedOption.type === 'PART_SYNC' && (
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-text-muted">
                    ERP에서 신규/변경된 품목 마스터를 가져옵니다.
                    기존 품목은 정보가 업데이트됩니다.
                  </p>
                </div>
              )}

              {/* 결과 메시지 */}
              {result && (
                <div className={`p-4 rounded-lg ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-sm ${
                    result.success
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    {result.message}
                  </p>
                </div>
              )}

              {/* 실행 버튼 */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setSelectedOption(null)}>
                  취소
                </Button>
                <Button onClick={handleTransfer} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> 처리중...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" /> 전송 실행
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default InterfaceManualPage;
