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
| `analyzer.py` | Gemini AI analysis, keyword fallback, risk score |
| `core.py` | Shared server logic: analyze, rate limit, extension zip builder |
| `main.py` | FastAPI server (used in production) |
| `dev_server.py` | Same routes with no dependencies, for quick local runs |

## How it works

1. A content script spots Terms / Privacy pages (URL, title, or an "I agree" button) and shows a small badge.
   Nothing is sent until the user clicks it.
2. The page text goes to the server (`POST /analyze`) through the extension's background worker.
3. **AI mode (main):** Google **Gemini** (`gemini-2.5-flash` by default) reads the whole policy and returns,
   as structured JSON, the clauses that matter. Each is tagged `safe`, `caution` or `risky` with a plain
   reason in English and Tamil, plus a short summary in both languages. The model judges meaning, not
   keywords: "we do NOT sell your data" is good news, the company's own IP isn't a risk, a delivery
   address isn't location tracking.
4. The server checks every excerpt the model returns really appears in the policy and drops any it made up.
5. **Risk score** is computed in code, not by the model, so it is consistent: each risk category counts once,
   `risky x 15 + caution x 6`, capped at 100. Under 25 = Low, under 55 = Medium, else High.
6. **Keyword mode** (regex rules) is only a fallback: it runs if the key is missing or Gemini is unreachable,
   and the result says so.
7. The extension highlights flagged lines on the page and sets a LOW / MED / HIGH badge on its icon.

## Deploy (Render, free)

1. Push this folder to GitHub (`.env` is git-ignored, so your key stays private).
2. On render.com: **New > Blueprint**, pick the repo (it reads `render.yaml`).
3. In the service's **Environment** tab set `GEMINI_API_KEY` to your key (get one at aistudio.google.com).
   Optional: `GEMINI_MODEL` to use a different Gemini model.
4. Open the site URL. The **Download extension** button gives a zip that already points to your server.

The free tier sleeps when idle, so the first check after a break can take up to a minute.

## Run locally

```bash
cp .env.example .env          # then put your Gemini key in .env
python dev_server.py          # no install needed (Python 3.10+), AI mode works
# or the production server:
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000, click **Download extension**, then in Chrome:
`chrome://extensions` > **Developer mode** on > **Load unpacked** > choose the `agreewise-extension` folder.
Test it on http://localhost:8000/static/demo-terms.html. The panel says "AI analysis by Gemini" when AI mode is working.

## Safety and privacy

- Nothing is sent until the user clicks; policies are not stored.
- Page and policy text is untrusted: the prompt tells the model to ignore instructions inside it,
  and all UI uses `textContent` (no HTML injection). The on-page panel lives in a Shadow DOM.
- URL fetching only allows http(s) to public IPs, re-checked on every redirect.
- The Gemini key lives only on the server (env var or local `.env`), never in the extension or the repo.
- Per-IP rate limit (20 checks / 10 minutes) protects the API key on the public demo.
- A screening aid, not legal advice. Every flag shows the original clause text.

## Future scope

Chrome Web Store release, PDF policies, alerts when a policy changes, more Indian languages.
