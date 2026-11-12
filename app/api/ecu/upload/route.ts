import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execAsync = promisify(exec);

const SESSION_BIN = () => path.join(process.cwd(), "data", ".session_upload.bin");

export async function POST(request: NextRequest) {
  const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}.bin`);
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Dosya bulunamadı." },
        { status: 400 }
      );
    }
    if (!file.name.toLowerCase().endsWith(".bin")) {
      return NextResponse.json(
        { success: false, error: "Yalnızca .bin uzantılı ECU dump dosyaları kabul edilir." },
        { status: 400 }
      );
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Dosya 4 MB sınırını aşıyor." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    const scriptPath = path.join(process.cwd(), "backend", "cli_inspect.py");
    const cmd = `python "${scriptPath}" --file "${tempPath}"`;
    const { stdout } = await execAsync(cmd, {
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "INSPECTOR_OUTPUT_INVALID",
          detail:
            "Python denetleyicisi geçerli JSON döndürmedi. Python bağımlılıklarını (numpy, fastapi) kontrol edin.",
        },
        { status: 500 }
      );
    }
    const data = parsed as Record<string, unknown>;

    // Persist only a verified binary as the active working session.
    fs.mkdirSync(path.dirname(SESSION_BIN()), { recursive: true });
    fs.copyFileSync(tempPath, SESSION_BIN());
    return NextResponse.json(
      { ...data, fileName: file.name, fileSize: `${Math.round(file.size / 1024)} KB` },
      { status: 200 }
    );
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      const parsed = JSON.parse(stdout);
      return NextResponse.json(parsed, { status: 400 });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            error?.message ||
            "Dosya doğrulanamadı. Python çekirdeği çalışıyor mu? (uvicorn backend.main:app)",
        },
        { status: 500 }
      );
    }
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(SESSION_BIN())) fs.unlinkSync(SESSION_BIN());
    return NextResponse.json({ success: true, message: "Yüklü oturum dosyası kaldırıldı." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Oturum dosyası kaldırılamadı." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
