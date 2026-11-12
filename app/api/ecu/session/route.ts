import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

/**
 * Oturum modu:
 * - ``verified``               : doğrulanmış harita + checksum var (mevcut akış)
 * - ``experimental_available`` : dosya tanındı ama harita tanımı yok; onayla
 *                                deneysel ham düzenleme yapılabilir
 * - ``readonly``               : tanınmayan/bozuk dosya; yalnızca inceleme
 */
function sessionMode(body: any): "verified" | "experimental_available" | "readonly" {
  if (body?.success === true && body?.tuning_enabled === true) return "verified";
  if (body?.success === true && body?.read_only === true) {
    return "experimental_available";
  }
  return "readonly";
}

function activeBinPath(): string {
  const session = path.join(process.cwd(), "data", ".session_upload.bin");
  const stock = path.join(process.cwd(), "data", "edc15_19tdi_stock.bin");
  return fs.existsSync(session) ? session : stock;
}

/**
 * Aktif oturumun kimliğini ve yazma iznini döndürür.
 *
 * Arayüz sayfa yenilendiğinde salt-okunur bir dosyanın yüklü olduğunu bu uçla
 * öğrenir; böylece slider'lar ve dışa aktarma düğmesi yanlışlıkla etkinleşmez.
 */
export async function GET() {
  try {
    const scriptPath = path.join(process.cwd(), "backend", "cli_inspect.py");
    const binPath = activeBinPath();
    if (!fs.existsSync(binPath)) {
      return NextResponse.json(
        { success: false, error: "Aktif dosya bulunamadı." },
        { status: 404 }
      );
    }

    const { stdout } = await execAsync(
      `python "${scriptPath}" --file "${binPath}"`,
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
    );

    let parsed: any;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "INSPECTOR_OUTPUT_INVALID",
          detail: "Python denetleyicisi geçerli JSON döndürmedi.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ...parsed, mode: sessionMode(parsed) });
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      const parsed = JSON.parse(stdout);
      // Tanınmayan/reddedilen dosya: yalnızca inceleme yapılabilir.
      return NextResponse.json(
        { ...parsed, mode: sessionMode(parsed) },
        { status: 400 }
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Oturum bilgisi okunamadı.",
        },
        { status: 500 }
      );
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
