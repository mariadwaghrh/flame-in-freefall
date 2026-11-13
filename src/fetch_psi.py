"""Step 1: download the combustion-science investigations from NASA PSI.

For each of the investigations PSI files under "Combustion Science" we save:
  data/raw/psi_search.json                 the search results (one record per investigation)
  data/raw/investigations/PSI-<n>.json     objectives, approach, hypothesis, hardware, publications,
                                           and a summary of the archived files (not the files themselves)
  data/raw/tables/<file>.csv               the experimental table: one row per test (fuel, O2, flow, pressure...)

PSI has no documented API. These are the same endpoints the psi.nasa.gov web app calls.
The full archive (videos, sensor files) is about 12 TB; we only record its size and contents.

Usage:  python src/fetch_psi.py
"""
import os
import re
import sys
import json
import time
import collections
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

INV_DIR = os.path.join(config.RAW, "investigations")
TABLE_DIR = os.path.join(config.RAW, "tables")
HEADERS = {"User-Agent": config.USER_AGENT}
PAUSE = 0.4   # seconds between requests, to be polite to NASA's servers


def get_json(url, params=None):
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception as ex:
            if attempt == 2:
                raise
            print(f"   retry after error: {ex}")
            time.sleep(2 * (attempt + 1))


def fix_text(s):
    """PSI metadata contains broken characters (U+FFFD) where apostrophes and dashes were."""
    if not isinstance(s, str):
        return s
    s = re.sub(r"(?<=[A-Za-z])�(?=(s|re|t|ll|ve|d|m)\b)", "'", s)   # you�re -> you're
    s = re.sub(r"(?<=[A-Za-z0-9])�(?=[A-Za-z0-9])", "-", s)          # BASS�II -> BASS-II
    s = re.sub(r"(?<=\s)�(?=\s)", "-", s)
    return s.replace("�", '"').replace("\r\n", "\n").strip()


def archive_summary(files):
    """The archive can hold thousands of files (hundreds of GB). Keep counts and sizes only."""
    by_folder = collections.defaultdict(lambda: {"files": 0, "bytes": 0.0})
    by_type = collections.Counter()
    for f in files:
        parts = (f.get("remote_path") or "").split("/")
        folder = parts[4] if len(parts) > 4 else "Other"
        by_folder[folder]["files"] += 1
        by_folder[folder]["bytes"] += float(f.get("file_size") or 0)
        name = f.get("file_name") or ""
        by_type[name.rsplit(".", 1)[-1].lower() if "." in name else "none"] += 1
    return {"files": len(files), "by_folder": by_folder, "by_type": dict(by_type.most_common())}


def download_file(acc, file_name, version):
    """PSI hands out a temporary S3 link for each file."""
    r = requests.get(f"{config.PSI}/geode-py/ws/studies/{acc}/download",
                     params={"file": file_name, "version": version, "redirect": "false"}, headers=HEADERS, timeout=60)
    r.raise_for_status()
    url = r.text.strip().strip('"')
    if not url.startswith("http"):
        raise ValueError(f"no download link for {file_name}")
    data = requests.get(url, timeout=120)
    data.raise_for_status()
    return data.content


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for d in (config.RAW, INV_DIR, TABLE_DIR):
        os.makedirs(d, exist_ok=True)

    print("Searching PSI for Research Area = combustion science ...")
    res = get_json(f"{config.PSI}/geode-py/ws/repo/search",
                   params=[("source", "psi"), ("type", "investigation"), ("from", 0), ("size", 300),
                           ("ffield", "Research Area"), ("fvalue", "combustion science")])
    hits = sorted((h["_source"] for h in res["hits"]["hits"]), key=lambda s: int(s["Accession"].split("-")[1]))
    with open(os.path.join(config.RAW, "psi_search.json"), "w", encoding="utf-8") as f:
        json.dump(hits, f, ensure_ascii=False, indent=1)
    print(f"  {len(hits)} investigations\n")

    total_bytes = 0
    for h in hits:
        acc = h["Accession"]
        time.sleep(PAUSE)
        d = get_json(f"{config.PSI}/geode-py/ws/repo/investigations/{acc}")
        files = d.get("added") or []
        rec = {
            "accession": acc,
            "title": fix_text(d.get("title")),
            "acronym": fix_text(d.get("investigationAcronym")),
            "project_type": d.get("projectType"),
            "sub_area": d.get("subResearchArea"),
            "platform": d.get("flightProgram"),
            "center": d.get("managingNasaCenter"),
            "start": d.get("investigationStartDate"),
            "end": d.get("investigationEndDate"),
            "related": d.get("related_glds"),
            "hardware": fix_text(d.get("experimentHardware")),
            "objective": fix_text(d.get("objective")),
            "approach": fix_text(d.get("approach")),
            "hypothesis": fix_text(d.get("hypothesis")),
            "impacts": fix_text(d.get("researchImpacts")),
            "doi": d.get("doi"),
            "license": d.get("licenseIdentifier"),
            "keywords": [k.strip() for k in re.split(r"\s{2,}", h.get("Keywords") or "") if k.strip()],
            "publications": [{"title": fix_text(p.get("title")), "doi": p.get("doi")} for p in d.get("publications", [])],
            "archive_bytes": float(d.get("totalFileSize") or 0),
            "archive": archive_summary(files),
            "images": [{"file_name": i["file_name"], "version": i.get("version", 1), "bytes": float(i.get("file_size") or 0)}
                       for i in d.get("images", []) or []],
            "tables": [],
            "psi_url": f"{config.PSI}/physci/repo/data/investigations/{acc}",
        }
        for t in (d.get("experimentalTable") or []) + (d.get("modelingTable") or []):
            time.sleep(PAUSE)
            try:
                content = download_file(acc, t["file_name"], t.get("version", 1))
                with open(os.path.join(TABLE_DIR, t["file_name"]), "wb") as f:
                    f.write(content)
                rec["tables"].append(t["file_name"])
            except Exception as ex:
                print(f"   ! table {t['file_name']}: {ex}")
        with open(os.path.join(INV_DIR, f"{acc}.json"), "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        total_bytes += rec["archive_bytes"]
        print(f"  {acc:8} {(rec['acronym'] or '(ground study)')[:22]:22} tables={len(rec['tables'])} "
              f"pubs={len(rec['publications']):3} archive={rec['archive']['files']:5} files, {rec['archive_bytes'] / 1e9:7.1f} GB")
    print(f"\nArchive described: {total_bytes / 1e12:.1f} TB (decimal) = {total_bytes / 2**40:.1f} TiB")


if __name__ == "__main__":
    main()
