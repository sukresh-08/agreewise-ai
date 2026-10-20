// AgreeWise AI content script.
// Shows a small "check these terms" badge on pages that look like Terms /
// Privacy pages or have an "I agree" control. Nothing is sent anywhere until
// the user clicks the badge (or uses the toolbar popup).
(() => {
  if (window.__agreewiseLoaded) return;
  window.__agreewiseLoaded = true;

  const URL_RX = /(terms|tos|privacy|legal|conditions|eula|user-agreement|policy)/i;
  const TITLE_RX = /(terms|privacy|conditions|policy|user agreement)/i;
  const AGREE_RX = /\b(i agree|i accept|accept (all|terms)|agree (and|&) continue|terms (of (service|use)|and conditions|& conditions)|privacy policy)\b/i;

  const LEVEL = {
    Low: { en: "Low risk", ta: "குறைந்த ஆபத்து", color: "#2e9e5b" },
    Medium: { en: "Medium risk", ta: "நடுத்தர ஆபத்து", color: "#d48a00" },
    High: { en: "High risk", ta: "அதிக ஆபத்து", color: "#d83a3a" },
  };
  const MARK = { risky: "rgba(216,58,58,.16)", caution: "rgba(245,185,66,.25)" };
  const LINE = { risky: "#d83a3a", caution: "#d48a00" };

  let host = null, root = null, lang = "en", data = null;
  const marked = new Map(); // element -> original style attribute

  function looksLikeTerms() {
    if (URL_RX.test(location.pathname)) return true;
    if (TITLE_RX.test(document.title || "")) return true;
    const els = document.querySelectorAll("button, a, label, input[type=submit], input[type=button]");
    for (const el of els) {
      const s = (el.innerText || el.value || "").trim();
      if (s && s.length < 80 && AGREE_RX.test(s)) return true;
    }
    return false;
  }

  function pageText() {
    // Use <main>/<article> only when it holds most of the page; otherwise the whole body,
    // so long Terms pages split across several sections are read in full.
    const body = (document.body && document.body.innerText) || "";
    const main = document.querySelector("main, article, [role=main]");
    const m = (main && main.innerText) || "";
    const t = m.length > 500 && m.length >= body.length * 0.6 ? m : body;
    return t.slice(0, 400000);
  }

  // ---------- highlighting ----------
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

  function clearHighlights() {
    for (const [el, old] of marked) {
      if (old === null) el.removeAttribute("style"); else el.setAttribute("style", old);
      el.removeAttribute("data-agreewise");
    }
    marked.clear();
  }

  function highlight(clauses) {
    clearHighlights();
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.nodeValue && n.nodeValue.trim().length > 20 && !(host && host.contains(n))) nodes.push(n);
    }
    const texts = nodes.map((n) => norm(n.nodeValue));
    let first = null;
    for (const c of clauses || []) {
      if (c.risk !== "risky" && c.risk !== "caution") continue;
      const key = norm(c.text).replace(/^["“'….\s]+/, "").slice(0, 50);
      if (key.length < 15) continue;
      const i = texts.findIndex((t) => t.includes(key));
      if (i < 0) continue;
      const el = nodes[i].parentElement;
      if (!el || marked.has(el)) continue;
      marked.set(el, el.getAttribute("style"));
      el.setAttribute("data-agreewise", c.risk);
      el.style.background = MARK[c.risk];
      el.style.outline = `2px solid ${LINE[c.risk]}`;
      el.style.borderRadius = "4px";
      el.title = "AgreeWise AI: " + (lang === "ta" ? c.why_ta : c.why_en);
      if (!first) first = el;
    }
    return first;
  }

  // ---------- on-page badge / panel (shadow DOM keeps page CSS out) ----------
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, "Noto Sans Tamil", sans-serif; }
    .wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .pill { display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 10px 14px; border-radius: 999px;
            background: linear-gradient(90deg,#f4a261,#ed7d31); color: #fff; font-weight: 700; font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
    .pill:disabled { opacity: .8; cursor: wait; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #fff; }
    .panel { width: min(340px, calc(100vw - 32px)); max-height: 70vh; overflow: auto; background: #13213f; color: #e8eefc;
             border-radius: 14px; padding: 14px; box-shadow: 0 8px 28px rgba(0,0,0,.35); font-size: 14px; line-height: 1.45; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .brand { font-weight: 800; font-size: 15px; } .brand b { color: #f4a261; }
    .x { background: none; border: 0; color: #93a3c4; font-size: 18px; cursor: pointer; }
    .score { display: flex; align-items: center; gap: 12px; margin: 10px 0; }
    .badge { min-width: 70px; text-align: center; border-radius: 12px; padding: 8px; color: #111; font-weight: 800; }
    .badge b { display: block; font-size: 24px; line-height: 1; }
    .lvl { font-weight: 800; font-size: 16px; } .muted { color: #93a3c4; font-size: 12px; }
    ul { margin: 6px 0 0; padding-left: 18px; } li { margin: 3px 0; }
    .tabs { display: flex; gap: 6px; margin-top: 10px; }
    .tab { flex: 1; border: 1px solid #3a4b70; background: transparent; color: #e8eefc; padding: 6px; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .tab.on { background: #ed7d31; border-color: #ed7d31; color: #fff; font-weight: 700; }
    .err { color: #ffb3b3; }
  `;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function mount() {
    if (host) return;
    host = document.createElement("div");
    host.id = "agreewise-root";
    root = host.attachShadow({ mode: "open" });
    const style = el("style"); style.textContent = CSS;
    const wrap = el("div", "wrap");
    const panel = el("div", "panel"); panel.hidden = true;
    const pill = el("button", "pill");
    pill.append(el("span", "dot"), el("span", "", "AgreeWise: check these terms"));
    pill.addEventListener("click", () => run());
    wrap.append(panel, pill);
    root.append(style, wrap);
    document.documentElement.appendChild(host);
  }

  const $ = (sel) => root.querySelector(sel);

  function setPill(text, busy) {
    const pill = $(".pill");
    pill.disabled = !!busy;
    pill.lastChild.textContent = text;
  }

  function render() {
    const panel = $(".panel");
    panel.hidden = false;
    panel.textContent = "";
    const head = el("div", "row");
    const brand = el("div", "brand"); brand.append("Agree", el("b", "", "Wise"), " AI");
    const x = el("button", "x", "×"); x.title = "Close";
    x.addEventListener("click", () => { panel.hidden = true; clearHighlights(); });
    head.append(brand, x);
    panel.append(head);

    if (data && data.__error) {
      panel.append(el("p", "err", data.__error));
      return;
    }
    const L = LEVEL[data.level] || LEVEL.Medium;
    const score = el("div", "score");
    const badge = el("div", "badge"); badge.style.background = L.color;
    badge.append(el("b", "", String(data.score)), "/100");
    const info = el("div");
    info.append(el("div", "lvl", lang === "ta" ? L.ta : L.en),
      el("div", "muted", lang === "ta"
        ? `${data.risky} ஆபத்தான · ${data.caution} கவனிக்க · பக்கத்தில் குறிக்கப்பட்டது`
        : `${data.risky} risky · ${data.caution} caution · marked on the page`));
    score.append(badge, info);
    panel.append(score);

    const ul = el("ul");
    for (const s of (lang === "ta" ? data.summary_ta : data.summary_en) || []) ul.append(el("li", "", s));
    panel.append(ul);

    const tabs = el("div", "tabs");
    for (const [code, label] of [["en", "English"], ["ta", "தமிழ்"]]) {
      const b = el("button", "tab" + (lang === code ? " on" : ""), label);
      b.addEventListener("click", () => { lang = code; render(); highlight(data.clauses); });
      tabs.append(b);
    }
    panel.append(tabs);
    panel.append(el("p", "muted", data.mode === "llm" ? "AI analysis by Gemini. Not legal advice."
      : (data.note || "Keyword analysis (AI unavailable).")));
  }

  function show(result) {
    mount();
    data = result;
    render();
    const first = highlight(result.clauses);
    const L = LEVEL[result.level];
    setPill(L ? `AgreeWise: ${L.en} (${result.score}/100)` : "AgreeWise: done", false);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function run() {
    mount();
    setPill("Checking… (first check can take up to a minute)", true);
    chrome.runtime.sendMessage({ type: "agreewise:analyze", text: pageText() }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        data = { __error: "Could not reach the AgreeWise server. Try again." };
        render(); setPill("AgreeWise: try again", false);
        return;
      }
      if (!resp.ok) {
        data = { __error: resp.error };
        render(); setPill("AgreeWise: try again", false);
        return;
      }
      show(resp.data);
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "agreewise:getText") sendResponse({ text: pageText(), title: document.title });
    else if (msg.type === "agreewise:show") { show(msg.data); sendResponse({ ok: true }); }
  });

  if (looksLikeTerms()) mount();
})();
