import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const VIEWPORTS = [
  { width: 360, height: 800, label: "360x800" },
  { width: 430, height: 932, label: "430x932" },
  { width: 1024, height: 768, label: "1024x768" },
  { width: 1366, height: 768, label: "1366x768" },
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 2560, height: 1440, label: "2560x1440" },
];

const targetUrl = process.argv[2] ?? "https://clarainova.vercel.app";
const outputRoot = process.argv[3] ?? "docs/visual-regression/hero-lock";
const runName =
  process.argv[4] ??
  `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const waitMs = Number(process.argv[5] ?? 2500);

if (!Number.isFinite(waitMs) || waitMs < 0) {
  throw new Error("waitMs deve ser um numero valido.");
}

const runDir = resolve(join(outputRoot, runName));
mkdirSync(runDir, { recursive: true });

for (const viewport of VIEWPORTS) {
  const outFile = join(runDir, `${viewport.label}.png`);
  const screenshotArgs = [
    "playwright",
    "screenshot",
    "--browser",
    "chromium",
    "--viewport-size",
    `${viewport.width},${viewport.height}`,
    "--wait-for-timeout",
    String(waitMs),
    targetUrl,
    outFile,
  ];

  const result =
    process.platform === "win32"
      ? spawnSync(
          "cmd.exe",
          ["/d", "/s", "/c", `npx ${screenshotArgs.join(" ")}`],
          { stdio: "inherit" },
        )
      : spawnSync("npx", screenshotArgs, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Falha ao capturar viewport ${viewport.label}. Codigo: ${result.status}`,
    );
  }
}

const metadata = {
  url: targetUrl,
  outputDirectory: runDir,
  runName,
  waitMs,
  viewports: VIEWPORTS,
  capturedAt: new Date().toISOString(),
};

writeFileSync(
  join(runDir, "capture-meta.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
  "utf8",
);

console.log(`Captura concluida em: ${runDir}`);
