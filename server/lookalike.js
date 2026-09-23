// OWNER: Lane 7 (Threat checks). Flags lookalike / brand-impersonation domains,
// e.g. "paypa1.com", "amaz0n-support.net", "chase.com.secure-login.io".
// server.js passes the result to Claude inside <facts> as `lookalike`.
// Keep it pure and fast: no network calls, no new dependencies.

export function lookalikeChecks(host, title = "") {
  const findings = [];
  // TODO(Lane 7): compare host against a short list of commonly-phished brands:
  //  - digit/letter swaps (0→o, 1→l, rn→m), extra hyphens/words ("-secure", "-login")
  //  - brand name buried in a subdomain of an unrelated domain
  //  - page title names a brand that the domain doesn't match
  // Each finding: { kind: "lookalike" | "brand_mismatch" | ..., detail: "..." }
  return findings;
}
