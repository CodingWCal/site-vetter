// Integration check: npm run check. Cross-platform (uses process.execPath, no shell).
// Boots the backend in mock mode and verifies the contract the extension depends on.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { REPORT_SCHEMA } from "../server/schema.js";

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

for (const f of ["extension/popup.js", "extension/content.js", "server/server.js"]) {
  check(`syntax ${f}`, spawnSync(process.execPath, ["--check", f]).status === 0);
}
const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
check("manifest is MV3 with popup + activeTab + scripting",
  manifest.manifest_version === 3 && manifest.action?.default_popup === "popup.html" &&
  ["activeTab", "scripting"].every((p) => manifest.permissions?.includes(p)));
const mock = JSON.parse(readFileSync("server/mock-response.json", "utf8"));
check("mock-response.json has every schema field", REPORT_SCHEMA.required.every((k) => k in mock));

const PORT = "8799";
const srv = spawn(process.execPath, ["server/server.js", "--mock"], { env: { ...process.env, PORT }, stdio: "pipe" });
await new Promise((resolve) => srv.stdout.once("data", resolve));
const base = `http://localhost:${PORT}`;
const post = (body, headers = {}) => fetch(`${base}/api/vet`, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

try {
  check("GET /health", (await fetch(`${base}/health`)).ok);
  check("GET /test/phish.html", (await fetch(`${base}/test/phish.html`)).ok);
  check("test page path traversal blocked", (await fetch(`${base}/test/..%2f..%2fpackage.json`)).status === 404);

  const sample = { url: "http://localhost:8787/test/phish.html", signals: { forms: { password_field: true } },
    text: "Card 4111 1111 1111 1111 key AKIAIOSFODNN7EXAMPLE" };
  const ok = await post(sample, { Origin: "chrome-extension://abcdefghijklmnop" });
  const data = await ok.json();
  check("POST /api/vet from extension origin -> 200", ok.status === 200);
  check("report matches schema fields", REPORT_SCHEMA.required.every((k) => k in data.report));
  check("card number + AWS key redacted before model call", data.meta.redactions.count === 2);
  check("POST from a random website origin -> 403", (await post(sample, { Origin: "https://evil.example" })).status === 403);
  check("store page mock -> 200 (store mock or fallback)",
    (await post({ url: "http://localhost:8787/test/store.html" })).status === 200);
  check("non-http url rejected", (await post({ url: "chrome://settings" })).status === 400);
} finally {
  srv.kill();
}
process.exit(failed ? 1 : 0);
