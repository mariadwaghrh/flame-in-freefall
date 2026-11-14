"""Export the JSON the website reads as static files (web/api/*.json).

With these files the site also runs without the Python server, for example on GitHub Pages: every page works,
and the Ask page replays the saved real runs from src/examples.py (a static host has no local model).
The site detects this by itself: if api/status does not answer, it reads the exported files.

Run after build.py / index.py / evaluate.py / examples.py:   python src/export_static.py
"""
import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "src"))
import config
import app as server


def write(name, obj):
    path = os.path.join(config.WEB, "api", name + ".json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def main():
    total = 0
    for name, fn in (("meta", server.meta), ("catalog", server.catalog), ("materials", server.materials), ("tests", server.tests),
                     ("applications", server.applications), ("eval", server.eval_results), ("examples", server.examples), ("summaries", server.summaries)):
        total += write(name, fn())
    total += write("passages", [{k: c[k] for k in ("cite", "section", "url", "text")} for c in server.CHUNKS])
    for inv in server.CATALOG:
        total += write("tables/" + inv["acc"], server.tables(inv["acc"]))
    # a page at the repository root that forwards to the site, and no Jekyll processing on GitHub Pages
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write('<!doctype html>\n<meta charset="utf-8">\n<title>TrustFlame</title>\n<meta http-equiv="refresh" content="0; url=web/?lang=en">\n'
                '<link rel="canonical" href="web/">\n<p><a href="web/?lang=en">Open TrustFlame</a></p>\n')
    open(os.path.join(ROOT, ".nojekyll"), "w").close()
    print(f"exported {len(server.CATALOG) + 8} files to web/api ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
