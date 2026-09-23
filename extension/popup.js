// OWNER: Lane 2 (Extension UI). Click -> read page (content.js) -> backend -> render.
// Note: Chrome closes the popup if you click away, which cancels the request. Keep it open.
const API = "http://localhost:8787";
const $ = (id) => document.getElementById(id);
const ICON = { red_flag: "🚩", warning: "⚠️", reassuring: "✅" };
const VERDICT = { danger: "Dangerous", caution: "Be careful", safe: "Looks safe" };

// Builds elements with textContent only. Never use innerHTML: page content is attacker-controlled.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(String(c ?? "")));
  return el;
}

function status(msg, isError = false) {
  $("status").textContent = msg;
  $("status").className = isError ? "muted error" : "muted";
}

$("vet").addEventListener("click", async () => {
  const btn = $("vet");
  btn.disabled = true;
  $("result").hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https?:/.test(tab?.url ?? "")) throw new Error("Open a website first. Browser pages like chrome:// can't be checked.");

    status("Reading the page…");
    const [{ result: signals }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const { text, ...rest } = signals;

    status("Checking domain age and asking Claude…");
    const res = await fetch(`${API}/api/vet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: tab.url, signals: rest, text }),
    }).catch(() => { throw new Error("Can't reach the backend. Is `npm start` running on port 8787?"); });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);

    render(data.report, data.meta);
    status("");
  } catch (err) {
    status(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

function render(r, meta) {
  $("verdict").className = `v-${r.verdict}`;
  $("verdict").replaceChildren(
    h("span", { class: "score" }, `${r.risk_score}/100`),
    h("span", { class: "badge" }, VERDICT[r.verdict] ?? r.verdict),
    h("div", { class: "headline" }, r.headline),
  );

  const age = meta.domain_age;
  $("domain").textContent = age?.age_days != null
    ? `${age.domain} registered ${new Date(age.created).toLocaleDateString()} (${age.age_days.toLocaleString()} days ago)`
    : `${age?.domain ?? ""}: ${age?.note ?? "domain age unknown"}`;

  $("injection").hidden = !r.prompt_injection_attempts.length;
  $("injection").replaceChildren(
    h("strong", {}, "⚠ This page tried to trick AI safety tools. We ignored it:"),
    ...r.prompt_injection_attempts.map((s) => h("q", {}, s)),
  );

  $("reasons").replaceChildren(...r.reasons.map((x) =>
    h("li", {}, `${ICON[x.impact] ?? "•"} `, h("span", { class: "label" }, x.label), h("div", { class: "muted" }, x.detail))));

  $("tracking").replaceChildren(
    h("strong", {}, `Tracking: ${r.tracking.level}. `), r.tracking.summary,
    r.tracking.trackers.length ? h("div", { class: "muted" }, r.tracking.trackers.join(", ")) : "",
  );

  $("advice").replaceChildren(...r.advice.map((a) => h("li", {}, a)));

  const bits = [meta.model, `${(meta.ms / 1000).toFixed(1)}s`];
  if (meta.redactions?.count) bits.push(`🔒 ${meta.redactions.count} secrets redacted before sending`);
  $("meta").textContent = bits.join(" · ");
  $("result").hidden = false;
}
