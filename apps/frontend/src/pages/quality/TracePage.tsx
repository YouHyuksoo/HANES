/**
 * @file src/pages/quality/TracePage.tsx
 * @description 추적성조회 페이지 - 시리얼/LOT 번호로 4M 이력 조회
 *
 * 초보자 가이드:
 * 1. **검색**: 시리얼번호 또는 LOT번호로 검색
 * 2. **4M 이력**: Man(작업자), Machine(설비), Material(자재), Method(공법)
 * 3. **타임라인**: 공정별 이력을 시간순으로 표시
 */
import { useState, useMemo } from 'react';
import {
  Search,
  User,
  Settings,
  Package,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Layers,
  History,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input } from '@/components/ui';

// ========================================
// 타입 정의
// ========================================
interface TraceRecord {
  serialNo: string;
  lotNo: string;
  partNo: string;
  partName: string;
  workOrderNo: string;
  productionDate: string;
  timeline: TimelineItem[];
  fourM: FourMData;
}

interface TimelineItem {
  id: string;
  timestamp: string;
  process: string;
  processName: string;
  equipmentNo: string;
  operator: string;
  result: 'PASS' | 'FAIL' | 'WORK';
  detail?: string;
}

interface FourMData {
  man: ManData[];
  machine: MachineData[];
  material: MaterialData[];
  method: MethodData[];
}

interface ManData {
  process: string;
  processName: string;
  operatorId: string;
  operatorName: string;
  timestamp: string;
}

interface MachineData {
  process: string;
  processName: string;
  equipmentNo: string;
  equipmentName: string;
  timestamp: string;
}

interface MaterialData {
  materialCode: string;
  materialName: string;
  lotNo: string;
  usedQty: number;
  unit: string;
  supplier: string;
}

interface MethodData {
  process: string;
  processName: string;
  specName: string;
  specValue: string;
  actualValue: string;
  result: 'OK' | 'NG';
}

// ========================================
// Mock 데이터
// ========================================
const mockTraceData: Record<string, TraceRecord> = {
  'SN-2024011500001': {
    serialNo: 'SN-2024011500001',
    lotNo: 'LOT-20240115-A01',
    partNo: 'HARNESS-001',
    partName: '메인 와이어 하네스',
    workOrderNo: 'WO-2024-0115-001',
    productionDate: '2024-01-15',
    timeline: [
      {
        id: 'T1',
        timestamp: '2024-01-15 08:00:00',
        process: 'CUT',
        processName: '절단',
        equipmentNo: 'CUT-01',
        operator: '김철수',
        result: 'WORK',
        detail: '전선 절단 완료 (길이: 500mm)',
      },
      {
        id: 'T2',
        timestamp: '2024-01-15 08:15:00',
        process: 'CRM',
        processName: '압착',
        equipmentNo: 'CRM-02',
        operator: '이영희',
        result: 'WORK',
        detail: '터미널 압착 완료',
      },
      {
        id: 'T3',
        timestamp: '2024-01-15 08:30:00',
        process: 'ASM',
        processName: '조립',
        equipmentNo: 'ASM-01',
        operator: '박민수',
        result: 'WORK',
        detail: '커넥터 조립 완료',
      },
      {
        id: 'T4',
        timestamp: '2024-01-15 08:45:00',
        process: 'INS',
        processName: '통전검사',
        equipmentNo: 'INS-01',
        operator: '정수진',
        result: 'PASS',
        detail: '통전검사 합격',
      },
      {
        id: 'T5',
        timestamp: '2024-01-15 09:00:00',
        process: 'PKG',
        processName: '포장',
        equipmentNo: 'PKG-01',
        operator: '최동훈',
        result: 'WORK',
        detail: '포장 완료',
      },
    ],
    fourM: {
      man: [
        { process: 'CUT', processName: '절단', operatorId: 'EMP001', operatorName: '김철수', timestamp: '2024-01-15 08:00:00' },
        { process: 'CRM', processName: '압착', operatorId: 'EMP002', operatorName: '이영희', timestamp: '2024-01-15 08:15:00' },
        { process: 'ASM', processName: '조립', operatorId: 'EMP003', operatorName: '박민수', timestamp: '2024-01-15 08:30:00' },
        { process: 'INS', processName: '통전검사', operatorId: 'EMP004', operatorName: '정수진', timestamp: '2024-01-15 08:45:00' },
        { process: 'PKG', processName: '포장', operatorId: 'EMP005', operatorName: '최동훈', timestamp: '2024-01-15 09:00:00' },
      ],
      machine: [
        { process: 'CUT', processName: '절단', equipmentNo: 'CUT-01', equipmentName: '자동절단기 #1', timestamp: '2024-01-15 08:00:00' },
        { process: 'CRM', processName: '압착', equipmentNo: 'CRM-02', equipmentName: '압착기 #2', timestamp: '2024-01-15 08:15:00' },
        { process: 'ASM', processName: '조립', equipmentNo: 'ASM-01', equipmentName: '조립대 #1', timestamp: '2024-01-15 08:30:00' },
        { process: 'INS', processName: '통전검사', equipmentNo: 'INS-01', equipmentName: '통전검사기 #1', timestamp: '2024-01-15 08:45:00' },
        { process: 'PKG', processName: '포장', equipmentNo: 'PKG-01', equipmentName: '포장대 #1', timestamp: '2024-01-15 09:00:00' },
      ],
      material: [
        { materialCode: 'WIRE-001', materialName: 'AVS 0.5sq 흑색', lotNo: 'LOT-W-20240110-001', usedQty: 0.5, unit: 'm', supplier: '대한전선' },
        { materialCode: 'TERM-001', materialName: '250형 터미널', lotNo: 'LOT-T-20240112-002', usedQty: 2, unit: 'EA', supplier: '한국단자' },
        { materialCode: 'CONN-001', materialName: '6P 커넥터', lotNo: 'LOT-C-20240113-001', usedQty: 1, unit: 'EA', supplier: '삼성커넥터' },
        { materialCode: 'TUBE-001', materialName: '수축튜브 3mm', lotNo: 'LOT-U-20240114-003', usedQty: 30, unit: 'mm', supplier: '열수축' },
      ],
      method: [
        { process: 'CUT', processName: '절단', specName: '절단길이', specValue: '500 +/- 1mm', actualValue: '500.2mm', result: 'OK' },
        { process: 'CRM', processName: '압착', specName: '압착높이', specValue: '2.0 +/- 0.1mm', actualValue: '2.05mm', result: 'OK' },
        { process: 'CRM', processName: '압착', specName: '인장강도', specValue: '>= 40N', actualValue: '52N', result: 'OK' },
        { process: 'INS', processName: '통전검사', specName: '저항값', specValue: '<= 50mOhm', actualValue: '32mOhm', result: 'OK' },
      ],
    },
  },
};

