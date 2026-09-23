// OWNER: Lane 7 (Threat checks). Flags lookalike / brand-impersonation domains,
// e.g. "paypa1.com", "amaz0n-support.net", "chase.com.secure-login.io".
// server.js passes the result to Claude inside <facts> as `lookalike`.
// Keep it pure and fast: no network calls, no new dependencies.

// Commonly phished brands. `key` is matched against domain labels; `official` are the brand's real
// registrable domains (subdomains of these are fine); `names` are matched against the page title.
const BRANDS = [
  { key: "paypal", names: ["PayPal"], official: ["paypal.com", "paypal.me", "paypalobjects.com"] },
  { key: "amazon", names: ["Amazon"], official: ["amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.in", "amazonaws.com", "amazon.jobs"] },
  { key: "apple", names: ["Apple", "Apple ID"], official: ["apple.com", "icloud.com"] },
  { key: "icloud", names: ["iCloud"], official: ["icloud.com", "apple.com"] },
  { key: "microsoft", names: ["Microsoft", "Office 365"], official: ["microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "office365.com"] },
  { key: "outlook", names: ["Outlook"], official: ["outlook.com", "live.com", "microsoft.com", "office.com"] },
  { key: "google", names: ["Google"], official: ["google.com", "gmail.com", "googleusercontent.com", "youtube.com", "google.co.uk"] },
  { key: "gmail", names: ["Gmail"], official: ["gmail.com", "google.com"] },
  { key: "chase", names: ["Chase"], official: ["chase.com", "jpmorganchase.com"] },
  { key: "bankofamerica", names: ["Bank of America"], official: ["bankofamerica.com", "bofa.com"] },
  { key: "wellsfargo", names: ["Wells Fargo"], official: ["wellsfargo.com"] },
  { key: "citi", names: ["Citi"], official: ["citi.com", "citibank.com"] },
  { key: "citibank", names: ["Citibank"], official: ["citibank.com", "citi.com"] },
  { key: "capitalone", names: ["Capital One"], official: ["capitalone.com"] },
  { key: "americanexpress", names: ["American Express", "Amex"], official: ["americanexpress.com", "aexp.com"] },
  { key: "netflix", names: ["Netflix"], official: ["netflix.com"] },
  { key: "facebook", names: ["Facebook"], official: ["facebook.com", "fb.com", "meta.com"] },
  { key: "instagram", names: ["Instagram"], official: ["instagram.com"] },
  { key: "whatsapp", names: ["WhatsApp"], official: ["whatsapp.com", "whatsapp.net"] },
  { key: "linkedin", names: ["LinkedIn"], official: ["linkedin.com"] },
  { key: "coinbase", names: ["Coinbase"], official: ["coinbase.com"] },
  { key: "binance", names: ["Binance"], official: ["binance.com", "binance.us"] },
  { key: "dropbox", names: ["Dropbox"], official: ["dropbox.com"] },
  { key: "docusign", names: ["DocuSign"], official: ["docusign.com", "docusign.net"] },
  { key: "usps", names: ["USPS", "Postal Service"], official: ["usps.com"] },
  { key: "fedex", names: ["FedEx"], official: ["fedex.com"] },
  { key: "ups", names: ["UPS"], official: ["ups.com"] },
  { key: "dhl", names: ["DHL"], official: ["dhl.com", "dhl.de"] },
  { key: "irs", names: ["IRS", "Internal Revenue Service"], official: ["irs.gov"] },
];

// Words phishers bolt onto a brand: "paypal-secure-login.com".
const BAIT_WORDS = ["login", "signin", "secure", "verify", "verification", "account", "support", "update",
  "billing", "wallet", "auth", "confirm", "unlock", "recovery", "helpdesk", "service", "alert"];

// Title words that mean "this page wants you to log in or pay", so a brand in the title matters.
const TITLE_BAIT = /\b(log ?in|sign ?in|sign on|account|verify|verification|password|secure|suspended|locked|unlock|update|billing|payment|confirm|wallet)\b/i;

// Second-level public suffixes, so "evil.co.uk" -> registrable "evil.co.uk", not "co.uk".
const MULTI_TLD = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "co.nz", "co.jp",
  "co.in", "com.br", "com.mx", "co.za", "com.sg"]);

