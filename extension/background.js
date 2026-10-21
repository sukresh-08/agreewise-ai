importScripts("config.js");

const BADGE = {
  Low: { text: "LOW", color: "#2e9e5b" },
  Medium: { text: "MED", color: "#d48a00" },
  High: { text: "HIGH", color: "#d83a3a" },
};

const TIMEOUT_MS = 120000; // give up after 2 minutes instead of "Checking..." forever

async function analyze(text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(AGREEWISE_API + "/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text || "").slice(0, 400000) }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The server took too long. Please try again.");
    throw new Error("Could not reach the AgreeWise server. Check your internet and try again.");
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try { body = await res.json(); } catch (_) { /* not JSON */ }
  if (!res.ok) throw new Error((body && body.detail) || `Server error (${res.status})`);
  return body;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "agreewise:analyze") return;
  const tabId = msg.tabId || (sender.tab && sender.tab.id);
  analyze(msg.text)
    .then((data) => {
      const b = BADGE[data.level];
      if (tabId && b) {
        chrome.action.setBadgeText({ tabId, text: b.text });
        chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
      }
      sendResponse({ ok: true, data });
    })
    .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
  return true; // keep the channel open for the async reply
});
