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
  const forms = [...document.forms].map((f) => hostOf(f.action || location.href));
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
      submits_offsite_to: [...new Set(forms.filter((h) => h && !sameSite(h)))],
      password_over_http: passwordField && location.protocol !== "https:",
    },
    links: { total: links.length, external: links.filter((a) => !sameSite(hostOf(a.href))).length, mismatched },
    third_party: { hosts: thirdParty.slice(0, 30), known_trackers: knownTrackers },
    hidden_text: hidden,
    text: fullText.slice(0, 15000),
    text_truncated: fullText.length > 15000,
  };
})();
