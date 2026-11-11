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
  turboPressure: number; // -10 ile +15 arası
  injection: number; // -10 ile +15 arası
  throttleResponse: number; // -10 ile +15 arası
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  suggestedParams?: TuningParams;
  targetMaps?: string[];
  safetyNote?: string;
}

export interface MapTelemetryPoint {
  rpm: number;
  specified_boost: number;
  actual_boost: number;
  maf: number;
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
};

export const PARAM_MIN = -10;
export const PARAM_MAX = 15;
