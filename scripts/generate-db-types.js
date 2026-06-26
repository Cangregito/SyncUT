import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const isWindows = process.platform === "win32";
const command = isWindows ? "cmd.exe" : "pnpm";
const args = isWindows
  ? [
      "/d",
      "/s",
      "/c",
      "pnpm dlx supabase@latest gen types typescript --linked",
    ]
  : ["dlx", "supabase@latest", "gen", "types", "typescript", "--linked"];
const result = spawnSync(
  command,
  args,
  {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  }
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || "No fue posible generar los tipos.\n");
  process.exit(result.status ?? 1);
}

const outputPath = path.join(
  process.cwd(),
  "packages",
  "types",
  "src",
  "database.types.ts"
);

fs.writeFileSync(outputPath, result.stdout, "utf8");
console.log(`Tipos de Supabase generados en ${outputPath}`);
