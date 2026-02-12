/**
 * @file src/components/system/CommConfigForm.tsx
 * @description 통신설정 생성/수정 폼 컴포넌트
 *
 * 초보자 가이드:
 * 1. **commType 선택**: 통신 유형에 따라 동적 폼 필드 표시
 * 2. **SERIAL**: portName, baudRate, dataBits, stopBits, parity, flowControl
 * 3. **TCP**: host, port
 * 4. **MQTT/OPC_UA/MODBUS**: host, port + extraConfig JSON 필드
 */

"use client";

import { useTranslation } from "react-i18next";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  CommConfigFormData,
} from "@/hooks/system/useCommConfigData";

interface CommConfigFormProps {
  formData: CommConfigFormData;
  onChange: (field: keyof CommConfigFormData, value: string | Record<string, unknown>) => void;
  error?: string;
  isEdit?: boolean;
}

const COMM_TYPE_OPTIONS = [
  { value: "SERIAL", label: "SERIAL (RS232/RS485)" },
  { value: "TCP", label: "TCP/IP" },
  { value: "MQTT", label: "MQTT" },
  { value: "OPC_UA", label: "OPC-UA" },
  { value: "MODBUS", label: "Modbus" },
];

const BAUD_RATE_OPTIONS = [
  { value: "9600", label: "9600" },
  { value: "19200", label: "19200" },
  { value: "38400", label: "38400" },
  { value: "57600", label: "57600" },
  { value: "115200", label: "115200" },
];

const DATA_BITS_OPTIONS = [
  { value: "7", label: "7" },
  { value: "8", label: "8" },
];

const STOP_BITS_OPTIONS = [
  { value: "1", label: "1" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" },
];

const PARITY_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "EVEN", label: "Even" },
  { value: "ODD", label: "Odd" },
];

const FLOW_CONTROL_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "XONXOFF", label: "XON/XOFF" },
  { value: "RTSCTS", label: "RTS/CTS" },
];

/** 통신 유형에 따른 extraConfig 키 설명 */
const EXTRA_CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  MQTT: [
    { key: "topic", label: "Topic", placeholder: "예: mes/equip/001" },
    { key: "clientId", label: "Client ID", placeholder: "예: harness-mes-001" },
    { key: "qos", label: "QoS", placeholder: "0, 1, 2" },
    { key: "username", label: "Username", placeholder: "인증 사용자명" },
    { key: "password", label: "Password", placeholder: "인증 비밀번호" },
  ],
  OPC_UA: [
    { key: "endpointUrl", label: "Endpoint URL", placeholder: "opc.tcp://..." },
    { key: "securityMode", label: "Security Mode", placeholder: "None, Sign, SignAndEncrypt" },
    { key: "securityPolicy", label: "Security Policy", placeholder: "None, Basic256Sha256" },
  ],
  MODBUS: [
    { key: "slaveId", label: "Slave ID", placeholder: "1~247" },
    { key: "registerType", label: "Register Type", placeholder: "HOLDING, INPUT, COIL, DISCRETE" },
    { key: "startAddress", label: "Start Address", placeholder: "0" },
    { key: "length", label: "Length", placeholder: "레지스터 갯수" },
  ],
};

export default function CommConfigForm({
  formData,
  onChange,
  error,
  isEdit,
}: CommConfigFormProps) {
  const { t } = useTranslation();
  const isSerial = formData.commType === "SERIAL";
  const extraFields = EXTRA_CONFIG_FIELDS[formData.commType];

  const USE_YN_OPTIONS = [
    { value: "Y", label: t('system.commConfig.useLabel') },
    { value: "N", label: t('system.commConfig.notUseLabel') },
  ];

  /** extraConfig 필드 변경 핸들러 */
  const handleExtraChange = (key: string, value: string) => {
    onChange("extraConfig", { ...formData.extraConfig, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-[var(--radius)]">
          {error}
        </div>
      )}

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t('system.commConfig.configNameLabel')}
          value={formData.configName}
          onChange={(e) => onChange("configName", e.target.value)}
          placeholder={t('system.commConfig.configNamePlaceholder')}
          fullWidth
        />
        <Select
          label={t('system.commConfig.commTypeLabel')}
          options={COMM_TYPE_OPTIONS}
          value={formData.commType}
          onChange={(v) => onChange("commType", v)}
          fullWidth
          disabled={isEdit}
        />
      </div>

      <Input
        label={t('system.commConfig.descriptionLabel')}
        value={formData.description}
        onChange={(e) => onChange("description", e.target.value)}
        placeholder={t('system.commConfig.descriptionPlaceholder')}
        fullWidth
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label={t('system.commConfig.useYnLabel')}
          options={USE_YN_OPTIONS}
          value={formData.useYn}
          onChange={(v) => onChange("useYn", v)}
          fullWidth
        />
      </div>

      {/* 구분선 */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-text mb-3">
          {t(isSerial ? 'system.commConfig.serialSettings' : 'system.commConfig.networkSettings')}
        </h4>
      </div>

      {/* 시리얼 전용 */}
      {isSerial ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('system.commConfig.portName')}
              value={formData.portName}
              onChange={(e) => onChange("portName", e.target.value)}
              placeholder={t('system.commConfig.portNamePlaceholder')}
              fullWidth
            />
            <Select
              label={t('system.commConfig.baudRate')}
              options={BAUD_RATE_OPTIONS}
              value={formData.baudRate}
              onChange={(v) => onChange("baudRate", v)}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('system.commConfig.dataBits')}
              options={DATA_BITS_OPTIONS}
              value={formData.dataBits}
              onChange={(v) => onChange("dataBits", v)}
              fullWidth
            />
            <Select
              label={t('system.commConfig.stopBits')}
              options={STOP_BITS_OPTIONS}
              value={formData.stopBits}
              onChange={(v) => onChange("stopBits", v)}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('system.commConfig.parity')}
              options={PARITY_OPTIONS}
              value={formData.parity}
              onChange={(v) => onChange("parity", v)}
              fullWidth
            />
            <Select
              label={t('system.commConfig.flowControl')}
              options={FLOW_CONTROL_OPTIONS}
              value={formData.flowControl}
              onChange={(v) => onChange("flowControl", v)}
              fullWidth
            />
          </div>
        </div>
      ) : (
        /* TCP / MQTT / OPC_UA / MODBUS 공통 */
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('system.commConfig.hostLabel')}
            value={formData.host}
            onChange={(e) => onChange("host", e.target.value)}
            placeholder={t('system.commConfig.hostPlaceholder')}
            fullWidth
          />
          <Input
            label={t('system.commConfig.portLabel')}
            type="number"
            value={formData.port}
            onChange={(e) => onChange("port", e.target.value)}
            placeholder={t('system.commConfig.portPlaceholder')}
            fullWidth
          />
        </div>
      )}

      {/* 프로토콜별 추가 설정 */}
      {extraFields && (
        <>
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-text mb-3">
              {t('system.commConfig.extraSettings', { type: formData.commType })}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {extraFields.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                value={String(formData.extraConfig[field.key] || "")}
                onChange={(e) => handleExtraChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                fullWidth
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
