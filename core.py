"""Server helpers shared by the FastAPI app (main.py) and the stdlib dev server."""
import io
import json
import time
import zipfile
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlparse

from analyzer import analyze_text, fetch_url_text

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
EXT_DIR = ROOT / "extension"


class RateLimiter:
    """Simple in-memory limit per client IP, to protect the AI API key on a public demo."""

    def __init__(self, limit=20, window=600):
        self.limit, self.window = limit, window
        self.hits = defaultdict(deque)

    def allow(self, ip: str) -> bool:
        now = time.time()
        if len(self.hits) > 10_000:
            self.hits.clear()
        q = self.hits[ip]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True


def handle_analyze(payload: dict) -> dict:
    """Raises ValueError for bad input (400); other exceptions mean 502."""
    text = (payload or {}).get("text") or ""
    url = (payload or {}).get("url") or ""
    if not text and url:
        text = fetch_url_text(url)
    if not text:
        raise ValueError("Paste policy text or enter a URL.")
    return analyze_text(str(text))


def build_extension_zip(base_url: str) -> bytes:
    """Zip the extension with this server's address filled in, so it works with no setup."""
    base = base_url.rstrip("/")
    p = urlparse(base)
    host_pattern = f"{p.scheme}://{p.hostname}/*"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(EXT_DIR.rglob("*")):
            if f.is_dir():
                continue
            rel = f.relative_to(EXT_DIR).as_posix()
            data = f.read_bytes()
            if rel == "config.js":
                data = f"const AGREEWISE_API = {json.dumps(base)};\n".encode()
            elif rel == "manifest.json":
                m = json.loads(data)
                perms = m.setdefault("host_permissions", [])
                if host_pattern not in perms:
                    perms.append(host_pattern)
                data = json.dumps(m, indent=2).encode()
            z.writestr("agreewise-extension/" + rel, data)
    return buf.getvalue()
