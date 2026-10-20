"""Zero-dependency local server with the same routes as main.py.

Use it to try AgreeWise without installing anything:  python dev_server.py
(The deployed version uses main.py with FastAPI.)
"""
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from core import STATIC, RateLimiter, build_extension_zip, handle_analyze

limiter = RateLimiter()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC), **kw)

    def _send(self, code, body, ctype="application/json", extra=None):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/health":
            return self._send(200, {"ok": True})
        if path == "/download/extension":
            host = self.headers.get("Host", f"localhost:{self.server.server_port}")
            return self._send(200, build_extension_zip(f"http://{host}"), "application/zip",
                              {"Content-Disposition": 'attachment; filename="agreewise-extension.zip"'})
        if path.startswith("/static/"):
            self.path = self.path[len("/static"):]
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/analyze":
            return self._send(404, {"detail": "Not found"})
        if not limiter.allow(self.client_address[0]):
            return self._send(429, {"detail": "Too many checks. Please wait a few minutes."})
        try:
            n = min(int(self.headers.get("Content-Length", 0)), 2_000_000)
            try:
                payload = json.loads(self.rfile.read(n) or b"{}")
            except json.JSONDecodeError:
                return self._send(400, {"detail": "Send JSON with 'text' or 'url'."})
            return self._send(200, handle_analyze(payload))
        except ValueError as exc:  # includes bad JSON
            return self._send(400, {"detail": str(exc)})
        except Exception:
            return self._send(502, {"detail": "Could not fetch or analyse that policy."})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.getenv("PORT", "8000"))
    print(f"AgreeWise AI running at http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
