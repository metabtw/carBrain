import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

function activeBinPath(): string {
  const session = path.join(process.cwd(), "data", ".session_upload.bin");
  const stock = path.join(process.cwd(), "data", "edc15_19tdi_stock.bin");
  return fs.existsSync(session) ? session : stock;
}

/**
 * Canlı güvenlik doğrulaması.
 *
 * Dosya yazmaz; yalnızca `cli_tune.py --validate-only` çağırır. Bu sayede
 * arayüzdeki gelişmiş parametre paneli, kullanıcı slider'ı oynatırken
 * mühendislik limitlerini anında görebilir.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const turbo = Number(body?.turbo ?? 0);
    const injection = Number(body?.injection ?? 0);
    const throttle = Number(body?.throttle ?? 0);
    const torque = Number(body?.torque ?? 0);
    const timing = body?.timing_advance_deg;
    const rail = body?.rail_pressure_bar;
    const hardware: string[] = Array.isArray(body?.hardware_upgrades)
      ? body.hardware_upgrades.map((item: unknown) => String(item))
      : [];

    const scriptPath = path.join(process.cwd(), "backend", "cli_tune.py");
    const args = [
      scriptPath,
      "--input",
      activeBinPath(),
      "--validate-only",
      "--turbo",
      String(turbo),
      "--injection",
      String(injection),
      "--throttle",
      String(throttle),
      "--torque",
      String(torque),
    ];
    if (timing !== null && timing !== undefined && timing !== "") {
      args.push("--timing", String(Number(timing)));
    }
    if (rail !== null && rail !== undefined && rail !== "" && Number(rail) > 0) {
      args.push("--rail", String(Number(rail)));
    }
    if (hardware.length > 0) {
      args.push("--hardware", hardware.join(","));
    }

    const { stdout } = await execFileAsync("python", args, {
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return NextResponse.json(JSON.parse(stdout));
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      return NextResponse.json(JSON.parse(stdout), { status: 200 });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATE_FAILED",
          detail:
            error?.stderr?.toString?.() ||
            error?.message ||
            "Güvenlik doğrulaması çalıştırılamadı.",
        },
        { status: 500 }
      );
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
