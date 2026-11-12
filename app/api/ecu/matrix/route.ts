import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execAsync = promisify(exec);

function activeBinPath(): string {
  const session = path.join(process.cwd(), "data", ".session_upload.bin");
  const stock = path.join(process.cwd(), "data", "edc15_19tdi_stock.bin");
  return fs.existsSync(session) ? session : stock;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapName = searchParams.get("map") || "boost";
    const address = searchParams.get("address") || "0x4D200";
    const rows = searchParams.get("rows") || "16";
    const cols = searchParams.get("cols") || "16";
    const factor = searchParams.get("factor") || "0.1";

    const scriptPath = path.join(process.cwd(), "backend", "ecu_parser.py");
    const binPath = activeBinPath();

    let cmd = `python "${scriptPath}" --file "${binPath}"`;
    if (["boost", "driver_wish", "smoke_limiter", "torque_limiter"].includes(mapName)) {
      cmd += ` --map ${mapName}`;
    } else {
      cmd += ` --address ${address} --rows ${rows} --cols ${cols} --factor ${factor}`;
    }

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }
    try {
      return NextResponse.json(JSON.parse(stdout));
    } catch {
      return NextResponse.json(
        {
          error: "PARSER_OUTPUT_INVALID",
          detail: "Python ayrıştırıcısı geçerli JSON döndürmedi.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      const parsed = JSON.parse(stdout);
      const status = parsed?.error === "MAP_NOT_DEFINED" ? 400 : 500;
      return NextResponse.json(parsed, { status });
    } catch {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "İkili dosya ayrıştırılamadı. Python çekirdeğinin kurulu olduğundan emin olun.",
        },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  const tempPath = path.join(os.tmpdir(), `matrix_${Date.now()}.bin`);
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mapName = (formData.get("map") as string) || "boost";

    let binPath = activeBinPath();
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(tempPath, buffer);
      binPath = tempPath;
    }

    const scriptPath = path.join(process.cwd(), "backend", "ecu_parser.py");
    const cmd = `python "${scriptPath}" --file "${binPath}" --map ${mapName}`;
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }
    try {
      return NextResponse.json(JSON.parse(stdout));
    } catch {
      return NextResponse.json(
        {
          error: "PARSER_OUTPUT_INVALID",
          detail: "Python ayrıştırıcısı geçerli JSON döndürmedi.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      const parsed = JSON.parse(stdout);
      const status = parsed?.error === "MAP_NOT_DEFINED" ? 400 : 500;
      return NextResponse.json(parsed, { status });
    } catch {
      return NextResponse.json(
        { error: error?.message || "Harita matrisi okunamadı." },
        { status: 500 }
      );
    }
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
