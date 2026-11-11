export interface VehicleData {
  make: string;
  model: string;
  year: number;
  engine: string;
  baseHp: number;
  ecu: string;
  ecuType: string;
  status: string;
  statusVariant: "success" | "warning" | "info";
  checksum: string;
  fileName: string;
  fileSize: string;
  loadedAt: string;
}

export interface TuningParams {
  /** Turbo hedef basıncı haritası (0x4D200), yüzde */
  turboPressure: number;
  /** Duman/yakıt limiti haritası (0x4E150), yüzde */
  injection: number;
  /** Sürücü isteği / gaz pedalı haritası (0x4C120), yüzde */
  throttleResponse: number;
  /** Tork limitörü haritası (0x4F080), yüzde */
  torqueLimiter: number;
  /** Ateşleme avansı, derece (0 = stok, güvenli sınır +8°) */
  timingAdvance: number;
  /** Yakıt rayı basıncı, bar (0 = dokunma) */
  railPressure: number;
}

export type HardwareUpgradeKey =
  | "upgraded_turbo"
  | "upgraded_injectors"
  | "upgraded_intercooler"
  | "upgraded_clutch"
  | "egt_probe"
  | "wideband_lambda"
  | "dyno_verified";

export interface HardwareUpgrades {
  id: HardwareUpgradeKey;
  label: string;
  description: string;
  /** Guardrail zarfını genişletmek için zorunlu üçlünün parçası mı? */
  critical: boolean;
}

export const HARDWARE_UPGRADES: HardwareUpgrades[] = [
  {
    id: "upgraded_turbo",
    label: "Büyük turbo",
    description: "GT1749V yerine daha büyük kompresör/türbin.",
    critical: true,
  },
  {
    id: "upgraded_injectors",
    label: "Büyük enjektör",
    description: "Stok 0.216 yerine daha yüksek debili enjektör.",
    critical: true,
  },
  {
    id: "dyno_verified",
    label: "Dyno doğrulaması",
    description: "Harita dyno üzerinde ölçülüp doğrulandı.",
    critical: true,
  },
  {
    id: "upgraded_intercooler",
    label: "Büyük intercooler",
    description: "Emme havası sıcaklığını düşürür, EGT payı verir.",
    critical: false,
  },
  {
    id: "upgraded_clutch",
    label: "Güçlendirilmiş debriyaj",
    description: "Yüksek tork için stok debriyaj/DMF yerine.",
    critical: false,
  },
  {
    id: "egt_probe",
    label: "EGT probu",
    description: "Egzoz gazı sıcaklığı canlı izleniyor.",
    critical: false,
  },
  {
    id: "wideband_lambda",
    label: "Geniş bant lambda",
    description: "Hava/yakıt oranı canlı ölçülüyor.",
    critical: false,
  },
];

export const DEFAULT_HARDWARE: HardwareUpgradeKey[] = [];

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  suggestedParams?: Partial<TuningParams>;
  targetMaps?: string[];
  safetyNote?: string;
}

export interface MapTelemetryPoint {
  rpm: number;
  specified_boost: number;
  actual_boost: number;
  maf: number;
}

export interface GuardrailDecision {
  code: string;
  severity: "info" | "warning" | "critical";
  field: string;
  requested: number | null;
  limit: number | null;
  message: string;
  engineering_note: string;
}

export interface GuardrailResult {
  allowed: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  warnings: string[];
  errors: string[];
  decisions: GuardrailDecision[];
  estimated_gain: { hp: number; torque_pct: number; egt_c: number };
  hardware: { id: string; name: string; base_hp: number; base_torque_nm: number; turbo: string };
  request: Record<string, unknown>;
}

export const SAMPLE_VEHICLE: VehicleData = {
  make: "Volkswagen",
  model: "Golf IV",
  year: 2003,
  engine: "1.9 TDI (AHU / ALH)",
  baseHp: 101,
  ecu: "Bosch EDC15P+",
  ecuType: "EDC15 (29F400BT Flaş Bellek)",
  status: "Orijinal Fabrika Yazılımı Güvenli Şekilde Yüklendi",
  statusVariant: "success",
  checksum: "0x89FA2C (Doğrulandı & İmzalı)",
  fileName: "golf_iv_19tdi_edc15.bin",
  fileSize: "512 KB",
  loadedAt: "Şimdi",
};

export const DEFAULT_PARAMS: TuningParams = {
  turboPressure: 0,
  injection: 0,
  throttleResponse: 0,
  torqueLimiter: 0,
  timingAdvance: 0,
  railPressure: 0,
};

/** Temel slider aralığı (turbo, enjeksiyon, gaz tepkisi, tork limitörü) */
export const PARAM_MIN = -10;
export const PARAM_MAX = 15;

/** Gelişmiş parametre aralıkları */
export const TIMING_MIN = 0;
export const TIMING_MAX = 10;
export const TIMING_SAFE_MAX = 8;
export const RAIL_MIN = 0;
export const RAIL_MAX = 2100;
export const RAIL_STEP = 25;
export const RAIL_WARNING = 1900;

/** Guardrail zarfını genişletmek için gereken zorunlu donanım üçlüsü */
export const REQUIRED_FOR_EXTENDED_ENVELOPE: HardwareUpgradeKey[] = [
  "upgraded_turbo",
  "upgraded_injectors",
  "dyno_verified",
];
