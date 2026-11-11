import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const tempPath = path.join(os.tmpdir(), `datalog_${Date.now()}.csv`);
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "CSV log dosyası bulunamadı." },
        { status: 400 }
      );
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Log dosyası 4 MB sınırını aşıyor." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    const scriptPath = path.join(process.cwd(), "backend", "datalogger.py");
    const cmd = `python "${scriptPath}" --file "${tempPath}" --name "${file.name}"`;
    const { stdout } = await execAsync(cmd);
    return NextResponse.json(JSON.parse(stdout));
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      return NextResponse.json(JSON.parse(stdout), { status: 400 });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Log analizi başarısız.",
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
