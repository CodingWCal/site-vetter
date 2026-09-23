// OWNER: Lane 1 (Captain/backend). Domain registration date via RDAP (free, no API key).

const cache = new Map();
const TWO_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);

// Crude eTLD+1: good enough for .com / .co.uk style domains. Not a full public-suffix list.
export function registrableDomain(host) {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".");
  if (parts.length > 2 && TWO_LEVEL.has(parts.at(-2)) && parts.at(-1).length === 2) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export async function domainAge(host) {
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) {
    return { domain: host, created: null, age_days: null, note: "Local address or raw IP: no domain registration to check." };
  }
  const domain = registrableDomain(host);
  if (cache.has(domain)) return cache.get(domain);
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      // rdap.org returns 403 to the default Node user agent
      headers: { accept: "application/rdap+json", "user-agent": "site-vetter/0.1 (+https://github.com/CodingWCal/site-vetter)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`RDAP returned ${res.status}`);
    const data = await res.json();
    const created = data.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
    const out = {
      domain,
      created,
      age_days: created ? Math.floor((Date.now() - Date.parse(created)) / 86_400_000) : null,
      note: created ? "" : "Registry did not publish a registration date.",
    };
    cache.set(domain, out);
    return out;
  } catch (err) {
    return { domain, created: null, age_days: null, note: `Lookup failed: ${err.message}` };
  }
}
