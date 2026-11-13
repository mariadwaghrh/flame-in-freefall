"""Step 1b: download the other NASA resources listed in the challenge's Resources tab, as plain text.

They become part of the knowledge base for the Ask page, each passage keeping its source link:
  - NASA Combustion Science (Glenn)              overview of the PSI combustion investigations
  - A Researcher's Guide to ISS Combustion Science  2015 NASA review (PDF, 50+ pages)
  - Apollo 1, Apollo 13, Mir fire                 lessons learned from real spacecraft fires
  - 3 NASA Spinoffs                               Earth benefits: firefighter air tanks, fire detector, fire attire

The ScienceCasts video is a YouTube link only (no text to index).

Output: data/raw/resources/<id>.txt and data/raw/resources/index.json
Usage:  python src/fetch_resources.py
"""
import os
import re
import sys
import json
import html
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

OUT = os.path.join(config.RAW, "resources")
HEADERS = {"User-Agent": config.USER_AGENT}

RESOURCES = [
    {"id": "glenn_combustion", "kind": "page", "title": "NASA Combustion Science (Glenn Research Center)",
     "url": "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"},
    {"id": "researchers_guide", "kind": "pdf", "title": "A Researcher's Guide to: International Space Station Combustion Science (NASA, 2015)",
     "url": "https://www.nasa.gov/wp-content/uploads/2016/05/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf",
     "page": "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/"},
    {"id": "apollo_1", "kind": "page", "title": "Apollo 1: lessons learned (NASA Safety and Mission Assurance)",
     "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"},
    {"id": "apollo_13", "kind": "page", "title": "Apollo 13: lessons learned (NASA Safety and Mission Assurance)",
     "url": "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13"},
    {"id": "mir_fire", "kind": "page", "title": "25 Years Ago: Fire Aboard Space Station Mir (NASA History)",
     "url": "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/"},
    {"id": "spinoff_air_tanks", "kind": "page", "title": "NASA Spinoff: Fireman's Air Tanks", "url": "https://spinoff.nasa.gov/node/9582"},
    {"id": "spinoff_fire_detector", "kind": "page", "title": "NASA Spinoff: Fire Detector", "url": "https://spinoff.nasa.gov/node/9407"},
    {"id": "spinoff_fire_attire", "kind": "page", "title": "NASA Spinoff: New Technology for the Fire Attire", "url": "https://spinoff.nasa.gov/node/9918"},
    {"id": "sciencecasts_video", "kind": "link", "title": "NASA ScienceCasts: The Power of Studying Combustion on the ISS (video, 2018)",
     "url": "https://www.youtube.com/watch?v=W1oXykoz9zg"},
]


def page_text(raw: str) -> str:
    """Readable text of an HTML page: paragraphs, headings and list items of the main article only."""
    body = raw
    for tag in ("article", "main"):
        m = re.search(rf"<{tag}[\s>].*?</{tag}>", raw, re.S | re.I)
        if m:
            body = m.group(0)
            break
    body = re.sub(r"<(script|style|nav|footer|header|aside)[\s>].*?</\1>", " ", body, flags=re.S | re.I)
    blocks = re.findall(r"<(h[1-4]|p|li)[^>]*>(.*?)</\1>", body, flags=re.S | re.I)
    lines = []
    for tag, inner in blocks:
        t = html.unescape(re.sub(r"<[^>]+>", " ", inner))
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) < 3 or re.search(r"^(share|tweet|email|print|related terms|keep exploring)$", t, re.I):
            continue
        lines.append(("## " if tag.lower().startswith("h") else "") + t)
    out, seen = [], set()
    for l in lines:                        # drop repeated menu lines
        if l not in seen:
            seen.add(l)
            out.append(l)
    return "\n".join(out)


def pdf_text(content: bytes) -> str:
    import pymupdf   # PyMuPDF
    doc = pymupdf.open(stream=content, filetype="pdf")
    pages = []
    for i, p in enumerate(doc):
        t = re.sub(r"[ \t]+", " ", p.get_text()).strip()
        if t:
            pages.append(f"[page {i + 1}]\n{t}")
    return "\n\n".join(pages)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    index = []
    for r in RESOURCES:
        entry = {k: v for k, v in r.items()}
        if r["kind"] == "link":
            index.append(entry)
            print(f"  link   {r['id']}")
            continue
        resp = requests.get(r["url"], headers=HEADERS, timeout=120)
        resp.raise_for_status()
        text = pdf_text(resp.content) if r["kind"] == "pdf" else page_text(resp.text)
        with open(os.path.join(OUT, r["id"] + ".txt"), "w", encoding="utf-8") as f:
            f.write(text)
        entry["chars"] = len(text)
        index.append(entry)
        print(f"  {r['kind']:5}  {r['id']:24} {len(text):7} chars  {text[:90].replace(chr(10), ' ')}")
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
