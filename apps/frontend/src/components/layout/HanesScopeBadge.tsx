"use client";

/**
 * @file src/components/layout/HanesScopeBadge.tsx
 * @description 상단바 범위 표시 (HANES 전용): 현재 회사/사업장 + 접속 DB.
 * @jisheng/ui AppShell 의 scopeBadge 칸에 들어간다.
 */
import { useEffect, useState } from "react";
import { Building, Database } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

interface DbInfo {
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
  connected: boolean;
}

export default function HanesScopeBadge() {
  const { selectedCompany, selectedPlant } = useAuthStore();
  /* 접속 DB 정보 (네비게이션 바 표시용) */
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);

  useEffect(() => {
    let active = true;
    api.get("/db-info")
      .then((res) => { if (active) setDbInfo(res.data?.data ?? res.data ?? null); })
      .catch(() => { if (active) setDbInfo(null); });
    return () => { active = false; };
  }, []);

  return (
    <>
      {/* 현재 회사 + 사업장 표시 */}
      {selectedCompany && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-md">
          <Building className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">
            {selectedCompany}{selectedPlant ? ` / ${selectedPlant}` : ''}
          </span>
        </div>
      )}

      {/* 접속 DB 정보 표시 (사업장 옆) */}
      {dbInfo?.database && (
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md"
          title={`${dbInfo.username ?? ''}@${dbInfo.host ?? ''}:${dbInfo.port ?? ''}`}
        >
          <Database className={`w-4 h-4 ${dbInfo.connected ? 'text-primary' : 'text-text-muted'}`} />
          <span className="text-xs font-medium text-text">
            {dbInfo.database}{dbInfo.host ? ` @ ${dbInfo.host}` : ''}
          </span>
        </div>
      )}
    </>
  );
}
