const LEVEL = {
  Low: { en: "Low risk", ta: "குறைந்த ஆபத்து", color: "#2e9e5b" },
  Medium: { en: "Medium risk", ta: "நடுத்தர ஆபத்து", color: "#d48a00" },
  High: { en: "High risk", ta: "அதிக ஆபத்து", color: "#d83a3a" },
};
let lang = "en", data = null;
const $ = (id) => document.getElementById(id);

function status(text, isErr) {
  $("status").textContent = text || "";
  $("status").className = isErr ? "err" : "";
}

function render() {
  if (!data) return;
  const L = LEVEL[data.level] || LEVEL.Medium;
  $("result").style.display = "block";
  const badge = $("badge");
  badge.textContent = "";
  badge.style.background = L.color;
  const n = document.createElement("b"); n.textContent = data.score;
  badge.append(n, "/100");
  $("lvl").textContent = lang === "ta" ? L.ta : L.en;
  $("counts").textContent = lang === "ta"
    ? `${data.risky} ஆபத்தான · ${data.caution} கவனிக்க`
    : `${data.risky} risky · ${data.caution} caution`;
  const ul = $("summary"); ul.textContent = "";
  for (const s of (lang === "ta" ? data.summary_ta : data.summary_en) || []) {
    const li = document.createElement("li"); li.textContent = s; ul.append(li);
  }
  const box = $("clauses"); box.textContent = "";
  for (const c of (data.clauses || []).slice(0, 8)) {
    const d = document.createElement("div"); d.className = "clause " + c.risk;
    const tag = document.createElement("b"); tag.textContent = c.risk;
    const why = document.createElement("p"); why.textContent = lang === "ta" ? c.why_ta : c.why_en;
    const q = document.createElement("p"); const qq = document.createElement("q"); qq.textContent = c.text; q.append(qq);
    d.append(tag, why, q); box.append(d);
  }
  $("note").textContent = data.mode === "llm" ? "AI analysis. Not legal advice." : (data.note || "Keyword analysis (AI key not set on server). Not legal advice.");
  for (const t of document.querySelectorAll(".tab")) t.classList.toggle("on", t.dataset.lang === lang);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function check(text, tabId) {
  if (!text || text.trim().length < 80) {
    status("Not enough text found. Paste the terms below.", true);
    $("pasteBox").open = true;
    return;
  }
  $("go").disabled = true; $("goPaste").disabled = true;
  status("Checking… the first check can take up to a minute.");
  try {
    const resp = await chrome.runtime.sendMessage({ type: "agreewise:analyze", text, tabId });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || "Could not reach the AgreeWise server.");
    data = resp.data; status(""); render();
    if (tabId) chrome.tabs.sendMessage(tabId, { type: "agreewise:show", data }).catch(() => {});
  } catch (e) {
    status(e.message || String(e), true);
  } finally {
    $("go").disabled = false; $("goPaste").disabled = false;
  }
}

$("go").addEventListener("click", async () => {
  const tab = await activeTab();
  let text = "";
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: "agreewise:getText" });
    text = r && r.text;
  } catch (_) {
    status("Can't read this page (browser pages are blocked). Paste the text below.", true);
    $("pasteBox").open = true;
    return;
  }
  check(text, tab.id);
});
$("goPaste").addEventListener("click", () => check($("paste").value, null));
for (const t of document.querySelectorAll(".tab")) t.addEventListener("click", () => { lang = t.dataset.lang; render(); });
