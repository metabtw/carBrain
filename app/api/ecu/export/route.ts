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
  const tempOut = path.join(os.tmpdir(), `tuned_${Date.now()}.bin`);
  try {
    const { searchParams } = new URL(request.url);
    const turbo = parseFloat(searchParams.get("turbo") || "0");
    const injection = parseFloat(searchParams.get("injection") || "0");
    const throttle = parseFloat(searchParams.get("throttle") || "0");
    const torque = parseFloat(searchParams.get("torque") || "0");
    const timing = searchParams.get("timing");
    const rail = searchParams.get("rail");
    const hardware = searchParams.get("hardware") || "";

    const scriptPath = path.join(process.cwd(), "backend", "cli_tune.py");
    let cmd =
      `python "${scriptPath}" --input "${activeBinPath()}" --output "${tempOut}" ` +
      `--turbo ${turbo} --injection ${injection} --throttle ${throttle} --torque ${torque}`;
    if (timing !== null && timing !== "") cmd += ` --timing ${parseFloat(timing)}`;
    if (rail !== null && rail !== "") cmd += ` --rail ${parseFloat(rail)}`;
    if (hardware) cmd += ` --hardware "${hardware.replace(/"/g, "")}"`;

    const { stdout } = await execAsync(cmd);
    const meta = JSON.parse(stdout);

    if (!fs.existsSync(tempOut)) {
      return NextResponse.json(
        { success: false, error: "Düzenlenmiş ikili dosya üretilemedi." },
        { status: 500 }
      );
    }

    const fileBuffer = fs.readFileSync(tempOut);
    const filename = `autotune_edc15_T${turbo >= 0 ? "+" : ""}${turbo}_I${
      injection >= 0 ? "+" : ""
    }${injection}_P${throttle >= 0 ? "+" : ""}${throttle}_M${
      torque >= 0 ? "+" : ""
    }${torque}.bin`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "X-Checksum-Status": meta?.checksum?.overall_status || "UNKNOWN",
        "X-Safety-Risk": meta?.guardrail?.risk_level || "unknown",
      },
    });
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() || "";
    try {
      const parsed = JSON.parse(stdout);
      const status =
        parsed?.error === "READ_ONLY_PROFILE"
          ? 409
          : parsed?.safety
          ? 422
          : 400;
      return NextResponse.json(parsed, { status });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            error?.message ||
            "Dışa aktarma başarısız. Python çekirdeği ve NumPy kurulu mu?",
        },
        { status: 500 }
      );
    }
  } finally {
    try {
      fs.unlinkSync(tempOut);
    } catch {}
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
