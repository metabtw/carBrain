import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { activeBinPath, runRawOps } from "@/lib/raw-server";

type RawPatch = { offset: string | number; hex: string };

/** Yamaları bellekte uygular; diff ve uyarıları döner, dosyaya YAZMAZ. */
export async function POST(request: NextRequest) {
  const tempPath = path.join(os.tmpdir(), `raw_preview_${Date.now()}.json`);
  try {
    const payload = (await request.json().catch(() => null)) as
      | { patches?: RawPatch[] }
      | null;
    if (!payload || !Array.isArray(payload.patches)) {
      return NextResponse.json(
        {
          success: false,
          error: "BAD_REQUEST",
          detail: "Gövde { patches: [...] } biçiminde olmalı.",
        },
        { status: 400 }
      );
    }

    fs.writeFileSync(tempPath, JSON.stringify(payload.patches), "utf-8");
    const result = await runRawOps(
      `--file "${activeBinPath()}" --mode preview --patches "${tempPath}"`
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Önizleme üretilemedi.",
        checksum_status: "UNVERIFIED",
      },
      { status: 500 }
    );
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
