import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { config as loadDotenv } from "dotenv";

// Same as dev-with-env.mjs but WITHOUT Turbopack — the canary Turbopack build
// segfaults intermittently on Windows while compiling /api/chat. Webpack dev is slower
// to compile but stable.
loadDotenv({ path: resolve(process.cwd(), ".env.local") });

process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= "true";
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= "true";

// Webpack dev (no Turbopack) is memory-hungry and OOM'd ("MemoryChunk allocation
// failed during deserialization") after a heavy multi-agent request. Give node a
// large heap so the dev server survives long agent runs + big scraped payloads.
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--max-old-space-size=8192"]
  .filter(Boolean)
  .join(" ");

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

// `next dev` defaults to Turbopack in this canary; Turbopack's Rust core segfaults
// intermittently on Windows (0xC0000005). Force webpack — slower to compile but stable.
const child = spawn(process.execPath, [nextBin, "dev", "--webpack"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
