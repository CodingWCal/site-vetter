// OWNER: Lane 3 (Page signals). Injected into the current tab only when the user clicks
// the extension (activeTab). The value of the last expression is returned to popup.js.
// Collect page structure, never what the user typed into fields.
(() => {
  const host = location.hostname;
  const hostOf = (u) => { try { return new URL(u, location.href).hostname; } catch { return ""; } };
  const sameSite = (h) => h === host || h.endsWith("." + host) || host.endsWith("." + h);
  const TRACKERS = ["google-analytics.com", "googletagmanager.com", "doubleclick.net", "facebook.net",
    "facebook.com", "hotjar.com", "segment.com", "segment.io", "mixpanel.com", "clarity.ms", "tiktok.com",
    "linkedin.com", "criteo.com", "adnxs.com", "taboola.com", "outbrain.com", "amplitude.com", "fullstory.com",
    "scorecardresearch.com", "quantserve.com", "amazon-adsystem.com", "googlesyndication.com"];

  // Forms: what they ask for and where they send it
  const inputs = [...document.querySelectorAll("input")];
  const describe = (i) => `${i.type} ${i.name} ${i.id} ${i.placeholder} ${i.autocomplete}`;
  const forms = [...document.forms].map((f) => {
    const action = f.getAttribute("action") || location.href;
    let target = "";
    try {
      const parsed = new URL(action, location.href);
      target = /^https?:$/.test(parsed.protocol) ? parsed.hostname : parsed.protocol;
    } catch { /* Ignore malformed actions; the browser will not submit them normally. */ }
    return target;
  });
  const passwordField = inputs.some((i) => i.type === "password");

  // Links whose visible text shows a domain different from where they go
  const links = [...document.querySelectorAll("a[href]")].filter((a) => /^https?:/.test(a.href));
  const mismatched = [];
  for (const a of links) {
    const shown = a.textContent.trim().match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i)?.[0].toLowerCase().replace(/^www\./, "");
    const real = hostOf(a.href);
    if (shown && real && !real.endsWith(shown)) mismatched.push({ shown: a.textContent.trim().slice(0, 80), goes_to: real });
    if (mismatched.length >= 10) break;
  }

  // Third parties loaded by the page
  const thirdParty = [...new Set(
    [...document.querySelectorAll("script[src], img[src], iframe[src]")]
      .map((el) => hostOf(el.src)).filter((h) => h && !sameSite(h)),
  )];
  const knownTrackers = thirdParty.filter((h) => TRACKERS.some((t) => h === t || h.endsWith("." + t)));

  // A page can claim a familiar brand while running on an unrelated host.
  const identityText = [
    document.title,
    ...[...document.querySelectorAll("h1, h2, h3, [role='banner'], img[alt], [aria-label]")]
      .map((el) => el.getAttribute("alt") || el.getAttribute("aria-label") || el.textContent),
  ].join(" ");
  const brandWords = identityText
    .match(/\b(?:paypal|microsoft|apple|amazon|google|facebook|instagram|netflix|chase|wells\s+fargo|bank)\b/gi) ?? [];
  const claimedBrands = [...new Set(brandWords.map((brand) => brand.toLowerCase().replace(/\s+/g, " ")))];
  // Compare each brand against the registrable label only. "bankofamerica.com" legitimately
  // contains "bank", while in "paypal.com.evil.co" the real site is "evil" and "paypal" is bait.
  const labels = host.split(".");
  const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);
  const core = (SECOND_LEVEL.has(labels.at(-2)) ? labels.at(-3) : labels.at(-2)) ?? host;
  const brandHostMismatch = claimedBrands.filter((b) => !core.includes(b.replace(/\s+/g, "")));

  // Text a person can't see but an AI would read: where prompt injections hide
  const hidden = [];
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE", "SVG", "PATH"]);
  let scanned = 0;
  for (const el of document.body.querySelectorAll("*")) {
    if (++scanned > 5000 || hidden.length >= 5) break;
    if (el.children.length || SKIP.has(el.tagName.toUpperCase())) continue;
    const t = el.textContent.trim();
    if (t.length < 20) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const invisible = el.getClientRects().length === 0 || s.visibility === "hidden" ||
      Number(s.opacity) === 0 || parseFloat(s.fontSize) < 3 || r.right < 0 || r.bottom < 0;
    if (invisible) hidden.push(t.slice(0, 300));
  }

  const fullText = document.body.innerText;
  return {
    title: document.title,
    https: location.protocol === "https:",
    forms: {
      count: forms.length,
      password_field: passwordField,
      payment_field: inputs.some((i) => /cc-|card|cvv|cvc|expir/i.test(describe(i))),
      sensitive_id_field: inputs.some((i) => /ssn|social.?security|routing|account.?num/i.test(describe(i))),
      // A hostname never ends in ":", a bare protocol (javascript:, mailto:) always does.
      submits_offsite_to: [...new Set(forms.filter((h) => h && (h.endsWith(":") || !sameSite(h))))],
      password_over_http: passwordField && location.protocol !== "https:",
    },
    links: { total: links.length, external: links.filter((a) => !sameSite(hostOf(a.href))).length, mismatched },
    brand: { claimed: claimedBrands.slice(0, 5), host_mismatch: brandHostMismatch.slice(0, 5) },
    third_party: { hosts: thirdParty.slice(0, 30), known_trackers: knownTrackers },
    hidden_text: hidden,
    text: fullText.slice(0, 15000),
    text_truncated: fullText.length > 15000,
  };
})();
