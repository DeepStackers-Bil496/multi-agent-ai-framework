import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { config as loadDotenv } from "dotenv";

loadDotenv({
  path: resolve(process.cwd(), ".env.local"),
});

process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= "true";
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= "true";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--turbo"],
  {
    stdio: "inherit",
    env: process.env,
  }
);

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
