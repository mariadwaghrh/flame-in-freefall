"""TrustFlame web server: the dashboard (web/) and its JSON API (/api).

Usage:  python app.py            -> http://127.0.0.1:8000   (?lang=en for English, ?lang=ar for Arabic)
"""
import os
import re
import sys
import json
import argparse
import mimetypes

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "src"))
import config

app = FastAPI(title="TrustFlame")


def load(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return json.load(f)


CATALOG = load(config.PROCESSED, "catalog.json")
BY_ACC = {i["acc"]: i for i in CATALOG}
MATERIALS = load(config.PROCESSED, "materials.json")
TABLES = load(config.PROCESSED, "tables.json")
CURATED = load(config.CURATED, "investigations.json")
SCENARIOS = load(config.CURATED, "scenarios.json")["scenarios"]
CHUNKS = load(config.PROCESSED, "chunks.json")
RESOURCES = load(config.RAW, "resources", "index.json")
APPLICATIONS = load(config.PROCESSED, "applications.json")   # quotes checked by src/applications.py


@app.middleware("http")
async def no_stale_pages(request, call_next):
    resp = await call_next(request)
    if not request.url.path.startswith(("/api", "/media")):
        resp.headers["Cache-Control"] = "no-cache"     # the UI changes often during the hackathon
    return resp


@app.get("/api/meta")
def meta():
    return {
        "scenarios": SCENARIOS, "pillars": CURATED["pillars"], "families": CURATED["families"],
        "resources": RESOURCES,
        "stats": {
            "investigations": len(CATALOG), "flight": sum(i["kind"] == "flight" for i in CATALOG),
            "ground": sum(i["kind"] == "ground" for i in CATALOG), "test_rows": sum(i["n_tests"] for i in CATALOG),
            "publications": sum(len(i["publications"]) for i in CATALOG),
            "archive_tib": round(sum(i["archive_gb"] for i in CATALOG) * 1e9 / 2**40, 1),
            "archive_files": sum(i["archive"]["files"] for i in CATALOG),
            "passages": len(CHUNKS), "resources": len(RESOURCES),
        },
    }


@app.get("/api/catalog")
def catalog():
    return CATALOG


@app.get("/api/applications")
def applications():
    return APPLICATIONS


@app.get("/api/examples")
def examples():
    """Saved real runs of the suggested questions (src/examples.py), shown as the worked example on the home page."""
    path = os.path.join(config.PROCESSED, "examples.json")
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}


@app.get("/api/passages")
def passages():
    """All knowledge passages (used by the keyword search of the public copy)."""
    return [{k: c[k] for k in ("cite", "section", "url", "text")} for c in CHUNKS]


@app.get("/api/eval")
def eval_results():
    """Result of src/evaluate.py on the team's test questions (empty if not run yet)."""
    path = os.path.join(config.PROCESSED, "eval_results.json")
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}


@app.get("/api/materials")
def materials():
    return MATERIALS


def _flat_tests():
    """Every test row of every table, flattened for the Moon-readiness tool."""
    out = []
    for acc, tabs in TABLES.items():
        for t in tabs:
            if not t["is_test_table"]:
                continue
            for n in t["norm"]:
                if not (n.get("o2_all") or n.get("pressure_all") or n.get("fuel")):
                    continue
                out.append({"acc": acc, "table": t["label"], "fuel": n.get("fuel"), "o2": n.get("o2_all", []),
                            "atm": n.get("pressure_all", []), "flow": n.get("flow_all", []), "outcome": n.get("outcome")})
    return out


TESTS = _flat_tests()


@app.get("/api/tests")
def tests():
    return TESTS


@app.get("/api/tables/{acc}")
def tables(acc: str):
    if acc not in BY_ACC:
        raise HTTPException(404, "Unknown investigation")
    return TABLES.get(acc, [])


# ---------- Ask (loaded lazily so the dashboard starts even if the index is still building) ----------
_rag = None


def rag():
    global _rag
    if _rag is None:
        from rag import RAG
        _rag = RAG()
    return _rag


class AskBody(BaseModel):
    question: str
    lang: str = "en"
    only: list[str] | None = None


@app.get("/api/status")
def status():
    from rag import llm_available
    return {"llm": llm_available(), "llm_model": config.LLM_MODEL, "embed_model": config.EMBED_MODEL}


@app.post("/api/ask")
def ask(body: AskBody):
    q = body.question.strip()[:600]
    if not q:
        raise HTTPException(400, "Empty question")

    def events():
        try:
            for ev in rag().ask(q, lang="ar" if body.lang == "ar" else "en", only=body.only):
                yield json.dumps(ev, ensure_ascii=False) + "\n"
        except Exception as ex:
            yield json.dumps({"stage": "error", "message": str(ex)}) + "\n"
    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.post("/api/summary/{acc}")
def summary(acc: str, lang: str = "en"):
    if acc not in BY_ACC:
        raise HTTPException(404, "Unknown investigation")
    return rag().summary(acc, lang="ar" if lang == "ar" else "en")


@app.get("/api/summaries")
def summaries():
    """Summaries already generated (cached), so they show instantly."""
    path = os.path.join(config.PROCESSED, "llm_cache.json")
    cache = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    out = {}
    for k, v in cache.items():
        if k.startswith("summary:"):
            ar_key = "ar:" + __import__("hashlib").sha1(v["final"].encode("utf-8")).hexdigest()
            out[v["acc"]] = {**v, "final_ar": cache.get(ar_key, {}).get("text"), "translation_ok": cache.get(ar_key, {}).get("ok")}
    return out


MEDIA_DIR = os.path.join(config.WEB, "media")


@app.get("/media/{name}")
def media(name: str, request: Request):
    """Flame images and videos, with HTTP Range support so videos can be scrubbed."""
    path = os.path.realpath(os.path.join(MEDIA_DIR, name))
    if not path.startswith(os.path.realpath(MEDIA_DIR) + os.sep) or not os.path.isfile(path):
        raise HTTPException(404, "Not found")
    size, ctype = os.path.getsize(path), mimetypes.guess_type(path)[0] or "application/octet-stream"
    m = re.match(r"bytes=(\d*)-(\d*)$", request.headers.get("range", "").strip())
    if not m or not (m.group(1) or m.group(2)):
        return FileResponse(path, media_type=ctype, headers={"Accept-Ranges": "bytes"})
    start, end = (int(m.group(1)), int(m.group(2)) if m.group(2) else size - 1) if m.group(1) else (max(0, size - int(m.group(2))), size - 1)
    end = min(end, size - 1)
    if start > end:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
    with open(path, "rb") as f:
        f.seek(start)
        data = f.read(end - start + 1)
    return Response(data, status_code=206, media_type=ctype,
                    headers={"Content-Range": f"bytes {start}-{end}/{size}", "Accept-Ranges": "bytes", "Content-Length": str(len(data))})


@app.get("/")
def index():
    return FileResponse(os.path.join(config.WEB, "index.html"))


app.mount("/", StaticFiles(directory=config.WEB), name="web")

if __name__ == "__main__":
    import uvicorn
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    uvicorn.run(app, host=a.host, port=a.port, log_level="warning")
