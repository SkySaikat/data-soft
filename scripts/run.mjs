import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url),
  mode = process.argv[2] || "dev";
if (!["dev", "start"].includes(mode)) throw new Error("Choose dev or start.");
const envFiles = [".env.local", ".env"];
for (const file of envFiles) {
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const worker = spawn(
  process.execPath,
  ["--import", "tsx", resolve("scripts/worker.ts")],
  { stdio: "inherit", windowsHide: true, env: process.env },
);
const web = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    mode,
    "--hostname",
    "127.0.0.1",
    ...process.argv.slice(3),
  ],
  { stdio: "inherit", windowsHide: true, env: process.env },
);
mkdirSync(".data", { recursive: true });
writeFileSync(
  ".data/services.json",
  JSON.stringify(
    {
      runner: process.pid,
      web: web.pid,
      worker: worker.pid,
      mode,
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  web.kill();
  worker.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
web.on("exit", (code) => stop(code || 0));
worker.on("exit", (code) => {
  if (!closing) {
    console.error("Collection worker exited; restarting the app is required.");
    stop(code || 1);
  }
});
web.on("error", (error) => {
  console.error(error.message);
  stop(1);
});
worker.on("error", (error) => {
  console.error(error.message);
  stop(1);
});