// Undo common character swaps: paypa1 -> paypal, amaz0n -> amazon, rnicrosoft -> microsoft.
function unconfuse(s) {
  return s
    .replace(/rn/g, "m").replace(/vv/g, "w")
    .replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/4/g, "a")
    .replace(/5/g, "s").replace(/7/g, "t").replace(/8/g, "b").replace(/\$/g, "s").replace(/@/g, "a");
}

// Optimal string alignment distance (Levenshtein + adjacent swaps), capped for speed.
function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function splitHost(host) {
  const labels = host.split(".");
  const n = MULTI_TLD.has(labels.slice(-2).join(".")) ? 3 : 2;
  return { registrable: labels.slice(-n).join("."), sld: labels[labels.length - n] || "", subLabels: labels.slice(0, -n) };
}

const isOfficial = (brand, registrable) => brand.official.includes(registrable);

// Does a domain label contain the brand? Short keys (ups, irs, citi, apple, chase) must be a whole
// hyphen-separated token so "groups" or "pineapple" don't match; long keys may be embedded ("paypalsecure").
function labelHasBrand(label, key) {
  const tokens = label.split("-");
  if (tokens.includes(key)) return true;
  return key.length >= 6 && label.replace(/-/g, "").includes(key);
}

function typoOf(label, key) {
  if (key.length < 6) return false;
  return label.split("-").some((t) => t !== key && editDistance(t, key) === 1);
}

export function lookalikeChecks(host, title = "") {
  const findings = [];
  host = String(host || "").toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  // Local dev, bare hostnames and raw IPs have no brand to impersonate (IP forms are Lane 3's signal).
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return findings;

  const { registrable, sld, subLabels } = splitHost(host);
  const officialFor = BRANDS.find((b) => isOfficial(b, registrable));

  if (host.split(".").some((l) => l.startsWith("xn--"))) {
    findings.push({ kind: "punycode", detail: `The domain "${host}" uses encoded international characters, a common trick to make a fake domain look identical to a real one.` });
  }

  const seen = new Set();
  const add = (brand, kind, detail) => {
    if (seen.has(brand.key + kind)) return;
    seen.add(brand.key + kind);
    findings.push({ kind, brand: brand.names[0], detail });
  };

  const sldClean = unconfuse(sld);
  const bait = BAIT_WORDS.filter((w) => sld.includes(w));
  const baitNote = bait.length ? ` It also adds bait words (${bait.join(", ")}).` : "";

  for (const brand of BRANDS) {
    if (isOfficial(brand, registrable) || officialFor) continue;
    const label = brand.names[0];

    // 1. Brand spelled with swapped characters: paypa1.com, amaz0n-support.net
    if (sldClean !== sld && labelHasBrand(sldClean, brand.key) && !labelHasBrand(sld, brand.key)) {
      add(brand, "lookalike", `"${registrable}" imitates ${label} by swapping look-alike characters. The real site is ${brand.official[0]}.${baitNote}`);
    // 2. Brand plus extra words on someone else's domain: paypal-secure-login.com
    } else if (labelHasBrand(sld, brand.key)) {
      add(brand, "lookalike", `"${registrable}" contains the name ${label} but is not an official ${label} domain (${brand.official[0]}).${baitNote}`);
    // 3. One-letter typo: amazom.com, gooogle.com, paypla.com
    } else if (typoOf(sldClean, brand.key)) {
      add(brand, "lookalike", `"${registrable}" is one letter off from ${label}'s real domain ${brand.official[0]}.`);
    }

    // 4. Brand buried in a subdomain of an unrelated domain: chase.com.verify-login.io
    if (subLabels.some((l) => labelHasBrand(unconfuse(l), brand.key))) {
      add(brand, "brand_in_subdomain", `"${host}" puts ${label} at the front, but the site actually belongs to "${registrable}", not ${brand.official[0]}.`);
    }

    // 5. Title claims a brand on a login/payment page the domain doesn't match
    if (title && TITLE_BAIT.test(title) && brand.names.some((n) => new RegExp(`\\b${n}\\b`, "i").test(title))) {
      add(brand, "brand_mismatch", `The page title "${String(title).slice(0, 80)}" presents itself as ${label}, but the domain "${registrable}" is not ${label}'s (${brand.official[0]}).`);
    }
  }
  return findings;
}
