# AgreeWise AI · Chrome Extension

Know what you agree to, before you click "I Agree".
AgreeWise is a Chrome extension that reads Terms & Conditions and privacy policies for you:
risky clauses are highlighted on the page, you get a Low / Medium / High risk score, and a
plain summary in English and Tamil.

DEXATHON 2026 · Open Innovation · Team DEX26150

## What is in this repo

| Path | What it is |
|---|---|
| `extension/` | The Chrome extension (Manifest V3): on-page badge, highlights, toolbar popup |
| `static/index.html` | Website: download, install guide, "Try it live" demo |
| `static/demo-terms.html` | A fictional sample Terms page for testing the extension |
| `analyzer.py` | Clause splitting, AI analysis (with keyword fallback), risk score |
| `core.py` | Shared server logic: analyze, rate limit, extension zip builder |
| `main.py` | FastAPI server (used in production) |
| `dev_server.py` | Same routes with no dependencies, for quick local runs |

## How it works

1. A content script spots Terms / Privacy pages (URL, title, or an "I agree" button) and shows a small badge.
   Nothing is sent until the user clicks it.
2. The page text goes to the server (`POST /analyze`) through the extension's background worker.
3. **AI mode** (`ANTHROPIC_API_KEY` set): an LLM returns the clauses that matter, each tagged
   `safe`, `caution` or `risky` with a one-line reason in English and Tamil.
   **Keyword mode** (no key, or if the AI call fails): regex rules over 10 categories.
4. The risk score is computed in code, not by the model, so it is consistent:
   `risky x 15 + caution x 6`, capped at 100. Under 25 = Low, under 55 = Medium, else High.
5. The extension highlights flagged lines on the page and sets a LOW / MED / HIGH badge on its icon.

## Deploy (Render, free)

1. Push this folder to GitHub.
2. On render.com: **New > Blueprint**, pick the repo (it reads `render.yaml`).
3. Add the environment variable `ANTHROPIC_API_KEY`.
4. Open the site URL. The **Download extension** button gives a zip that already points to your server.

The free tier sleeps when idle, so the first check after a break can take up to a minute.

## Run locally

```bash
python dev_server.py            # no install needed, keyword mode
# or the production server:
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key   # optional
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000, click **Download extension**, then in Chrome:
`chrome://extensions` > **Developer mode** on > **Load unpacked** > choose the `agreewise-extension` folder.
Test it on http://localhost:8000/static/demo-terms.html.

## Safety and privacy

- Nothing is sent until the user clicks; policies are not stored.
- Page and policy text is untrusted: the prompt tells the model to ignore instructions inside it,
  and all UI uses `textContent` (no HTML injection). The on-page panel lives in a Shadow DOM.
- URL fetching only allows http(s) to public IPs, re-checked on every redirect.
- Per-IP rate limit (20 checks / 10 minutes) protects the API key on the public demo.
- A screening aid, not legal advice. Every flag shows the original clause text.

## Future scope

Chrome Web Store release, PDF policies, alerts when a policy changes, more Indian languages.
