import { SAMPLE_VEHICLE, type TuningParams } from "@/lib/types";

export function getMockFileContent(params?: TuningParams): Uint8Array {
  // Construct a realistic mock ECU binary header & map table
  const p = params || { turboPressure: 0, injection: 0, throttleResponse: 0 };
  const header = `AUTOTUNE_ECU_BIN_V1.0\n` +
    `VEHICLE: Volkswagen Golf IV 1.9 TDI\n` +
    `ECU: Bosch EDC15P+\n` +
    `TURBO_PRESSURE_OFFSET: ${p.turboPressure}%\n` +
    `INJECTION_MAP_OFFSET: ${p.injection}%\n` +
    `THROTTLE_MAP_OFFSET: ${p.throttleResponse}%\n` +
    `EST_POWER: ${101 + p.turboPressure} HP\n` +
    `CHECKSUM: 0x${Math.abs((0x89FA2C + p.turboPressure * 137 + p.injection * 73 + p.throttleResponse * 29) & 0xFFFFFF).toString(16).toUpperCase()}\n` +
    `STATUS: CHECKSUM_CORRECT_AND_SECURED\n` +
    `TIMESTAMP: ${new Date().toISOString()}\n`;

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(header);
  
  // Create a 512KB mock binary file (standard EDC15 size)
  const fullBytes = new Uint8Array(512 * 1024);
  fullBytes.set(headerBytes, 0);

  // Fill in pseudo map data
  for (let i = headerBytes.length; i < fullBytes.length; i++) {
    fullBytes[i] = (i * 37 + (p.turboPressure + 10) * 11) & 0xFF;
  }

  return fullBytes;
}

export function createMockVehicleFile(): File {
  const bytes = getMockFileContent();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
  return new File([blob], "golf_iv_19tdi_edc15.bin", {
    type: "application/octet-stream",
  });
}

export function downloadBinFile(params: TuningParams, filename = "golf_iv_19tdi_tuned.bin") {
  const bytes = getMockFileContent(params);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function computeEstimatedHp(baseHp: number, turboPressure: number): number {
  return Math.round(baseHp + turboPressure);
}

export function computeFuelImpact(injection: number): {
  label: string;
  pillText: string;
  dotColor: string;
} {
  if (injection < -3) {
    const val = Math.abs(injection * 1.5).toFixed(0);
    return {
      label: "Daha Az",
      pillText: `%${val} Daha Ekonomik`,
      dotColor: "bg-emerald-500",
    };
  } else if (injection <= 3) {
    return {
      label: "Optimize",
      pillText: "%8 Daha Ekonomik",
      dotColor: "bg-emerald-500",
    };
  } else {
    return {
      label: "Biraz Artabilir",
      pillText: `%${Math.round(injection * 1.2)} Güç Odaklı`,
      dotColor: "bg-amber-500",
    };
  }
}

export function computeThrottleImpact(throttle: number): {
  feeling: string;
  fuel: string;
  perf: string;
  pillText: string;
} {
  if (throttle > 5) {
    return {
      feeling: "Daha Dinamik",
      fuel: "Biraz Artabilir",
      perf: "+ 5 HP",
      pillText: "Daha Hızlı Tepki",
    };
  } else if (throttle < -3) {
    return {
      feeling: "Yumuşak & Konfor",
      fuel: "Ekonomik",
      perf: "0 HP",
      pillText: "Yumuşak Tepki",
    };
  } else {
    return {
      feeling: "Fabrika Dengesi",
      fuel: "Normal",
      perf: "+ 2 HP",
      pillText: "Dengeli Tepki",
    };
  }
}

export function computeStress(turboPressure: number): {
  label: string;
  dotColor: string;
} {
  if (turboPressure <= 5) {
    return { label: "Normal (Düşük)", dotColor: "bg-emerald-500" };
  } else if (turboPressure <= 12) {
    return { label: "Güvenli Sınır", dotColor: "bg-amber-500" };
  } else {
    return { label: "Yüksek (Tavsiye Edilmez)", dotColor: "bg-rose-500" };
  }
}
