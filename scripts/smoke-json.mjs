import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "social-contact-collector-smoke-"));
const port = 18181;
const apiKey = "local-smoke-test-key-20260804";
let output = "";
const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    STORAGE_DRIVER: "json",
    DATA_FILE: join(directory, "collector.json"),
    ADMIN_API_KEY: apiKey,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });

try {
  let health;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        health = await response.json();
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!health || health.status !== "ok" || health.storage !== "json") throw new Error("JSON health check failed");

  const dashboard = await fetch(`http://127.0.0.1:${port}/dashboard`);
  if (!dashboard.ok || !(await dashboard.text()).includes("Панель лидов")) throw new Error("Dashboard smoke check failed");

  const statsResponse = await fetch(`http://127.0.0.1:${port}/api/stats`, { headers: { "x-api-key": apiKey } });
  const stats = await statsResponse.json();
  if (!statsResponse.ok || stats.total !== 0) throw new Error("Stats smoke check failed");
  console.log(JSON.stringify({ health, dashboardStatus: dashboard.status, stats }));
} catch (error) {
  console.error(output);
  throw error;
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
    setTimeout(() => resolve(), 3000).unref();
  });
  await rm(directory, { recursive: true, force: true });
}
