"""AgreeWise AI server (FastAPI). Run: uvicorn main:app --reload"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from core import STATIC, RateLimiter, build_extension_zip, handle_analyze

app = FastAPI(title="AgreeWise AI")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])
limiter = RateLimiter()


@app.post("/analyze")
async def analyze(request: Request):
    ip = request.client.host if request.client else "unknown"
    if not limiter.allow(ip):
        raise HTTPException(status_code=429, detail="Too many checks. Please wait a few minutes.")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Send JSON with 'text' or 'url'.")
    try:
        return handle_analyze(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch or analyse that policy.")


@app.get("/download/extension")
def download_extension(request: Request):
    data = build_extension_zip(str(request.base_url))
    return Response(data, media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="agreewise-extension.zip"'})


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
