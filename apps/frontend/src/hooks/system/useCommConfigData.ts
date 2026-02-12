/**
 * @file src/hooks/system/useCommConfigData.ts
 * @description 통신설정 CRUD 데이터 훅
 *
 * 초보자 가이드:
 * 1. **useCommConfigData**: 통신설정 페이지 전용 (목록/CRUD/필터/통계)
 * 2. **useCommConfigsByType**: 다른 페이지에서 유형별 드롭다운 용도
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import api from "@/services/api";

/** 통신설정 데이터 인터페이스 */
export interface CommConfig {
  id: string;
  configName: string;
  commType: string;
  description?: string;
  host?: string;
  port?: number;
  portName?: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: string;
  parity?: string;
  flowControl?: string;
  extraConfig?: Record<string, unknown>;
  useYn: string;
  createdAt: string;
  updatedAt: string;
}

/** 생성/수정 폼 데이터 */
export interface CommConfigFormData {
  configName: string;
  commType: string;
  description: string;
  host: string;
  port: string;
  portName: string;
  baudRate: string;
  dataBits: string;
  stopBits: string;
  parity: string;
  flowControl: string;
  extraConfig: Record<string, unknown>;
  useYn: string;
}

/** 초기 폼 값 */
export const INITIAL_FORM: CommConfigFormData = {
  configName: "",
  commType: "SERIAL",
  description: "",
  host: "",
  port: "",
  portName: "",
  baudRate: "9600",
  dataBits: "8",
  stopBits: "1",
  parity: "NONE",
  flowControl: "NONE",
  extraConfig: {},
  useYn: "Y",
};

/** 통신설정 페이지 전용 훅 */
export function useCommConfigData() {
  const [configs, setConfigs] = useState<CommConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CommConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommConfig | null>(null);
  const [formData, setFormData] = useState<CommConfigFormData>(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  /** 목록 조회 */
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.commType = typeFilter;
      if (searchText) params.search = searchText;
      params.limit = "100";

      const res = await api.get("/system/comm-configs", { params });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setConfigs(list);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchText]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  /** 통계 */
  const stats = useMemo(() => {
    const active = configs.filter((c) => c.useYn === "Y");
    return {
      total: configs.length,
      serialCount: active.filter((c) => c.commType === "SERIAL").length,
      tcpCount: active.filter((c) => c.commType === "TCP").length,
      otherCount: active.filter(
        (c) => !["SERIAL", "TCP"].includes(c.commType)
      ).length,
    };
  }, [configs]);

  /** 새로 만들기 모달 열기 */
  const openCreateModal = useCallback(() => {
    setEditingConfig(null);
    setFormData(INITIAL_FORM);
    setFormError("");
    setIsModalOpen(true);
  }, []);

  /** 수정 모달 열기 */
  const openEditModal = useCallback((config: CommConfig) => {
    setEditingConfig(config);
    setFormData({
      configName: config.configName,
      commType: config.commType,
      description: config.description || "",
      host: config.host || "",
      port: config.port ? String(config.port) : "",
      portName: config.portName || "",
      baudRate: config.baudRate ? String(config.baudRate) : "9600",
      dataBits: config.dataBits ? String(config.dataBits) : "8",
      stopBits: config.stopBits || "1",
      parity: config.parity || "NONE",
      flowControl: config.flowControl || "NONE",
      extraConfig: (config.extraConfig as Record<string, unknown>) || {},
      useYn: config.useYn,
    });
    setFormError("");
    setIsModalOpen(true);
  }, []);

  /** 모달 닫기 */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingConfig(null);
    setFormData(INITIAL_FORM);
    setFormError("");
  }, []);

  /** 저장 (생성/수정) */
  const handleSave = useCallback(async () => {
    if (!formData.configName.trim()) {
      setFormError("설정 이름은 필수입니다.");
      return;
    }

    const payload: Record<string, unknown> = {
      configName: formData.configName.trim(),
      commType: formData.commType,
      description: formData.description || undefined,
      useYn: formData.useYn,
    };

    // 통신 유형에 따른 필드
    if (formData.commType === "SERIAL") {
      payload.portName = formData.portName || undefined;
      payload.baudRate = formData.baudRate ? Number(formData.baudRate) : undefined;
      payload.dataBits = formData.dataBits ? Number(formData.dataBits) : undefined;
      payload.stopBits = formData.stopBits || undefined;
      payload.parity = formData.parity || undefined;
      payload.flowControl = formData.flowControl || undefined;
    } else {
      payload.host = formData.host || undefined;
      payload.port = formData.port ? Number(formData.port) : undefined;
    }

    // extraConfig가 비어있지 않으면 추가
    if (Object.keys(formData.extraConfig).length > 0) {
      payload.extraConfig = formData.extraConfig;
    }

    try {
      if (editingConfig) {
        await api.put(`/system/comm-configs/${editingConfig.id}`, payload);
      } else {
        await api.post("/system/comm-configs", payload);
      }
      closeModal();
      fetchConfigs();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || "저장에 실패했습니다.");
    }
  }, [formData, editingConfig, closeModal, fetchConfigs]);

  /** 삭제 */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/system/comm-configs/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchConfigs();
    } catch {
      // 에러 무시
    }
  }, [deleteTarget, fetchConfigs]);

  return {
    configs,
    loading,
    stats,
    typeFilter,
    setTypeFilter,
    searchText,
    setSearchText,
    isModalOpen,
    editingConfig,
    deleteTarget,
    setDeleteTarget,
    formData,
    setFormData,
    formError,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSave,
    handleDelete,
    fetchConfigs,
  };
}

/** 다른 페이지에서 유형별 통신설정 드롭다운으로 사용 */
export function useCommConfigsByType(commType: string) {
  const [configs, setConfigs] = useState<CommConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!commType) return;
    setLoading(true);
    api
      .get(`/system/comm-configs/type/${commType}`)
      .then((res) => {
        setConfigs(Array.isArray(res.data?.data) ? res.data.data : []);
      })
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, [commType]);

  return { configs, loading };
}
