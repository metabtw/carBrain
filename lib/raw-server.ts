import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

/** Aktif oturum dosyası (yükleme yoksa demo stok dosyası). */
export function activeBinPath(): string {
  const session = path.join(process.cwd(), "data", ".session_upload.bin");
  const stock = path.join(process.cwd(), "data", "edc15_19tdi_stock.bin");
  return fs.existsSync(session) ? session : stock;
}

/**
 * `backend/cli_raw_ops.py` çıktısını JSON olarak döndürür.
 *
 * Deneysel mod uçları, mevcut köprü mimarisiyle uyumlu olsun diye Python'u CLI
 * olarak çağırır; böylece FastAPI servisi kapalıyken de çalışır.
 */
export async function runRawOps(
  args: string
): Promise<{ status: number; body: any }> {
  const scriptPath = path.join(process.cwd(), "backend", "cli_raw_ops.py");
  try {
    const { stdout } = await execAsync(`python "${scriptPath}" ${args}`, {
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
    try {
      return { status: 200, body: JSON.parse(stdout) };
    } catch {
      return {
        status: 500,
        body: {
          success: false,
          error: "RAW_OUTPUT_INVALID",
          detail: "Deneysel mod CLI'si geçerli JSON döndürmedi.",
        },
      };
    }
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      return { status: 400, body: JSON.parse(stdout) };
    } catch {
      return {
        status: 500,
        body: {
          success: false,
          error:
            error?.message || "Deneysel mod isteği başarısız (Python çekirdeği?).",
        },
      };
    }
  }
}