// ========================================
// 타임라인 아이템 컴포넌트
// ========================================
function TimelineItemComponent({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const resultConfig = {
    PASS: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500' },
    FAIL: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
    WORK: { icon: Settings, color: 'text-blue-500', bg: 'bg-blue-500' },
  };

  const config = resultConfig[item.result];
  const Icon = config.icon;

  return (
    <div className="flex gap-4">
      {/* 타임라인 라인 */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg} text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
      </div>

      {/* 내용 */}
      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-text">{item.processName}</span>
            <span className="text-sm text-text-muted">{item.timestamp}</span>
          </div>
          <div className="text-sm text-text-muted mb-2">
            설비: {item.equipmentNo} / 작업자: {item.operator}
          </div>
          {item.detail && (
            <div className="text-sm text-text">{item.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// 4M 탭 컴포넌트
// ========================================
function FourMSection({ data, activeTab, setActiveTab }: { data: FourMData; activeTab: string; setActiveTab: (tab: string) => void }) {
  const tabs = [
    { id: 'man', label: 'Man (작업자)', icon: User },
    { id: 'machine', label: 'Machine (설비)', icon: Settings },
    { id: 'material', label: 'Material (자재)', icon: Package },
    { id: 'method', label: 'Method (공법)', icon: FileText },
  ];

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 내용 */}
      <div className="p-4">
        {activeTab === 'man' && (
          <div className="space-y-3">
            {data.man.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-background rounded-lg">
                <User className="w-8 h-8 text-primary p-1.5 bg-primary/10 rounded-full" />
                <div className="flex-1">
                  <div className="font-medium text-text">{item.operatorName}</div>
                  <div className="text-sm text-text-muted">{item.operatorId}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text">{item.processName}</div>
                  <div className="text-xs text-text-muted">{item.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'machine' && (
          <div className="space-y-3">
            {data.machine.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-background rounded-lg">
                <Settings className="w-8 h-8 text-secondary p-1.5 bg-secondary/10 rounded-full" />
                <div className="flex-1">
                  <div className="font-medium text-text">{item.equipmentName}</div>
                  <div className="text-sm text-text-muted">{item.equipmentNo}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text">{item.processName}</div>
                  <div className="text-xs text-text-muted">{item.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'material' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text-muted font-medium">자재코드</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">자재명</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">LOT번호</th>
                  <th className="text-right py-2 px-3 text-text-muted font-medium">사용량</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">공급처</th>
                </tr>
              </thead>
              <tbody>
                {data.material.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 font-mono text-primary">{item.materialCode}</td>
                    <td className="py-2 px-3 text-text">{item.materialName}</td>
                    <td className="py-2 px-3 font-mono text-text-muted text-xs">{item.lotNo}</td>
                    <td className="py-2 px-3 text-right text-text">{item.usedQty} {item.unit}</td>
                    <td className="py-2 px-3 text-text">{item.supplier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'method' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text-muted font-medium">공정</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">검사항목</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">스펙</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">실측값</th>
                  <th className="text-center py-2 px-3 text-text-muted font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {data.method.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 text-text">{item.processName}</td>
                    <td className="py-2 px-3 text-text">{item.specName}</td>
                    <td className="py-2 px-3 text-text-muted">{item.specValue}</td>
                    <td className="py-2 px-3 font-mono text-text">{item.actualValue}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                        item.result === 'OK'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {item.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// 메인 컴포넌트
// ========================================
function TracePage() {
  // 상태 관리
  const [searchValue, setSearchValue] = useState('');
  const [searchedSerial, setSearchedSerial] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('man');

  // 검색 결과
  const traceData = useMemo(() => {
    if (!searchedSerial) return null;
    return mockTraceData[searchedSerial] || null;
  }, [searchedSerial]);

  // 검색 실행
  const handleSearch = () => {
    if (searchValue.trim()) {
      setSearchedSerial(searchValue.trim());
    }
  };

  // 예시 검색
  const handleExampleSearch = () => {
    setSearchValue('SN-2024011500001');
    setSearchedSerial('SN-2024011500001');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><History className="w-7 h-7 text-primary" />추적성조회</h1>
          <p className="text-text-muted mt-1">시리얼번호 또는 LOT번호로 4M 이력을 조회합니다.</p>
        </div>
      </div>

      {/* 검색 영역 */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="시리얼번호 또는 LOT번호를 입력하세요"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-1" /> 조회
            </Button>
            <Button variant="secondary" onClick={handleExampleSearch}>
              예시 조회
            </Button>
          </div>

          {/* 최근 검색 */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <History className="w-4 h-4 text-text-muted" />
            <span className="text-text-muted">최근 검색:</span>
            <button
              onClick={() => {
                setSearchValue('SN-2024011500001');
                setSearchedSerial('SN-2024011500001');
              }}
              className="text-primary hover:underline"
            >
              SN-2024011500001
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 검색 결과 없음 */}
      {searchedSerial && !traceData && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text mb-2">검색 결과가 없습니다</h3>
              <p className="text-text-muted">
                "{searchedSerial}"에 대한 이력을 찾을 수 없습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 검색 결과 */}
      {traceData && (
        <>
          {/* 제품 정보 */}
          <Card>
            <CardHeader
              title="제품 정보"
              subtitle="조회된 제품의 기본 정보입니다"
            />
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-text-muted mb-1">시리얼번호</div>
                  <div className="font-mono font-semibold text-primary">{traceData.serialNo}</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted mb-1">LOT번호</div>
                  <div className="font-mono text-text">{traceData.lotNo}</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted mb-1">품번</div>
                  <div className="text-text">{traceData.partNo}</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted mb-1">품명</div>
                  <div className="text-text">{traceData.partName}</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted mb-1">작업지시번호</div>
                  <div className="text-text">{traceData.workOrderNo}</div>
                </div>
                <div>
                  <div className="text-sm text-text-muted mb-1">생산일자</div>
                  <div className="text-text">{traceData.productionDate}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 공정 타임라인 */}
            <Card>
              <CardHeader
                title="공정 타임라인"
                subtitle="제조 공정별 이력"
                action={
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Clock className="w-4 h-4" />
                    총 {traceData.timeline.length}개 공정
                  </div>
                }
              />
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto pr-2">
                  {traceData.timeline.map((item, idx) => (
                    <TimelineItemComponent
                      key={item.id}
                      item={item}
                      isLast={idx === traceData.timeline.length - 1}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 4M 정보 */}
            <Card>
              <CardHeader
                title="4M 이력"
                subtitle="Man, Machine, Material, Method"
                action={
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Layers className="w-4 h-4" />
                    상세 정보
                  </div>
                }
              />
              <CardContent className="p-0">
                <FourMSection
                  data={traceData.fourM}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 검색 전 안내 */}
      {!searchedSerial && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium text-text mb-2">시리얼번호 또는 LOT번호를 입력하세요</h3>
              <p className="text-text-muted mb-4">
                제품의 전체 제조 이력과 4M 정보를 확인할 수 있습니다.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-text-muted">
                  <User className="w-4 h-4" />
                  <span>Man (작업자)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
                <div className="flex items-center gap-2 text-text-muted">
                  <Settings className="w-4 h-4" />
                  <span>Machine (설비)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
                <div className="flex items-center gap-2 text-text-muted">
                  <Package className="w-4 h-4" />
                  <span>Material (자재)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
                <div className="flex items-center gap-2 text-text-muted">
                  <FileText className="w-4 h-4" />
                  <span>Method (공법)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TracePage;
