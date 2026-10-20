importScripts("config.js");

const BADGE = {
  Low: { text: "LOW", color: "#2e9e5b" },
  Medium: { text: "MED", color: "#d48a00" },
  High: { text: "HIGH", color: "#d83a3a" },
};

async function analyze(text) {
  const res = await fetch(AGREEWISE_API + "/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: String(text || "").slice(0, 60000) }),
  });
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
