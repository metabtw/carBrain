import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import fs from "fs";
import { activeBinPath } from "@/lib/raw-server";

const execAsync = promisify(exec);

type RawPatch = { offset: string | number; hex: string };

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
}

/**
 * Onaylı deneysel dışa aktarma.
 *
 * `ack_unverified !== true` ise 400 döner.  Çıktı, orijinal yedek ve diff
 * raporu `data/raw_exports/<zaman damgası>/` altında kalıcı tutulur; iki dosya
 * (bin + diff.json) arayüzden ayrı ayrı indirilebilir.
 */
export async function POST(request: NextRequest) {
  const tempPatches = path.join(os.tmpdir(), `raw_patches_${Date.now()}.json`);
  try {
    const payload = (await request.json().catch(() => null)) as
      | { patches?: RawPatch[]; ack_unverified?: boolean }
      | null;

    if (!payload || !Array.isArray(payload.patches)) {
      return NextResponse.json(
        {
          success: false,
          error: "BAD_REQUEST",
          detail: "Gövde { patches: [...], ack_unverified: true } olmalı.",
          checksum_status: "UNVERIFIED",
        },
        { status: 400 }
      );
    }
    if (payload.ack_unverified !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "ACK_REQUIRED",
          detail:
            "Deneysel dışa aktarma için ack_unverified=true zorunlu. " +
            "Checksum doğrulanmamış dosya üretileceğini onaylamalısınız.",
          checksum_status: "UNVERIFIED",
        },
        { status: 400 }
      );
    }
    if (payload.patches.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "NO_PATCHES",
          detail: "Dışa aktarılacak yama yok.",
          checksum_status: "UNVERIFIED",
        },
        { status: 400 }
      );
    }

    const inputPath = activeBinPath();
    const outDir = path.join(process.cwd(), "data", "raw_exports", timestamp());
    fs.mkdirSync(outDir, { recursive: true });
    const stem = path.basename(inputPath).replace(/\.bin$/i, "") || "ecm";
    const outputPath = path.join(outDir, `${stem}.experimental.bin`);

    fs.writeFileSync(tempPatches, JSON.stringify(payload.patches), "utf-8");

    const scriptPath = path.join(process.cwd(), "backend", "cli_raw.py");
    const cmd =
      `python "${scriptPath}" --input "${inputPath}" --patches "${tempPatches}" ` +
      `--output "${outputPath}" --ack-unverified`;

    let stdout = "";
    try {
      ({ stdout } = await execAsync(cmd, {
        timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      }));
    } catch (error: any) {
      const errOut = error?.stdout?.toString?.() || "";
      try {
        const parsed = JSON.parse(errOut);
        return NextResponse.json(parsed, { status: 400 });
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "RAW_EXPORT_FAILED",
            detail:
              error?.message || "Deneysel dışa aktarma başarısız oldu.",
            checksum_status: "UNVERIFIED",
          },
          { status: 500 }
        );
      }
    }

    const report = JSON.parse(stdout);
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json(
        {
          success: false,
          error: "OUTPUT_MISSING",
          detail: "Deneysel ikili dosya üretilemedi.",
          checksum_status: "UNVERIFIED",
        },
        { status: 500 }
      );
    }

    const produced = fs.readFileSync(outputPath);
    const { backup, report: reportPath, ...safeReport } = report;
    return NextResponse.json({
      ...safeReport,
      success: true,
      mode: "experimental",
      checksum_status: "UNVERIFIED",
      filename: path.basename(outputPath),
      backup_filename: backup ? path.basename(backup) : null,
      report_filename: reportPath ? path.basename(reportPath) : null,
      export_dir: path.relative(process.cwd(), outDir),
      binary_base64: produced.toString("base64"),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Deneysel dışa aktarma başarısız.",
        checksum_status: "UNVERIFIED",
      },
      { status: 500 }
    );
  } finally {
    try {
      fs.unlinkSync(tempPatches);
    } catch {}
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
