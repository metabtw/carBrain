import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address") || "0x4D200";
    const model = searchParams.get("model") || "qwen2.5-coder:7b";

    const scriptPath = path.join(process.cwd(), "backend", "ollama_analyzer.py");
    const binPath = path.join(process.cwd(), "data", "edc15_19tdi_stock.bin");
    const xdfPath = path.join(process.cwd(), "data", "edc15_19tdi.xdf");

    const cmd = `python "${scriptPath}" --address ${address} --model "${model}" --bin "${binPath}" --xdf "${xdfPath}"`;

    const { stdout, stderr } = await execAsync(cmd);
    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    const data = JSON.parse(stdout);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to analyze map with AI" },
      { status: 500 }
    );
  }
}

