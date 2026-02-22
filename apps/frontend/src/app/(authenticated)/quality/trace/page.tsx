"use client";

/**
 * @file src/app/(authenticated)/quality/trace/page.tsx
 * @description 추적성조회 페이지 - 시리얼/LOT 번호로 4M 이력 조회
 *
 * 초보자 가이드:
 * 1. **검색**: 시리얼번호 또는 LOT번호로 검색
 * 2. **4M 이력**: Man(작업자), Machine(설비), Material(자재), Method(공법)
 * 3. **타임라인**: 공정별 이력을 시간순으로 표시
 * 4. API: GET /quality/trace?serial={serialNo}
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, User, Settings, Package, FileText, Clock, CheckCircle, XCircle, ChevronRight, Layers, History } from "lucide-react";
import { Card, CardHeader, CardContent, Button, Input } from "@/components/ui";
import api from "@/services/api";

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
  result: "PASS" | "FAIL" | "WORK";
  detail?: string;
}

interface FourMData {
  man: ManData[];
  machine: MachineData[];
  material: MaterialData[];
  method: MethodData[];
}

interface ManData { process: string; processName: string; operatorId: string; operatorName: string; timestamp: string; }
interface MachineData { process: string; processName: string; equipmentNo: string; equipmentName: string; timestamp: string; }
interface MaterialData { materialCode: string; materialName: string; lotNo: string; usedQty: number; unit: string; supplier: string; }
interface MethodData { process: string; processName: string; specName: string; specValue: string; actualValue: string; result: "OK" | "NG"; }

function TimelineItemComponent({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const resultConfig = {
    PASS: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500" },
    FAIL: { icon: XCircle, color: "text-red-500", bg: "bg-red-500" },
    WORK: { icon: Settings, color: "text-blue-500", bg: "bg-blue-500" },
  };
  const config = resultConfig[item.result];
  const Icon = config.icon;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg} text-white`}><Icon className="w-5 h-5" /></div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
      </div>
      <div className={`flex-1 pb-6`}>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-text">{item.processName}</span>
            <span className="text-sm text-text-muted">{item.timestamp}</span>
          </div>
          <div className="text-sm text-text-muted mb-2">{item.equipmentNo} / {item.operator}</div>
          {item.detail && <div className="text-sm text-text">{item.detail}</div>}
        </div>
      </div>
    </div>
  );
}

function FourMSection({ data, activeTab, setActiveTab, t }: { data: FourMData; activeTab: string; setActiveTab: (tab: string) => void; t: (key: string) => string }) {
  const tabs = [
    { id: "man", label: t("quality.trace.man"), icon: User },
    { id: "machine", label: t("quality.trace.machine"), icon: Settings },
    { id: "material", label: t("quality.trace.material"), icon: Package },
    { id: "method", label: t("quality.trace.method"), icon: FileText },
  ];

  return (
    <div>
      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? "text-primary border-b-2 border-primary" : "text-text-muted hover:text-text"}`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>
      <div className="p-4">
        {activeTab === "man" && (
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
        {activeTab === "machine" && (
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
        {activeTab === "material" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.materialCode")}</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.materialName")}</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.lotNo")}</th>
                  <th className="text-right py-2 px-3 text-text-muted font-medium">{t("quality.trace.usedQty")}</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.supplier")}</th>
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
        {activeTab === "method" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.processCol")}</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.inspectItem")}</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.spec")}</th>
                  <th className="text-left py-2 px-3 text-text-muted font-medium">{t("quality.trace.actualValue")}</th>
                  <th className="text-center py-2 px-3 text-text-muted font-medium">{t("quality.trace.resultCol")}</th>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${item.result === "OK" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>{item.result}</span>
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

export default function TracePage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [traceData, setTraceData] = useState<TraceRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("man");

  const handleSearch = useCallback(async () => {
    if (!searchValue.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get("/quality/trace", { params: { serial: searchValue.trim() } });
      setTraceData(res.data?.data ?? null);
    } catch {
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  }, [searchValue]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><History className="w-7 h-7 text-primary" />{t("quality.trace.title")}</h1>
          <p className="text-text-muted mt-1">{t("quality.trace.description")}</p>
        </div>
      </div>

      <Card><CardContent>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input placeholder={t("quality.trace.searchPlaceholder")} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} leftIcon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4 mr-1" /> {t("common.search")}
          </Button>
        </div>
      </CardContent></Card>

      {searched && !traceData && !loading && (
        <Card><CardContent>
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text mb-2">{t("quality.trace.noResults")}</h3>
            <p className="text-text-muted">{t("quality.trace.noResultsDesc")}</p>
          </div>
        </CardContent></Card>
      )}

      {traceData && (
        <>
          <Card>
            <CardHeader title={t("quality.trace.productInfo")} subtitle={t("quality.trace.productInfoSubtitle")} />
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div><div className="text-sm text-text-muted mb-1">{t("quality.trace.serialNo")}</div><div className="font-mono font-semibold text-primary">{traceData.serialNo}</div></div>
                <div><div className="text-sm text-text-muted mb-1">{t("quality.trace.lotNo")}</div><div className="font-mono text-text">{traceData.lotNo}</div></div>
                <div><div className="text-sm text-text-muted mb-1">{t("quality.trace.partNo")}</div><div className="text-text">{traceData.partNo}</div></div>
                <div><div className="text-sm text-text-muted mb-1">{t("quality.trace.partName")}</div><div className="text-text">{traceData.partName}</div></div>
                <div><div className="text-sm text-text-muted mb-1">{t("quality.trace.workOrderNo")}</div><div className="text-text">{traceData.workOrderNo}</div></div>
                <div><div className="text-sm text-text-muted mb-1">{t("quality.trace.productionDate")}</div><div className="text-text">{traceData.productionDate}</div></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title={t("quality.trace.processTimeline")} subtitle={t("quality.trace.processTimelineSubtitle")} action={<div className="flex items-center gap-1 text-xs text-text-muted"><Clock className="w-4 h-4" />{t("quality.trace.totalProcesses", { count: traceData.timeline.length })}</div>} />
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto pr-2">
                  {traceData.timeline.map((item, idx) => <TimelineItemComponent key={item.id} item={item} isLast={idx === traceData.timeline.length - 1} />)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title={t("quality.trace.fourMHistory")} subtitle="Man, Machine, Material, Method" action={<div className="flex items-center gap-1 text-xs text-text-muted"><Layers className="w-4 h-4" />{t("quality.trace.detailInfo")}</div>} />
              <CardContent className="p-0">
                <FourMSection data={traceData.fourM} activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!searched && (
        <Card><CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-8 h-8 text-primary" /></div>
            <h3 className="text-lg font-medium text-text mb-2">{t("quality.trace.enterSerialOrLot")}</h3>
            <p className="text-text-muted mb-4">{t("quality.trace.canCheckHistory")}</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-text-muted"><User className="w-4 h-4" /><span>{t("quality.trace.man")}</span></div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
              <div className="flex items-center gap-2 text-text-muted"><Settings className="w-4 h-4" /><span>{t("quality.trace.machine")}</span></div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
              <div className="flex items-center gap-2 text-text-muted"><Package className="w-4 h-4" /><span>{t("quality.trace.material")}</span></div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
              <div className="flex items-center gap-2 text-text-muted"><FileText className="w-4 h-4" /><span>{t("quality.trace.method")}</span></div>
            </div>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
