// OWNER: Lane 1 (Captain/backend). Strips secrets and card numbers from page content
// before it leaves this machine. Emails and domains are kept: they are phishing evidence.

const PATTERNS = [
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["aws-secret-key", /(AWS_SECRET_ACCESS_KEY\s*[=:]\s*)[A-Za-z0-9/+]{40}/g],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ["bearer-token", /(Bearer\s+)[A-Za-z0-9._~+/-]{20,}=*/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  // Not "pwd": sudo logs PWD= as the working directory.
  ["password", /(\b(?:password|passwd)\s*[=:]\s*)[^\s&"';]+/gi],
  ["ssn", /\b\d{3}-\d{2}-\d{4}\b/g],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
];

// Card numbers: 13-19 digits (spaces/dashes allowed) that pass the Luhn check.
function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export function redact(text) {
  const kinds = {};
  let out = text.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => {
    if (!luhn(m.replace(/\D/g, ""))) return m;
    kinds["card-number"] = (kinds["card-number"] || 0) + 1;
    return "[REDACTED:card-number]";
  });
  for (const [kind, re] of PATTERNS) {
    out = out.replace(re, (match, prefix) => {
      kinds[kind] = (kinds[kind] || 0) + 1;
      // Patterns with a capture group keep the label (e.g. "password=")
      return (typeof prefix === "string" ? prefix : "") + `[REDACTED:${kind}]`;
    });
  }
  const count = Object.values(kinds).reduce((a, b) => a + b, 0);
  return { text: out, count, kinds };
}
