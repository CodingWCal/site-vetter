// OWNER: Lane 1 (Captain/backend). Local API the extension calls. The Claude key lives
// here, never in the extension.
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { REPORT_SCHEMA } from "./schema.js";
import { redact } from "./redact.js";
import { domainAge } from "./domain-age.js";
import { lookalikeChecks } from "./lookalike.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
loadEnv(path.join(root, ".env"));

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.MODEL || "claude-opus-5";
const EFFORT = process.env.EFFORT || "low"; // popup UX: fast beats exhaustive
const MAX_BODY = 200_000;
const MOCK = process.argv.includes("--mock") || process.env.MOCK === "1" ||
  (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN);

const client = MOCK ? null : new Anthropic();
const SYSTEM_PROMPT = await readFile(path.join(here, "prompt.md"), "utf8");

// Only the extension (or local tools with no Origin, like curl) may spend our API credits.
// A random website calling localhost:8787 from the user's browser gets a 403.
const EXTENSION_ORIGIN = /^(chrome-extension|extension|moz-extension):\/\//;

// Tiny .env reader so we don't depend on Node-version-specific flags (Mac + Windows).
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function vet({ url, signals = {}, text = "" }) {
  const host = new URL(url).hostname;
  const started = Date.now();
  const age = await domainAge(host);
  const lookalike = lookalikeChecks(host, signals.title);

  const content = redact(
    `Vet this page.\n\n<facts>\n${JSON.stringify({ url, domain_age: age, lookalike, signals }, null, 2)}\n</facts>\n\n` +
    `<page_text>\n${text}\n</page_text>`,
  );
  const meta = { mock: MOCK, model: MOCK ? "mock" : MODEL, domain_age: age,
    redactions: { count: content.count, kinds: content.kinds } };

  if (MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    // Fake-store demo gets its own canned verdict (Lane 4 file); falls back until it's merged.
    const storeMock = path.join(here, "mock-response-store.json");
    const mockFile = /store/i.test(url) && existsSync(storeMock) ? storeMock : path.join(here, "mock-response.json");
    const report = JSON.parse(await readFile(mockFile, "utf8"));
    return { report, meta: { ...meta, ms: Date.now() - started } };
  }

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // phishing content can trip safety classifiers; reroute instead of failing
    output_config: { effort: EFFORT, format: { type: "json_schema", schema: REPORT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: content.text }],
  });

  if (response.stop_reason === "refusal") {
    throw Object.assign(new Error(`Model declined (${response.stop_details?.category ?? "unknown"})`), { status: 422 });
  }
  if (response.stop_reason === "max_tokens") {
    throw Object.assign(new Error("Report was cut off (max_tokens)."), { status: 502 });
  }
  const json = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { report: JSON.parse(json), meta: { ...meta, model: response.model, ms: Date.now() - started, usage: response.usage } };
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, { "Content-Type": isJson ? "application/json" : "text/html; charset=utf-8", ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !EXTENSION_ORIGIN.test(origin)) return send(res, 403, { error: "Origin not allowed" });
  const cors = origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type" } : {};

  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "OPTIONS") return send(res, 204, "", cors);

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, mock: MOCK, model: MOCK ? "mock" : MODEL }, cors);
    }

    if (req.method === "POST" && url.pathname === "/api/vet") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > MAX_BODY) return send(res, 413, { error: "Page too large." }, cors);
      }
      const body = JSON.parse(raw || "{}");
      if (!/^https?:\/\//.test(body.url ?? "")) return send(res, 400, { error: "Send { url, signals, text } for an http(s) page." }, cors);
      return send(res, 200, await vet(body), cors);
    }

    // Demo pages, served over plain http on purpose (see test-pages/README.md)
    if (req.method === "GET" && url.pathname.startsWith("/test/")) {
      const dir = path.join(root, "test-pages");
      const file = path.resolve(dir, url.pathname.slice("/test/".length) || "index.html");
      if (!file.startsWith(dir + path.sep)) return send(res, 404, "Not found");
      const html = await readFile(file).catch(() => null);
      return html ? send(res, 200, html) : send(res, 404, "Not found");
    }

    send(res, 404, { error: "Not found" }, cors);
  } catch (err) {
    console.error(err);
    send(res, err.status ?? 500, { error: err.message ?? "Server error" }, cors);
  }
});

server.listen(PORT, () => {
  console.log(`Site Vetter backend on http://localhost:${PORT}  (${MOCK ? "MOCK mode, no API calls" : `${MODEL}, effort ${EFFORT}`})`);
  console.log(`Demo phishing page: http://localhost:${PORT}/test/phish.html`);
});
