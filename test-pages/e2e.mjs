// OWNER: Lane 5 (Test pages + QA). End-to-end check: node test-pages/e2e.mjs
// Boots the backend, fetches each test page, sends it to /api/vet the way the popup does, and checks the report.
// Mock mode (no API key) always returns the same canned report, so verdict checks run only with a real key.
// Not covered: extension/content.js (needs a real browser). Signals here come from a small HTML parser.
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPORT_SCHEMA } from "../server/schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

let failed = 0;
const check = (name, ok, why = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !why ? "" : `  (${why})`}`); if (!ok) failed++; };

// Expected results per page. `live` runs only against the real model.
const CASES = [
  { page: "phish.html", has: { password_field: true, payment_field: true, sensitive_id_field: true, offsite_form: true },
    live: (r) => r.verdict === "danger" && r.risk_score >= 85 && r.prompt_injection_attempts.length > 0, expect: "danger, 85+, injection caught" },
  { page: "safe.html", has: { password_field: false, payment_field: false, sensitive_id_field: false, offsite_form: false },
    live: (r) => r.verdict !== "danger" && r.risk_score <= 40, expect: "not danger, 40 or less" },
  { page: "store.html", has: { password_field: false, payment_field: false, sensitive_id_field: false, offsite_form: false },
    live: (r) => r.verdict !== "safe" && r.risk_score >= 60, expect: "caution or danger, 60+" },
];

// Rough stand-in for content.js: enough structure to exercise the backend with realistic input.
function signalsFrom(html, pageUrl) {
  const host = new URL(pageUrl).hostname;
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const actions = [...html.matchAll(/<form\b[^>]*action="([^"]*)"/gi)].map((m) => new URL(m[1], pageUrl).hostname);
  const offsite = [...new Set(actions.filter((h) => h !== host))];
  const password = inputs.some((i) => /type="password"/i.test(i));
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    signals: {
      title, https: pageUrl.startsWith("https:"),
      forms: { count: (html.match(/<form\b/gi) ?? []).length, password_field: password,
        payment_field: inputs.some((i) => /cc-|card|cvv|cvc|expir/i.test(i)),
        sensitive_id_field: inputs.some((i) => /ssn|social.?security|routing|account.?num/i.test(i)),
        submits_offsite_to: offsite, password_over_http: password && !pageUrl.startsWith("https:") },
    },
    text,
  };
}

// Lane rule: only RFC 5737 documentation IPs in test pages.
const DOC_IP = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/;
for (const f of readdirSync(here).filter((f) => f.endsWith(".html"))) {
  const ips = readFileSync(path.join(here, f), "utf8").match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? [];
  const bad = ips.filter((ip) => !DOC_IP.test(ip));
  check(`${f} uses only RFC 5737 IPs`, bad.length === 0, bad.join(", "));
}

const PORT = "8798";
const base = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, [path.join(root, "server", "server.js")], { cwd: root, env: { ...process.env, PORT }, stdio: "pipe" });
srv.stderr.on("data", (d) => process.stderr.write(d));
await new Promise((resolve, reject) => { srv.stdout.once("data", resolve); srv.once("exit", reject); });

try {
  const health = await (await fetch(`${base}/health`)).json();
  const live = !health.mock;
  console.log(`Backend: ${live ? `LIVE (${health.model}), verdicts checked` : "MOCK, verdict checks skipped (set ANTHROPIC_API_KEY for live)"}`);

  for (const c of CASES) {
    const pageUrl = `${base}/test/${c.page}`;
    const page = await fetch(pageUrl);
    check(`${c.page} served`, page.ok, `status ${page.status}`);
    if (!page.ok) continue;
    const { signals, text } = signalsFrom(await page.text(), pageUrl);

    const got = { ...signals.forms, offsite_form: signals.forms.submits_offsite_to.length > 0 };
    const wrong = Object.entries(c.has).filter(([k, v]) => got[k] !== v).map(([k]) => k);
    check(`${c.page} has the intended signals`, wrong.length === 0, `mismatch: ${wrong.join(", ")}`);

    const res = await fetch(`${base}/api/vet`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "chrome-extension://sitevettere2e" },
      body: JSON.stringify({ url: pageUrl, signals, text }) });
    const data = await res.json();
    check(`${c.page} POST /api/vet -> 200`, res.status === 200, data.error ?? `status ${res.status}`);
    if (res.status !== 200) continue;

    const r = data.report;
    const missing = REPORT_SCHEMA.required.filter((k) => !(k in r));
    check(`${c.page} report has every schema field`, missing.length === 0, `missing: ${missing.join(", ")}`);
    check(`${c.page} verdict and score are valid`,
      REPORT_SCHEMA.properties.verdict.enum.includes(r.verdict) && Number.isInteger(r.risk_score) && r.risk_score >= 0 && r.risk_score <= 100,
      `${r.verdict} ${r.risk_score}`);
    if (live) check(`${c.page} verdict: ${c.expect}`, c.live(r), `got ${r.verdict} ${r.risk_score}`);
  }
} finally {
  srv.kill();
}
process.exit(failed ? 1 : 0);
