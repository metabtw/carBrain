import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

// 7B modelinin CPU'da ilk yüklemesi uzun sürebilir. CLI tarafında OLLAMA_TIMEOUT
// ile yönetilir; burada Node tarafında daha geniş bir güvenlik payı bırakıyoruz.
const CLI_TIMEOUT_MS = Number(process.env.AI_ANALYZE_TIMEOUT_MS || 360_000);

function activeBinPath(): string {
  const session = path.join(process.cwd(), "data", ".session_upload.bin");
  const stock = path.join(process.cwd(), "data", "edc15_19tdi_stock.bin");
  return fs.existsSync(session) ? session : stock;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address") || "0x4D200";
    const model = searchParams.get("model") || "qwen2.5-coder:7b";
    const checkOnly = searchParams.get("check") === "1";

    const scriptPath = path.join(process.cwd(), "backend", "ollama_analyzer.py");
    const xdfPath = path.join(process.cwd(), "data", "edc15_19tdi.xdf");

    const args = checkOnly
      ? [scriptPath, "--check"]
      : [
          scriptPath,
          "--address",
          address,
          "--model",
          model,
          "--bin",
          activeBinPath(),
          "--xdf",
          xdfPath,
        ];

    const { stdout } = await execFileAsync("python", args, {
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });

    const data = JSON.parse(stdout);
    if (data?.error && typeof data.error === "string") {
      return NextResponse.json(
        { success: false, error: data.error },
        { status: 500 }
      );
    }
    return NextResponse.json(data);
  } catch (error: any) {
    // execFile hatasında stdout'ta yapılandırılmış JSON olabilir.
    const stdout = error?.stdout?.toString?.() || "";
    if (stdout.trim().startsWith("{")) {
      try {
        return NextResponse.json(JSON.parse(stdout), { status: 200 });
      } catch {
        // aşağıdaki genel hataya düş
      }
    }
    if (error?.killed || error?.signal === "SIGTERM") {
      return NextResponse.json(
        {
          success: false,
          error: "AI_ANALYZE_TIMEOUT",
          detail:
            "Ollama modeli zamanında yanıt vermedi. Modeli `ollama run <model>` ile " +
            "önceden yükleyin veya OLLAMA_TIMEOUT değerini artırın.",
        },
        { status: 504 }
      );
    }
    const stderr = error?.stderr?.toString?.() || "";
    return NextResponse.json(
      {
        success: false,
        error: "AI_ANALYZE_FAILED",
        detail:
          stderr.trim() ||
          error?.message ||
          "Harita analizi başarısız. Python ve Ollama kurulumunu kontrol edin.",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
