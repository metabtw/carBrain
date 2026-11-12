import { NextResponse } from "next/server";
import fs from "fs";
import { activeBinPath, runRawOps } from "@/lib/raw-server";

/** Dosya düzeni: 64 KB bloklar, boş oran, kısmi dump yorumu. */
export async function GET() {
  const binPath = activeBinPath();
  if (!fs.existsSync(binPath)) {
    return NextResponse.json(
      { success: false, error: "Aktif dosya bulunamadı." },
      { status: 404 }
    );
  }
  const result = await runRawOps(`--file "${binPath}" --mode layout`);
  return NextResponse.json(result.body, { status: result.status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
