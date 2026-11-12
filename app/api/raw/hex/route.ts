import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { activeBinPath, runRawOps } from "@/lib/raw-server";

/**
 * Sınır kontrollü hex okuma (en fazla 4 KB).
 * Doküman: /api/raw/hex?offset=0x1C0000&length=256
 */
export async function GET(request: NextRequest) {
  const binPath = activeBinPath();
  if (!fs.existsSync(binPath)) {
    return NextResponse.json(
      { success: false, error: "Aktif dosya bulunamadı." },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const offset = searchParams.get("offset") || "0x0";
  const rawLength = Number(searchParams.get("length") || "256");
  if (!/^0x[0-9a-fA-F]+$|^\d+$/.test(offset)) {
    return NextResponse.json(
      { success: false, error: "BAD_OFFSET", detail: `Geçersiz adres: ${offset}` },
      { status: 400 }
    );
  }
  if (!Number.isFinite(rawLength) || rawLength <= 0) {
    return NextResponse.json(
      {
        success: false,
        error: "BAD_LENGTH",
        detail: "Uzunluk pozitif bir tam sayı olmalı.",
      },
      { status: 400 }
    );
  }

  const result = await runRawOps(
    `--file "${binPath}" --mode hex --offset ${offset} --length ${Math.trunc(rawLength)}`
  );
  return NextResponse.json(result.body, { status: result.status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
